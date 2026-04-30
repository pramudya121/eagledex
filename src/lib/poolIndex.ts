// On-chain pool indexer for EAGLEDEX.
// Maintains a live cache of pairs/reserves/volume by polling + event subscription,
// so Pools / Analytics / Portfolio update without manual refresh.
// Persists to localStorage so reload doesn't lose progress.
import { Contract, JsonRpcProvider, formatUnits } from "ethers";
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
  // running window stats (raw token units, not USD)
  volume0: bigint;
  volume1: bigint;
  swapCount: number;
  // last sync block for the pool (highest block we've processed for this pair)
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
  // unix ms — when we recorded it (used as fallback when no block timestamp)
  ts: number;
}

// One price sample per swap, keyed by pair. Used for the realtime chart.
export interface PriceSample {
  t: number;          // ms timestamp
  block: number;
  price: number;      // token1 per token0 (after the swap)
  volume: number;     // human-units across both sides for that swap
}

interface State {
  pools: Record<string, IndexedPool>;
  recentSwaps: RecentSwap[];
  // priceHistory[pair.toLowerCase()] -> samples (oldest → newest)
  priceHistory: Record<string, PriceSample[]>;
  lastUpdated: number;
  initializing: boolean;
  // sync telemetry
  headBlock: number;        // latest block from chain
  syncedBlock: number;      // highest block we've processed an event for (global)
  lastEventAt: number;      // timestamp of last live event
  rpcOk: boolean;           // last RPC call succeeded
  // persisted hint of the last time we wrote cache (just for UI)
  cacheLoadedAt: number;
  // Source telemetry — how data is currently being delivered
  source: "events" | "rpc-poll" | "cache" | "offline";
  lastPollAt: number;       // timestamp of last successful RPC poll
  eventCount: number;       // count of live events received this session
  pollCount: number;        // count of RPC polls performed this session
  // Adaptive polling
  pollIntervalMs: number;   // current interval — adapts to tab visibility & event freshness
  nextPollAt: number;       // timestamp of next scheduled poll
}

// ---- Persistence -----------------------------------------------------------
const CACHE_KEY = "eagledex:indexer:v2";
const HISTORY_MAX = 500;        // samples per pair kept in memory + cache
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
    } catch (e) {
      // quota exceeded — drop history first then retry
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch {}
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
  pollIntervalMs: 15_000,
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
const pairContracts = new Map<string, Contract>();

// Compute price token1/token0 from raw reserves
function priceFromReserves(r0: bigint, r1: bigint, dec0: number, dec1: number) {
  const a = Number(formatUnits(r0, dec0));
  const b = Number(formatUnits(r1, dec1));
  return a > 0 ? b / a : 0;
}

function pushPriceSample(pairKey: string, sample: PriceSample) {
  const arr = state.priceHistory[pairKey] ?? [];
  arr.push(sample);
  // Keep last HISTORY_MAX samples
  if (arr.length > HISTORY_MAX) arr.splice(0, arr.length - HISTORY_MAX);
  state.priceHistory[pairKey] = arr;
}

async function loadPair(addr: string) {
  if (!provider) return;
  const key = addr.toLowerCase();
  const existing = state.pools[key];

  try {
    const c = new Contract(addr, PAIR_ABI, provider);

    // If cached, just attach listeners + refresh reserves. Don't re-fetch metadata or backfill.
    if (existing && existing.token0 && existing.symbol0) {
      // Refresh reserves so we're not stale on first paint
      try {
        const [[r0, r1], ts] = await Promise.all([c.getReserves(), c.totalSupply()]);
        existing.reserve0 = r0; existing.reserve1 = r1; existing.totalSupply = ts;
      } catch {}
      attachListeners(addr, c, existing.symbol0, existing.symbol1, existing.decimals0, existing.decimals1);

      // Incrementally backfill events since lastBlock (cheap)
      try {
        const head = await provider.getBlockNumber();
        const fromBlock = Math.max(0, (existing.lastBlock || head) + 1);
        if (head > fromBlock) {
          const swaps = await c.queryFilter(c.filters.Swap(), fromBlock, head);
          for (const e of swaps) {
            const a: any = (e as any).args;
            existing.volume0 += (a.amount0In as bigint) + (a.amount0Out as bigint);
            existing.volume1 += (a.amount1In as bigint) + (a.amount1Out as bigint);
            existing.swapCount++;
            state.recentSwaps.unshift({
              pair: addr, symbol0: existing.symbol0, symbol1: existing.symbol1,
              amount0In: a.amount0In, amount1In: a.amount1In,
              amount0Out: a.amount0Out, amount1Out: a.amount1Out,
              blockNumber: e.blockNumber, txHash: e.transactionHash, to: a.to, ts: Date.now(),
            });
          }
          if (swaps.length) {
            // sample current price after backfill
            pushPriceSample(key, {
              t: Date.now(), block: head,
              price: priceFromReserves(existing.reserve0, existing.reserve1, existing.decimals0, existing.decimals1),
              volume: 0,
            });
          }
          existing.lastBlock = head;
        }
        if (head > state.syncedBlock) state.syncedBlock = head;
        state.recentSwaps = state.recentSwaps.slice(0, RECENT_MAX);
      } catch {}
      emit();
      return;
    }

    // Cold load (first time we see this pair)
    const [t0, t1, [r0, r1], ts] = await Promise.all([
      c.token0(), c.token1(), c.getReserves(), c.totalSupply(),
    ]);
    const m0 = tokenMeta(t0);
    const m1 = tokenMeta(t1);
    const sym0 = m0?.symbol ?? await new Contract(t0, ERC20_ABI, provider).symbol().catch(() => t0.slice(0,6));
    const sym1 = m1?.symbol ?? await new Contract(t1, ERC20_ABI, provider).symbol().catch(() => t1.slice(0,6));
    const dec0 = m0?.decimals ?? await new Contract(t0, ERC20_ABI, provider).decimals().catch(() => 18);
    const dec1 = m1?.decimals ?? await new Contract(t1, ERC20_ABI, provider).decimals().catch(() => 18);

    const block = await provider.getBlockNumber();
    const fromBlock = Math.max(0, block - 50_000);
    let volume0 = 0n, volume1 = 0n, swapCount = 0;
    let recents: RecentSwap[] = [];
    try {
      const swaps = await c.queryFilter(c.filters.Swap(), fromBlock, block);
      swaps.forEach((e: any) => {
        const { amount0In, amount1In, amount0Out, amount1Out, to } = e.args;
        volume0 += (amount0In as bigint) + (amount0Out as bigint);
        volume1 += (amount1In as bigint) + (amount1Out as bigint);
        swapCount++;
        recents.push({
          pair: addr, symbol0: sym0, symbol1: sym1,
          amount0In, amount1In, amount0Out, amount1Out,
          blockNumber: e.blockNumber, txHash: e.transactionHash, to, ts: Date.now(),
        });
      });
    } catch {}

    state.pools[key] = {
      pair: addr, token0: t0, token1: t1, symbol0: sym0, symbol1: sym1,
      decimals0: Number(dec0), decimals1: Number(dec1),
      logo0: m0?.logo, logo1: m1?.logo,
      reserve0: r0, reserve1: r1, totalSupply: ts,
      volume0, volume1, swapCount, lastBlock: block,
    };
    state.recentSwaps = [...recents, ...state.recentSwaps].slice(0, RECENT_MAX);
    // Initial price sample
    pushPriceSample(key, {
      t: Date.now(), block,
      price: priceFromReserves(r0, r1, Number(dec0), Number(dec1)),
      volume: 0,
    });

    attachListeners(addr, c, sym0, sym1, Number(dec0), Number(dec1));
    if (block > state.syncedBlock) state.syncedBlock = block;
    emit();
  } catch (e) {
    console.warn("indexer: loadPair failed", addr, e);
  }
}

function attachListeners(addr: string, c: Contract, sym0: string, sym1: string, dec0: number, dec1: number) {
  const key = addr.toLowerCase();
  if (pairContracts.has(key)) return; // already subscribed
  pairContracts.set(key, c);

  c.on("Sync", (r0n: bigint, r1n: bigint, ev: any) => {
    const p = state.pools[key];
    if (p) { p.reserve0 = r0n; p.reserve1 = r1n; }
    const bn = ev?.log?.blockNumber ?? 0;
    if (bn > state.syncedBlock) state.syncedBlock = bn;
    if (p && bn > p.lastBlock) p.lastBlock = bn;
    state.lastEventAt = Date.now();
    state.eventCount++;
    state.source = "events";
    emit();
  });
  c.on("Swap", (sender: string, a0In: bigint, a1In: bigint, a0Out: bigint, a1Out: bigint, to: string, ev: any) => {
    const p = state.pools[key];
    if (!p) return;
    p.volume0 += a0In + a0Out;
    p.volume1 += a1In + a1Out;
    p.swapCount += 1;
    const bn = ev?.log?.blockNumber ?? 0;
    if (bn > state.syncedBlock) state.syncedBlock = bn;
    if (bn > p.lastBlock) p.lastBlock = bn;
    state.lastEventAt = Date.now();
    state.eventCount++;
    state.source = "events";
    state.recentSwaps = [{
      pair: addr, symbol0: p.symbol0, symbol1: p.symbol1,
      amount0In: a0In, amount1In: a1In, amount0Out: a0Out, amount1Out: a1Out,
      blockNumber: bn, txHash: ev?.log?.transactionHash ?? "", to, ts: Date.now(),
    }, ...state.recentSwaps].slice(0, RECENT_MAX);
    // Price sample using current reserves (after Sync usually fires before Swap, but we sample post)
    const vol =
      Number(formatUnits(a0In + a0Out, dec0)) + Number(formatUnits(a1In + a1Out, dec1));
    pushPriceSample(key, {
      t: Date.now(), block: bn,
      price: priceFromReserves(p.reserve0, p.reserve1, p.decimals0, p.decimals1),
      volume: vol,
    });
    emit();
  });
  c.on("Mint", () => refreshPair(addr));
  c.on("Burn", () => refreshPair(addr));
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
  if (!factory) return;
  try {
    const len: bigint = await factory.allPairsLength();
    const total = Number(len);
    const max = Math.min(total, 100);
    const indices = Array.from({ length: max }, (_, i) => total - 1 - i);
    const pairs: string[] = await Promise.all(indices.map(i => factory!.allPairs(i)));
    for (const p of pairs) await loadPair(p);
  } catch (e) { console.warn("indexer: discover failed", e); }
}

export function bootIndexer(p: JsonRpcProvider) {
  if (booted) return;
  booted = true;
  state.initializing = true;
  provider = p;
  factory = new Contract(CONTRACTS.FACTORY, FACTORY_ABI, p);

  // Listen for new pairs
  factory.on("PairCreated", (_t0: string, _t1: string, pair: string) => {
    loadPair(pair);
  });

  // Re-attach listeners + refresh state for all cached pairs immediately
  // (loadPair is a no-op if it doesn't recognize the pair)
  Object.keys(state.pools).forEach(addr => loadPair(addr));

  discover().finally(() => { state.initializing = false; emit(); });

  // ---- Adaptive polling ----
  // Interval rules (all values empirical, easy to tune):
  //   • tab hidden                            → 60_000  (battery / RPC friendly)
  //   • events flowing (≤30s since last)       → 20_000  (events are primary, poll = safety net)
  //   • event-stale (RPC fallback) & visible   →  6_000  (poll IS the source — keep data fresh)
  //   • RPC currently failing                  →  3_000  (back off via failure count below)
  // We schedule via setTimeout so each tick can pick a new interval.
  let consecutiveFailures = 0;
  const computeInterval = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return 60_000;
    if (consecutiveFailures > 0) {
      // Exponential back-off, capped at 30s
      return Math.min(30_000, 3_000 * Math.pow(2, consecutiveFailures - 1));
    }
    const eventStale = !state.lastEventAt || Date.now() - state.lastEventAt > 30_000;
    if (eventStale) return 6_000;
    return 20_000;
  };

  const tick = async () => {
    try {
      const h = await p.getBlockNumber();
      state.headBlock = h;
      if (state.syncedBlock === 0) state.syncedBlock = h;
      state.rpcOk = true;
      consecutiveFailures = 0;
      state.pollCount++;
      state.lastPollAt = Date.now();
      const eventStale = !state.lastEventAt || Date.now() - state.lastEventAt > 30_000;
      if (eventStale) state.source = "rpc-poll";
    } catch {
      state.rpcOk = false;
      consecutiveFailures++;
    }
    try { await discover(); } catch {}
    try { Object.keys(state.pools).forEach(refreshPair); } catch {}

    state.pollIntervalMs = computeInterval();
    state.nextPollAt = Date.now() + state.pollIntervalMs;
    emit();
    pollTimer = setTimeout(tick, state.pollIntervalMs);
  };
  state.pollIntervalMs = computeInterval();
  state.nextPollAt = Date.now() + state.pollIntervalMs;
  pollTimer = setTimeout(tick, state.pollIntervalMs);

  // React immediately when the tab becomes visible again — users coming back
  // expect fresh data without waiting for the next interval boundary.
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        clearTimeout(pollTimer);
        tick();
      }
    });
  }
}

// Sync status helper
export type SyncStatus = "synced" | "lagging" | "stale" | "offline";
export function getSyncStatus(s: { headBlock: number; syncedBlock: number; lastEventAt: number; rpcOk: boolean; initializing: boolean }) {
  if (!s.rpcOk) return { status: "offline" as SyncStatus, lag: 0, label: "Offline" };
  if (s.initializing && s.headBlock === 0) return { status: "lagging" as SyncStatus, lag: 0, label: "Syncing…" };
  const lag = Math.max(0, s.headBlock - s.syncedBlock);
  if (lag > 50) return { status: "lagging" as SyncStatus, lag, label: `Lag ${lag} blk` };
  return { status: "synced" as SyncStatus, lag, label: "Synced" };
}

/** Human description of the active data source. */
export function getDataSource(s: State): { source: State["source"]; label: string; detail: string } {
  if (!s.rpcOk) return { source: "offline", label: "Offline", detail: "RPC unreachable — showing cached data" };
  if (s.source === "events" && s.lastEventAt && Date.now() - s.lastEventAt < 30_000)
    return { source: "events", label: "RPC events (live)", detail: `${s.eventCount} live events received` };
  if (s.source === "rpc-poll" || (s.lastPollAt && (!s.lastEventAt || Date.now() - s.lastEventAt > 30_000)))
    return { source: "rpc-poll", label: "RPC poll fallback", detail: `Polling every 15s · ${s.pollCount} polls` };
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
  // Expose history for charts
  getPriceHistory: (pair: string): PriceSample[] => state.priceHistory[pair.toLowerCase()] ?? [],
  clearCache: () => {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
  },
};

export function usePoolIndex() {
  const [, setTick] = useState(0);
  useEffect(() => poolIndex.subscribe(() => setTick(t => t + 1)), []);
  return state;
}

// Helpers
export const poolTVL = (p: IndexedPool) =>
  Number(formatUnits(p.reserve0, p.decimals0)) + Number(formatUnits(p.reserve1, p.decimals1));

export const poolPrice = (p: IndexedPool) => {
  const r0 = Number(formatUnits(p.reserve0, p.decimals0));
  const r1 = Number(formatUnits(p.reserve1, p.decimals1));
  return r0 > 0 ? r1 / r0 : 0;
};

export const poolVolume = (p: IndexedPool) =>
  Number(formatUnits(p.volume0, p.decimals0)) + Number(formatUnits(p.volume1, p.decimals1));
