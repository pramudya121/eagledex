// On-chain pool indexer for EAGLEDEX.
//
// IMPORTANT: We previously used `contract.on(...)` for every pair which
// internally calls `eth_newFilter`. Integralayer testnet RPC limits the
// number of active filters and was rejecting calls with
// `error creating filter: max limit reached` once we had ~5 pairs × 4 events.
//
// New strategy: ONE poll loop that uses `eth_getLogs` (stateless, no server
// filter), scans the topics for Swap/Sync/Mint/Burn across the Factory's
// known pairs, and Factory.PairCreated for new pairs. We keep the
// `lastBlock` cursor so each poll only fetches the delta.
//
// Block timestamps come from `provider.getBlock(n)` (cached) so analytics
// 24h/7d windows are accurate even after a page reload.
import { Contract, JsonRpcProvider, Interface, Log, formatUnits, id as keccakId } from "ethers";
import { useEffect, useState } from "react";
import { FACTORY_ABI, PAIR_ABI, ERC20_ABI } from "./abis";
import { CONTRACTS, TOKENS, TokenInfo } from "./chain";

export interface IndexedPool {
  pair: string;
  token0: string;
  token1: string;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  logo0?: string;
  logo1?: string;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  volume0: bigint;
  volume1: bigint;
  swapCount: number;
  lastBlock: number;
}

export interface RecentSwap {
  pair: string;
  symbol0: string;
  symbol1: string;
  amount0In: bigint; amount1In: bigint;
  amount0Out: bigint; amount1Out: bigint;
  blockNumber: number;
  txHash: string;
  to: string;
  ts: number; // ms — uses real block.timestamp when available
}

export interface PriceSample {
  t: number;
  block: number;
  price: number;
  volume: number;
}

interface State {
  pools: Record<string, IndexedPool>;
  recentSwaps: RecentSwap[];
  priceHistory: Record<string, PriceSample[]>;
  lastUpdated: number;
  initializing: boolean;
  headBlock: number;
  syncedBlock: number;
  lastEventAt: number;
  rpcOk: boolean;
  cacheLoadedAt: number;
  source: "events" | "rpc-poll" | "cache" | "offline";
  lastPollAt: number;
  eventCount: number;
  pollCount: number;
  pollIntervalMs: number;
  nextPollAt: number;
}

// ---- Persistence -----------------------------------------------------------
// Per-chain cache key — switching networks must not mix datasets.
import { getActiveChainKey } from "./chains";
const CACHE_KEY = `eagledex:indexer:v3:${getActiveChainKey()}`;
const HISTORY_MAX = 500;
const RECENT_MAX = 100;
const CACHE_DEBOUNCE_MS = 1500;

const replacer = (_k: string, v: any) => (typeof v === "bigint" ? `b:${v.toString()}` : v);
const reviver  = (_k: string, v: any) => (typeof v === "string" && v.startsWith("b:") ? BigInt(v.slice(2)) : v);

let saveTimer: any = null;
function scheduleSave() {
  if (typeof window === "undefined") return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const snapshot = {
        pools: state.pools,
        recentSwaps: state.recentSwaps.slice(0, RECENT_MAX),
        priceHistory: state.priceHistory,
        syncedBlock: state.syncedBlock,
        savedAt: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot, replacer));
    } catch {
      try { localStorage.removeItem(CACHE_KEY); } catch {}
    }
  }, CACHE_DEBOUNCE_MS);
}

function loadCache(): Partial<State> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw, reviver);
    return {
      pools: data.pools ?? {},
      recentSwaps: data.recentSwaps ?? [],
      priceHistory: data.priceHistory ?? {},
      syncedBlock: data.syncedBlock ?? 0,
      cacheLoadedAt: data.savedAt ?? 0,
    };
  } catch { return null; }
}

const cached = loadCache();

const state: State = {
  pools: (cached?.pools as any) ?? {},
  recentSwaps: (cached?.recentSwaps as any) ?? [],
  priceHistory: (cached?.priceHistory as any) ?? {},
  lastUpdated: 0,
  initializing: false,
  headBlock: 0,
  syncedBlock: cached?.syncedBlock ?? 0,
  lastEventAt: 0,
  rpcOk: true,
  cacheLoadedAt: cached?.cacheLoadedAt ?? 0,
  source: cached ? "cache" : "offline",
  lastPollAt: 0,
  eventCount: 0,
  pollCount: 0,
  pollIntervalMs: 8_000,
  nextPollAt: 0,
};

let listeners: Array<(s: State) => void> = [];
const emit = () => {
  state.lastUpdated = Date.now();
  listeners.forEach(fn => fn(state));
  scheduleSave();
};

const tokenMeta = (addr: string): TokenInfo | undefined =>
  TOKENS.find(t => t.address.toLowerCase() === addr.toLowerCase() && !t.isNative);

let booted = false;
let provider: JsonRpcProvider | null = null;
let factory: Contract | null = null;
let pollTimer: any = null;

// ---- Topic constants (precomputed keccak256 of canonical event sigs) -------
const TOPIC_SWAP = keccakId("Swap(address,uint256,uint256,uint256,uint256,address)");
const TOPIC_SYNC = keccakId("Sync(uint112,uint112)");
const TOPIC_MINT = keccakId("Mint(address,uint256,uint256)");
const TOPIC_BURN = keccakId("Burn(address,uint256,uint256,address)");
const TOPIC_PAIR_CREATED = keccakId("PairCreated(address,address,address,uint256)");

const pairIface = new Interface(PAIR_ABI);
const factoryIface = new Interface(FACTORY_ABI);

// ---- Block timestamp cache --------------------------------------------------
const blockTsCache = new Map<number, number>(); // block → ms timestamp
async function blockTs(bn: number): Promise<number> {
  if (!provider) return Date.now();
  const cachedTs = blockTsCache.get(bn);
  if (cachedTs !== undefined) return cachedTs;
  try {
    const b = await provider.getBlock(bn);
    const ts = (b?.timestamp ?? 0) * 1000 || Date.now();
    blockTsCache.set(bn, ts);
    if (blockTsCache.size > 2000) {
      const keys = Array.from(blockTsCache.keys()).slice(0, 500);
      keys.forEach(k => blockTsCache.delete(k));
    }
    return ts;
  } catch { return Date.now(); }
}

function priceFromReserves(r0: bigint, r1: bigint, dec0: number, dec1: number) {
  const a = Number(formatUnits(r0, dec0));
  const b = Number(formatUnits(r1, dec1));
  return a > 0 ? b / a : 0;
}

function pushPriceSample(pairKey: string, sample: PriceSample) {
  const arr = state.priceHistory[pairKey] ?? [];
  arr.push(sample);
  if (arr.length > HISTORY_MAX) arr.splice(0, arr.length - HISTORY_MAX);
  state.priceHistory[pairKey] = arr;
}

async function coldLoadPair(addr: string) {
  if (!provider) return;
  const key = addr.toLowerCase();
  if (state.pools[key]?.token0) return refreshPair(addr);
  try {
    const c = new Contract(addr, PAIR_ABI, provider);
    const [t0, t1, [r0, r1], ts] = await Promise.all([
      c.token0(), c.token1(), c.getReserves(), c.totalSupply(),
    ]);
    const m0 = tokenMeta(t0);
    const m1 = tokenMeta(t1);
    const rawSym0 = m0?.symbol ?? await new Contract(t0, ERC20_ABI, provider).symbol().catch(() => t0.slice(0,6));
    const rawSym1 = m1?.symbol ?? await new Contract(t1, ERC20_ABI, provider).symbol().catch(() => t1.slice(0,6));
    const sym0 = String(rawSym0).toUpperCase() === "WETH" ? "WIRL" : String(rawSym0);
    const sym1 = String(rawSym1).toUpperCase() === "WETH" ? "WIRL" : String(rawSym1);
    const dec0 = m0?.decimals ?? Number(await new Contract(t0, ERC20_ABI, provider).decimals().catch(() => 18));
    const dec1 = m1?.decimals ?? Number(await new Contract(t1, ERC20_ABI, provider).decimals().catch(() => 18));

    const block = await provider.getBlockNumber();
    state.pools[key] = {
      pair: addr, token0: t0, token1: t1, symbol0: sym0, symbol1: sym1,
      decimals0: Number(dec0), decimals1: Number(dec1),
      logo0: m0?.logo, logo1: m1?.logo,
      reserve0: r0, reserve1: r1, totalSupply: ts,
      volume0: 0n, volume1: 0n, swapCount: 0,
      lastBlock: Math.max(0, block - 1),
    };
    pushPriceSample(key, {
      t: Date.now(), block,
      price: priceFromReserves(r0, r1, Number(dec0), Number(dec1)),
      volume: 0,
    });
    emit();
  } catch (e) {
    console.warn("indexer: coldLoadPair failed", addr, e);
  }
}

async function refreshPair(addr: string) {
  if (!provider) return;
  try {
    const c = new Contract(addr, PAIR_ABI, provider);
    const [[r0, r1], ts] = await Promise.all([c.getReserves(), c.totalSupply()]);
    const p = state.pools[addr.toLowerCase()];
    if (p) { p.reserve0 = r0; p.reserve1 = r1; p.totalSupply = ts; emit(); }
  } catch {}
}

async function discover() {
  if (!factory) return [] as string[];
  try {
    const len: bigint = await factory.allPairsLength();
    const total = Number(len);
    const max = Math.min(total, 200);
    const indices = Array.from({ length: max }, (_, i) => total - 1 - i);
    const pairs: string[] = await Promise.all(indices.map(i => factory!.allPairs(i)));
    const unknown = pairs.filter(p => !state.pools[p.toLowerCase()]?.token0);
    await Promise.all(unknown.slice(0, 25).map(coldLoadPair));
    return pairs;
  } catch (e) { console.warn("indexer: discover failed", e); return []; }
}

// ---- Single log scan over a block range using eth_getLogs ------------------
async function scanLogs(fromBlock: number, toBlock: number) {
  if (!provider) return;
  const knownPairs = new Set(Object.keys(state.pools));
  if (knownPairs.size === 0) return;

  const STEP = 4_000;
  for (let from = fromBlock; from <= toBlock; from += STEP + 1) {
    const to = Math.min(toBlock, from + STEP);
    let logs: Log[] = [];
    try {
      logs = await provider.getLogs({
        fromBlock: from,
        toBlock: to,
        topics: [[TOPIC_SWAP, TOPIC_SYNC, TOPIC_MINT, TOPIC_BURN]],
      });
    } catch (e) {
      try {
        const mid = Math.floor((from + to) / 2);
        const a = await provider.getLogs({ fromBlock: from, toBlock: mid, topics: [[TOPIC_SWAP, TOPIC_SYNC, TOPIC_MINT, TOPIC_BURN]] });
        const b = await provider.getLogs({ fromBlock: mid + 1, toBlock: to, topics: [[TOPIC_SWAP, TOPIC_SYNC, TOPIC_MINT, TOPIC_BURN]] });
        logs = [...a, ...b];
      } catch (err) {
        console.warn("indexer: getLogs chunk failed", from, to, err);
        continue;
      }
    }

    for (const log of logs) {
      const key = log.address.toLowerCase();
      if (!knownPairs.has(key)) continue;
      const p = state.pools[key];
      if (!p) continue;
      const topic0 = log.topics[0];
      try {
        if (topic0 === TOPIC_SYNC) {
          const parsed = pairIface.parseLog({ topics: log.topics as string[], data: log.data });
          if (!parsed) continue;
          p.reserve0 = parsed.args[0] as bigint;
          p.reserve1 = parsed.args[1] as bigint;
          if (log.blockNumber > p.lastBlock) p.lastBlock = log.blockNumber;
        } else if (topic0 === TOPIC_SWAP) {
          const parsed = pairIface.parseLog({ topics: log.topics as string[], data: log.data });
          if (!parsed) continue;
          const a0In = parsed.args[1] as bigint;
          const a1In = parsed.args[2] as bigint;
          const a0Out = parsed.args[3] as bigint;
          const a1Out = parsed.args[4] as bigint;
          const to = parsed.args[5] as string;
          p.volume0 += a0In + a0Out;
          p.volume1 += a1In + a1Out;
          p.swapCount += 1;
          if (log.blockNumber > p.lastBlock) p.lastBlock = log.blockNumber;

          const ts = await blockTs(log.blockNumber);
          state.recentSwaps = [{
            pair: log.address, symbol0: p.symbol0, symbol1: p.symbol1,
            amount0In: a0In, amount1In: a1In, amount0Out: a0Out, amount1Out: a1Out,
            blockNumber: log.blockNumber, txHash: log.transactionHash, to, ts,
          }, ...state.recentSwaps].slice(0, RECENT_MAX);

          const vol = Number(formatUnits(a0In + a0Out, p.decimals0))
                    + Number(formatUnits(a1In + a1Out, p.decimals1));
          pushPriceSample(key, {
            t: ts, block: log.blockNumber,
            price: priceFromReserves(p.reserve0, p.reserve1, p.decimals0, p.decimals1),
            volume: vol,
          });
          state.lastEventAt = Date.now();
          state.eventCount++;
          state.source = "events";
        } else if (topic0 === TOPIC_MINT || topic0 === TOPIC_BURN) {
          if (log.blockNumber > p.lastBlock) p.lastBlock = log.blockNumber;
          await refreshPair(log.address);
        }
      } catch {}
    }
  }
}

async function scanFactory(fromBlock: number, toBlock: number) {
  if (!provider || !factory) return;
  try {
    const logs = await provider.getLogs({
      address: CONTRACTS.FACTORY,
      fromBlock, toBlock,
      topics: [TOPIC_PAIR_CREATED],
    });
    for (const log of logs) {
      try {
        const parsed = factoryIface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!parsed) continue;
        const pair = parsed.args[2] as string;
        if (!state.pools[pair.toLowerCase()]?.token0) await coldLoadPair(pair);
      } catch {}
    }
  } catch (e) {
    console.warn("indexer: scanFactory failed", e);
  }
}

export function bootIndexer(p: JsonRpcProvider) {
  if (booted) return;
  booted = true;
  state.initializing = true;
  provider = p;
  factory = new Contract(CONTRACTS.FACTORY, FACTORY_ABI, p);

  let consecutiveFailures = 0;
  const computeInterval = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return 60_000;
    if (consecutiveFailures > 0) return Math.min(30_000, 4_000 * Math.pow(2, consecutiveFailures - 1));
    const eventStale = !state.lastEventAt || Date.now() - state.lastEventAt > 30_000;
    return eventStale ? 8_000 : 6_000;
  };

  const tick = async () => {
    try {
      const head = await p.getBlockNumber();
      state.headBlock = head;
      state.rpcOk = true;
      consecutiveFailures = 0;
      state.pollCount++;
      state.lastPollAt = Date.now();

      if (state.syncedBlock === 0) state.syncedBlock = Math.max(0, head - 1);

      await discover();
      const fromBlock = Math.min(head, state.syncedBlock + 1);
      if (head >= fromBlock) {
        await scanFactory(fromBlock, head);
        await scanLogs(fromBlock, head);
        await Promise.all(Object.keys(state.pools).map(refreshPair));
        state.syncedBlock = head;
      }
      const eventStale = !state.lastEventAt || Date.now() - state.lastEventAt > 30_000;
      if (eventStale) state.source = "rpc-poll";
    } catch (e) {
      state.rpcOk = false;
      consecutiveFailures++;
      console.warn("indexer: tick failed", e);
    }
    state.pollIntervalMs = computeInterval();
    state.nextPollAt = Date.now() + state.pollIntervalMs;
    state.initializing = false;
    emit();
    pollTimer = setTimeout(tick, state.pollIntervalMs);
  };

  tick();

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        clearTimeout(pollTimer);
        tick();
      }
    });
  }
}

export type SyncStatus = "synced" | "lagging" | "stale" | "offline";
export function getSyncStatus(s: { headBlock: number; syncedBlock: number; lastEventAt: number; rpcOk: boolean; initializing: boolean }) {
  if (!s.rpcOk) return { status: "offline" as SyncStatus, lag: 0, label: "Offline" };
  if (s.initializing && s.headBlock === 0) return { status: "lagging" as SyncStatus, lag: 0, label: "Syncing…" };
  const lag = Math.max(0, s.headBlock - s.syncedBlock);
  if (lag > 50) return { status: "lagging" as SyncStatus, lag, label: `Lag ${lag} blk` };
  return { status: "synced" as SyncStatus, lag, label: "Synced" };
}

export function getDataSource(s: State): { source: State["source"]; label: string; detail: string } {
  if (!s.rpcOk) return { source: "offline", label: "Offline", detail: "RPC unreachable — showing cached data" };
  if (s.source === "events" && s.lastEventAt && Date.now() - s.lastEventAt < 30_000)
    return { source: "events", label: "On-chain logs (live)", detail: `${s.eventCount} events indexed` };
  if (s.source === "rpc-poll" || (s.lastPollAt && (!s.lastEventAt || Date.now() - s.lastEventAt > 30_000)))
    return { source: "rpc-poll", label: "Log polling", detail: `Polling every ${Math.round(s.pollIntervalMs/1000)}s · ${s.pollCount} polls` };
  if (Object.keys(s.pools).length > 0)
    return { source: "cache", label: "Cached", detail: "Loaded from local cache, awaiting first sync" };
  return { source: "offline", label: "Connecting…", detail: "Establishing RPC link" };
}

export const poolIndex = {
  snapshot: () => state,
  subscribe: (fn: (s: State) => void) => {
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
  },
  refresh: discover,
  refreshPair,
  getPriceHistory: (pair: string): PriceSample[] => state.priceHistory[pair.toLowerCase()] ?? [],
  clearCache: () => { try { localStorage.removeItem(CACHE_KEY); } catch {} },
};

export function usePoolIndex() {
  const [, setTick] = useState(0);
  useEffect(() => poolIndex.subscribe(() => setTick(t => t + 1)), []);
  return state;
}

export const poolTVL = (p: IndexedPool) =>
  Number(formatUnits(p.reserve0, p.decimals0)) + Number(formatUnits(p.reserve1, p.decimals1));

export const poolPrice = (p: IndexedPool) => {
  const r0 = Number(formatUnits(p.reserve0, p.decimals0));
  const r1 = Number(formatUnits(p.reserve1, p.decimals1));
  return r0 > 0 ? r1 / r0 : 0;
};

export const poolVolume = (p: IndexedPool) =>
  Number(formatUnits(p.volume0, p.decimals0)) + Number(formatUnits(p.volume1, p.decimals1));

/** Volume aggregated from RecentSwap entries within a window (ms). Uses real
 *  block timestamps so 24h/7d analytics are accurate. */
export function poolVolumeWindow(pair: string, windowMs: number): number {
  const cutoff = Date.now() - windowMs;
  const meta = state.pools[pair.toLowerCase()];
  if (!meta) return 0;
  let sum = 0;
  for (const s of state.recentSwaps) {
    if (s.pair.toLowerCase() !== pair.toLowerCase()) continue;
    if (s.ts < cutoff) continue;
    sum += Number(formatUnits(s.amount0In + s.amount0Out, meta.decimals0))
         + Number(formatUnits(s.amount1In + s.amount1Out, meta.decimals1));
  }
  return sum;
}
