// EAGLEDEX Launchpad — on-chain reads + Cloud metadata helpers.
import { Contract, JsonRpcProvider, JsonRpcSigner, formatUnits } from "ethers";
import { CONTRACTS, INTEGRALAYER, NATIVE_TOKEN } from "./chain";
import { LAUNCHPAD_FACTORY_ABI, BONDING_CURVE_ABI } from "./launchpadAbis";
import { ERC20_ABI } from "./abis";
import { supabase } from "@/integrations/supabase/client";

export const CHAIN_ID = INTEGRALAYER.chainId;
export const NATIVE_SYMBOL = NATIVE_TOKEN.symbol;

export type LaunchMeta = {
  token_address: string;
  curve_address: string | null;
  creator: string;
  name: string;
  symbol: string;
  description: string | null;
  logo_path: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  total_supply: number | null;
  decimals: number;
  verified: boolean;
  views: number;
  created_at: string;
};

export type LaunchToken = LaunchMeta & {
  logoUrl?: string | null;
  priceNative?: number | null;
  progress?: number | null;     // 0..100
  liquidity?: number | null;    // in native
  graduated?: boolean;
  change24h?: number | null;
  volume24h?: number | null;
  marketCap?: number | null;
};

export const launchpadEnabled = () => !!CONTRACTS.LAUNCHPAD_FACTORY;

export function getLaunchFactory(runner: JsonRpcProvider | JsonRpcSigner) {
  return new Contract(CONTRACTS.LAUNCHPAD_FACTORY, LAUNCHPAD_FACTORY_ABI, runner);
}
export function getCurve(addr: string, runner: JsonRpcProvider | JsonRpcSigner) {
  return new Contract(addr, BONDING_CURVE_ABI, runner);
}

/* ---------------- Cloud metadata ---------------- */

const logoCache = new Map<string, string>();

/** Signed URL for a logo stored in the private `token-logos` bucket. */
export async function logoUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  if (logoCache.has(path)) return logoCache.get(path)!;
  const { data } = await supabase.storage.from("token-logos").createSignedUrl(path, 60 * 60 * 24);
  if (data?.signedUrl) { logoCache.set(path, data.signedUrl); return data.signedUrl; }
  return null;
}

export async function uploadLogo(file: File, symbol: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${CHAIN_ID}/${symbol.toLowerCase()}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("token-logos").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function listLaunchTokens(): Promise<LaunchToken[]> {
  const { data, error } = await supabase
    .from("launch_tokens").select("*")
    .eq("chain_id", CHAIN_ID)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  const rows = (data ?? []) as unknown as LaunchMeta[];
  return Promise.all(rows.map(async r => ({ ...r, logoUrl: await logoUrl(r.logo_path) })));
}

export async function getLaunchToken(address: string): Promise<LaunchToken | null> {
  const { data } = await supabase
    .from("launch_tokens").select("*")
    .eq("chain_id", CHAIN_ID)
    .ilike("token_address", address)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as LaunchMeta;
  return { ...r, logoUrl: await logoUrl(r.logo_path) };
}

export async function saveLaunchToken(row: Partial<LaunchMeta> & { token_address: string; creator: string; name: string; symbol: string; tx_hash?: string }) {
  const { error } = await supabase.from("launch_tokens").insert({ ...row, chain_id: CHAIN_ID } as never);
  if (error) throw error;
}

/* ---------------- Trades (realtime chart source) ---------------- */

export type Trade = {
  id: string; price: number; amount: number; eth_amount: number | null;
  side: "buy" | "sell"; trader: string | null; tx_hash: string | null; created_at: string;
};

export async function listTrades(token: string, limit = 1000): Promise<Trade[]> {
  const { data } = await supabase
    .from("token_trades").select("*")
    .eq("chain_id", CHAIN_ID).ilike("token_address", token)
    .order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as unknown as Trade[]).slice().reverse();
}

export async function recordTrade(token: string, t: { price: number; amount: number; eth_amount?: number; side: "buy" | "sell"; trader?: string; tx_hash?: string }) {
  await supabase.from("token_trades").insert({
    chain_id: CHAIN_ID, token_address: token.toLowerCase(),
    price: t.price, amount: t.amount, eth_amount: t.eth_amount ?? null,
    side: t.side, trader: t.trader ?? null, tx_hash: t.tx_hash ?? null,
  } as never);
}

/** Aggregate trades into OHLCV candles for a timeframe (seconds per bucket). */
export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
export function toCandles(trades: Trade[], bucketSec: number): Candle[] {
  const out: Candle[] = [];
  for (const t of trades) {
    const ts = Math.floor(new Date(t.created_at).getTime() / 1000 / bucketSec) * bucketSec;
    const p = Number(t.price);
    const v = Number(t.amount) || 0;
    const last = out[out.length - 1];
    if (last && last.time === ts) {
      last.high = Math.max(last.high, p);
      last.low = Math.min(last.low, p);
      last.close = p;
      last.volume += v;
    } else {
      out.push({ time: ts, open: p, high: p, low: p, close: p, volume: v });
    }
  }
  return out;
}

export function statsFromTrades(trades: Trade[]) {
  const now = Date.now();
  const dayAgo = now - 86_400_000;
  const recent = trades.filter(t => new Date(t.created_at).getTime() >= dayAgo);
  const price = trades.length ? Number(trades[trades.length - 1].price) : null;
  const first24 = recent.length ? Number(recent[0].price) : null;
  const change24h = price != null && first24 ? ((price - first24) / first24) * 100 : null;
  const volume24h = recent.reduce((a, t) => a + (Number(t.eth_amount) || 0), 0);
  return { price, change24h, volume24h, trades24h: recent.length };
}

/* ---------------- On-chain curve state (defensive) ---------------- */

export type CurveState = {
  available: boolean;
  graduated?: boolean;
  priceNative?: number;
  progress?: number;
  liquidityNative?: number;
};

async function tryCall<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try { return await fn(); } catch { return undefined; }
}

export async function readCurveState(curveAddr: string, p: JsonRpcProvider): Promise<CurveState> {
  if (!curveAddr) return { available: false };
  const c = getCurve(curveAddr, p);
  const [price, graduated, realTok, virtTok, realEth] = await Promise.all([
    tryCall(() => c.getCurrentPrice() as Promise<bigint>),
    tryCall(() => c.graduated() as Promise<boolean>),
    tryCall(() => c.realTokenReserves() as Promise<bigint>),
    tryCall(() => c.virtualTokenReserves() as Promise<bigint>),
    tryCall(() => c.realEthReserves() as Promise<bigint>),
  ]);
  const bal = await tryCall(() => p.getBalance(curveAddr));
  const progress = realTok != null && virtTok != null && virtTok > 0n
    ? Math.max(0, Math.min(100, 100 - Number((realTok * 10000n) / virtTok) / 100))
    : undefined;
  const liq = realEth ?? bal;
  return {
    available: price != null || realEth != null || bal != null,
    graduated,
    priceNative: price != null ? Number(formatUnits(price, 18)) : undefined,
    progress,
    liquidityNative: liq != null ? Number(formatUnits(liq, 18)) : undefined,
  };
}

/** Read factory-registered launches straight from chain (source of truth). */
export async function readOnchainLaunches(p: JsonRpcProvider, max = 60) {
  const f = getLaunchFactory(p);
  const len = Number(await f.getAllTokensLength());
  const start = Math.max(0, len - max);
  const out: { token: string; curve: string; creator: string; createdAt: number; name?: string; symbol?: string }[] = [];
  for (let i = len - 1; i >= start; i--) {
    const r: any = await tryCall(() => f.allTokens(i));
    if (!r) continue;
    const token = r[0] as string, curve = r[1] as string;
    const erc = new Contract(token, ERC20_ABI, p);
    const [name, symbol] = await Promise.all([
      tryCall(() => erc.name() as Promise<string>),
      tryCall(() => erc.symbol() as Promise<string>),
    ]);
    out.push({ token, curve, creator: r[2], createdAt: Number(r[3]), name, symbol });
  }
  return out;
}

export async function readCreationFee(p: JsonRpcProvider): Promise<bigint> {
  const f = getLaunchFactory(p);
  return (await tryCall(() => f.creationFee() as Promise<bigint>)) ?? 0n;
}
