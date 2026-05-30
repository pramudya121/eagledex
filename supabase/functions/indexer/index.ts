// EAGLEDEX persistent indexer.
// Scans Integralayer testnet for Pair events (Swap/Mint/Burn/Sync) and
// Factory.PairCreated, then persists into Postgres so volume/TVL analytics
// are accurate across users and devices.
//
// Invoke this function periodically (e.g. via UI heartbeat from the app, or
// a future cron). Each call advances the cursor by up to MAX_BLOCKS_PER_CALL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ethers } from "https://esm.sh/ethers@6.13.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHAIN_ID = 26218;
const RPC = "https://testnet.integralayer.com/evm";
const FACTORY = "0x5687FDA3BdE14d38057699c402606ab470EcA873";

const MAX_BLOCKS_PER_CALL = 800;
const STEP = 800;
const MIN_STEP = 100;
const MAX_META_PER_CALL = 2;
const ASSUMED_BLOCK_TIME = 3; // seconds, used to approximate block_ts and avoid per-block getBlock RPC

// Retry getLogs with adaptive range halving on RPC timeouts.
async function getLogsRetry(provider: ethers.JsonRpcProvider, filter: any): Promise<any[]> {
  const from = Number(filter.fromBlock);
  const to = Number(filter.toBlock);
  try {
    return await provider.getLogs(filter);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const span = to - from + 1;
    if (span <= MIN_STEP || !/timed out|timeout|coalesce|exceed|limit/i.test(msg)) {
      console.warn(`getLogs failed [${from}-${to}] span=${span}: ${msg}`);
      return [];
    }
    const mid = from + Math.floor(span / 2);
    const a = await getLogsRetry(provider, { ...filter, fromBlock: from, toBlock: mid });
    const b = await getLogsRetry(provider, { ...filter, fromBlock: mid + 1, toBlock: to });
    return [...a, ...b];
  }
}

const TOPIC_SWAP = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
const TOPIC_SYNC = ethers.id("Sync(uint112,uint112)");
const TOPIC_MINT = ethers.id("Mint(address,uint256,uint256)");
const TOPIC_BURN = ethers.id("Burn(address,uint256,uint256,address)");
const TOPIC_PAIR_CREATED = ethers.id("PairCreated(address,address,address,uint256)");

const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function totalSupply() view returns (uint256)",
  "event Mint(address indexed sender, uint256 amount0, uint256 amount1)",
  "event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)",
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
  "event Sync(uint112 reserve0, uint112 reserve1)",
];
const FACTORY_ABI = [
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)",
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)",
];
const ERC20_ABI = ["function symbol() view returns (string)", "function decimals() view returns (uint8)"];

const pairIface = new ethers.Interface(PAIR_ABI);
const factoryIface = new ethers.Interface(FACTORY_ABI);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Gateway-level JWT verification is enabled via supabase/config.toml
  // ([functions.indexer] verify_jwt = true), which blocks anonymous external
  // callers. The Supabase JS client automatically attaches the anon/user JWT
  // on `supabase.functions.invoke("indexer")`.

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const provider = new ethers.JsonRpcProvider(RPC);
  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);

  try {
    const head = await provider.getBlockNumber();

    // Discover known pairs: use DB cache as source of truth, only fetch indices we don't have yet.
    const { data: cachedPairsRows } = await supabase
      .from("pairs_state").select("pair").eq("chain_id", CHAIN_ID);
    const cachedPairs: string[] = (cachedPairsRows ?? []).map((r: any) => r.pair.toLowerCase());
    const pairs: string[] = [...cachedPairs];
    const knownPairs = new Set(pairs);

    const len = Number(await factory.allPairsLength());
    if (len > cachedPairs.length) {
      const toFetch = Math.min(len - cachedPairs.length, 5); // cap discovery per call
      for (let i = cachedPairs.length; i < cachedPairs.length + toFetch; i++) {
        try {
          const a = (await factory.allPairs(i)).toLowerCase();
          if (!knownPairs.has(a)) { pairs.push(a); knownPairs.add(a); }
        } catch {}
      }
    }

    const { data: cur } = await supabase.from("indexer_cursor").select("last_block").eq("chain_id", CHAIN_ID).maybeSingle();
    const cursorBlock = Number(cur?.last_block ?? 0);

    // BACKFILL: pairs exist but no events yet → rewind cursor in smaller chunks per call.
    const { count: evtCount } = await supabase.from("pair_events").select("*", { count: "exact", head: true }).eq("chain_id", CHAIN_ID);
    const BACKFILL_BLOCKS = 5_000;

    let from: number;
    if (pairs.length > 0 && (evtCount ?? 0) === 0) {
      from = Math.max(0, head - BACKFILL_BLOCKS);
    } else if (cursorBlock === 0) {
      from = Math.max(0, head - 2_000);
    } else {
      from = cursorBlock + 1;
    }
    const to = Math.min(head, from + MAX_BLOCKS_PER_CALL - 1);
    if (from > to) {
      return json({ ok: true, head, from, to, scanned: 0, message: "up to date" });
    }

    // Load metadata for at most MAX_META_PER_CALL pairs that lack it (new pairs discovered above).
    const missingMeta = pairs.filter(p => !cachedPairs.includes(p)).slice(0, MAX_META_PER_CALL);
    for (const p of missingMeta) await loadPairMeta(supabase, provider, p);

    let scanned = 0;
    // Approximate block timestamp from head (avoid per-block getBlock to save CPU/RPC).
    let headTs = Math.floor(Date.now() / 1000);
    try { const hb = await provider.getBlock(head); if (hb?.timestamp) headTs = Number(hb.timestamp); } catch {}
    const ts = (bn: number): string =>
      new Date((headTs - (head - bn) * ASSUMED_BLOCK_TIME) * 1000).toISOString();

    let lastOk = from - 1;
    try {
      for (let f = from; f <= to; f += STEP) {
        const t = Math.min(to, f + STEP - 1);
        // PairCreated logs
        const factoryLogs = await getLogsRetry(provider, { address: FACTORY, fromBlock: f, toBlock: t, topics: [TOPIC_PAIR_CREATED] });
        for (const log of factoryLogs) {
          try {
            const parsed = factoryIface.parseLog({ topics: log.topics as string[], data: log.data })!;
            const newPair = (parsed.args[2] as string).toLowerCase();
            knownPairs.add(newPair);
            await supabase.from("pair_events").upsert({
              chain_id: CHAIN_ID, pair: newPair, event_type: "pair_created",
              block_number: log.blockNumber, block_ts: await ts(log.blockNumber),
              tx_hash: log.transactionHash, log_index: log.index,
              token0: (parsed.args[0] as string).toLowerCase(),
              token1: (parsed.args[1] as string).toLowerCase(),
            }, { onConflict: "chain_id,tx_hash,log_index" });
            await loadPairMeta(supabase, provider, newPair, log.blockNumber);
            scanned++;
          } catch {}
        }

        // Pair logs
        const logs = await getLogsRetry(provider, {
          fromBlock: f, toBlock: t,
          topics: [[TOPIC_SWAP, TOPIC_SYNC, TOPIC_MINT, TOPIC_BURN]],
        });
        const rows: any[] = [];
        for (const log of logs) {
          const addr = log.address.toLowerCase();
          if (!knownPairs.has(addr)) continue;
          try {
            const parsed = pairIface.parseLog({ topics: log.topics as string[], data: log.data });
            if (!parsed) continue;
            const blockTs = await ts(log.blockNumber);
            const base = {
              chain_id: CHAIN_ID, pair: addr,
              block_number: log.blockNumber, block_ts: blockTs,
              tx_hash: log.transactionHash, log_index: log.index,
            };
            if (parsed.name === "Swap") {
              rows.push({
                ...base, event_type: "swap",
                sender: (parsed.args[0] as string).toLowerCase(),
                amount0_in: parsed.args[1].toString(),
                amount1_in: parsed.args[2].toString(),
                amount0_out: parsed.args[3].toString(),
                amount1_out: parsed.args[4].toString(),
                to_addr: (parsed.args[5] as string).toLowerCase(),
              });
            } else if (parsed.name === "Sync") {
              rows.push({
                ...base, event_type: "sync",
                reserve0: parsed.args[0].toString(),
                reserve1: parsed.args[1].toString(),
              });
            } else if (parsed.name === "Mint") {
              rows.push({
                ...base, event_type: "mint",
                sender: (parsed.args[0] as string).toLowerCase(),
                amount0: parsed.args[1].toString(),
                amount1: parsed.args[2].toString(),
              });
            } else if (parsed.name === "Burn") {
              rows.push({
                ...base, event_type: "burn",
                sender: (parsed.args[0] as string).toLowerCase(),
                amount0: parsed.args[1].toString(),
                amount1: parsed.args[2].toString(),
                to_addr: (parsed.args[3] as string).toLowerCase(),
              });
            }
          } catch {}
        }
        // Batch upsert
        if (rows.length > 0) {
          for (let i = 0; i < rows.length; i += 200) {
            await supabase.from("pair_events").upsert(rows.slice(i, i + 200), { onConflict: "chain_id,tx_hash,log_index" });
          }
          scanned += rows.length;
        }
        lastOk = t;
      }
    } catch (loopErr: any) {
      console.warn("partial scan, advancing cursor to", lastOk, loopErr?.message ?? loopErr);
    }
    const effectiveTo = Math.max(from - 1, lastOk);

    // Refresh state for pairs that had events
    const touched = new Set<string>();
    const { data: recent } = await supabase
      .from("pair_events")
      .select("pair")
      .gte("block_number", from)
      .lte("block_number", effectiveTo);
    (recent ?? []).forEach((r: any) => touched.add(r.pair));
    const touchedArr = Array.from(touched).slice(0, 5);
    for (const p of touchedArr) await refreshPairState(supabase, provider, p);

    if (effectiveTo >= from) {
      await supabase.from("indexer_cursor").upsert({ chain_id: CHAIN_ID, last_block: effectiveTo, updated_at: new Date().toISOString() });
    }

    return json({ ok: true, head, from, to: effectiveTo, requestedTo: to, scanned, pairs: pairs.length });
  } catch (e: any) {
    console.error("indexer error", e);
    return json({ ok: true, error: e?.message ?? String(e), scanned: 0 }, 200);
  }
});

async function loadPairMeta(supabase: any, provider: ethers.JsonRpcProvider, pair: string, createdBlock?: number) {
  try {
    const c = new ethers.Contract(pair, PAIR_ABI, provider);
    const [t0, t1, [r0, r1], ts] = await Promise.all([c.token0(), c.token1(), c.getReserves(), c.totalSupply()]);
    const e0 = new ethers.Contract(t0, ERC20_ABI, provider);
    const e1 = new ethers.Contract(t1, ERC20_ABI, provider);
    const [s0, s1, d0, d1] = await Promise.all([
      e0.symbol().catch(() => "?"),
      e1.symbol().catch(() => "?"),
      e0.decimals().catch(() => 18),
      e1.decimals().catch(() => 18),
    ]);
    await supabase.from("pairs_state").upsert({
      pair, chain_id: CHAIN_ID,
      token0: (t0 as string).toLowerCase(), token1: (t1 as string).toLowerCase(),
      symbol0: String(s0), symbol1: String(s1),
      decimals0: Number(d0), decimals1: Number(d1),
      reserve0: r0.toString(), reserve1: r1.toString(),
      total_supply: ts.toString(),
      created_block: createdBlock ?? null,
      updated_at: new Date().toISOString(),
    });
  } catch (e) { console.warn("loadPairMeta failed", pair, e); }
}

async function refreshPairState(supabase: any, provider: ethers.JsonRpcProvider, pair: string) {
  try {
    const c = new ethers.Contract(pair, PAIR_ABI, provider);
    const [[r0, r1], ts] = await Promise.all([c.getReserves(), c.totalSupply()]);
    await supabase.from("pairs_state").update({
      reserve0: r0.toString(), reserve1: r1.toString(), total_supply: ts.toString(),
      updated_at: new Date().toISOString(),
    }).eq("pair", pair);
  } catch {}
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
