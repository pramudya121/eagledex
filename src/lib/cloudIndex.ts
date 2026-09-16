// Cloud-backed analytics. Reads from Postgres (persisted by the indexer edge
// function) so 24h / 7d volume is accurate across all users and devices.
//
// Heartbeat: any user visiting the app pings the indexer function periodically
// so the cursor advances even without a cron. Cheap idempotent upserts make
// concurrent invocations safe.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { INTEGRALAYER } from "@/lib/chain";

export interface CloudPairVolume {
  pair: string;
  volume0: number;
  volume1: number;
  swap_count: number;
}
export interface CloudPairState {
  pair: string;
  token0: string;
  token1: string;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  reserve0: string;
  reserve1: string;
  total_supply: string;
  updated_at: string;
}

interface CloudState {
  volume24h: Record<string, CloudPairVolume>;
  volume7d: Record<string, CloudPairVolume>;
  pairs: Record<string, CloudPairState>;
  lastSyncAt: number;
  lastBlock: number;
  scannedLastCall: number;
  status: "idle" | "syncing" | "error" | "ok";
  error?: string;
}

const state: CloudState = {
  volume24h: {}, volume7d: {}, pairs: {},
  lastSyncAt: 0, lastBlock: 0, scannedLastCall: 0,
  status: "idle",
};

let listeners: Array<(s: CloudState) => void> = [];
const emit = () => listeners.forEach(fn => fn(state));

export async function refreshCloud() {
  try {
    const [v24, v7, pairs, cursor] = await Promise.all([
      supabase.from("pair_volume_24h").select("*"),
      supabase.from("pair_volume_7d").select("*"),
      supabase.from("pairs_state").select("*"),
      supabase.from("indexer_cursor").select("last_block").eq("chain_id", INTEGRALAYER.chainId).maybeSingle(),
    ]);
    state.volume24h = {};
    (v24.data ?? []).forEach((r: any) => {
      state.volume24h[r.pair.toLowerCase()] = {
        pair: r.pair, volume0: Number(r.volume0 ?? 0), volume1: Number(r.volume1 ?? 0), swap_count: Number(r.swap_count ?? 0),
      };
    });
    state.volume7d = {};
    (v7.data ?? []).forEach((r: any) => {
      state.volume7d[r.pair.toLowerCase()] = {
        pair: r.pair, volume0: Number(r.volume0 ?? 0), volume1: Number(r.volume1 ?? 0), swap_count: Number(r.swap_count ?? 0),
      };
    });
    state.pairs = {};
    (pairs.data ?? []).forEach((r: any) => { state.pairs[r.pair.toLowerCase()] = r; });
    state.lastBlock = Number(cursor.data?.last_block ?? 0);
    state.lastSyncAt = Date.now();
    state.status = "ok";
    emit();
  } catch (e: any) {
    state.status = "error"; state.error = e?.message ?? String(e); emit();
  }
}

let pinging = false;
export async function pingIndexer() {
  if (pinging) return;
  pinging = true;
  state.status = "syncing"; emit();
  try {
    const { data, error } = await supabase.functions.invoke("indexer", { body: {} });
    if (error) throw error;
    state.scannedLastCall = Number(data?.scanned ?? 0);
    state.lastBlock = Number(data?.to ?? state.lastBlock);
    await refreshCloud();
  } catch (e: any) {
    state.status = "error"; state.error = e?.message ?? String(e); emit();
  } finally {
    pinging = false;
  }
}

let booted = false;
export function bootCloudIndex() {
  if (booted) return;
  booted = true;
  refreshCloud();
  pingIndexer();
  // Heartbeat every 30s while tab visible
  const tick = () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    pingIndexer();
  };
  setInterval(tick, 30_000);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") tick();
    });
  }
}

export const cloudIndex = {
  snapshot: () => state,
  subscribe: (fn: (s: CloudState) => void) => {
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
  },
  refresh: refreshCloud,
  ping: pingIndexer,
};

export function useCloudIndex() {
  const [, setTick] = useState(0);
  useEffect(() => cloudIndex.subscribe(() => setTick(t => t + 1)), []);
  return state;
}
