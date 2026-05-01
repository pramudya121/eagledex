import { Contract, JsonRpcProvider, JsonRpcSigner } from "ethers";
import { CONTRACTS, TOKENS, NATIVE_TOKEN } from "./chain";
import { FAUCET_ABI, ERC20_ABI } from "./abis";

export type FaucetTokenInfo = {
  index: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
  claimAmount: bigint;
  maxClaims: bigint;
  faucetBalance: bigint;
  userClaimed: bigint;
  userLastClaimed: bigint; // unix seconds
};

/** Look up a token in the EAGLEDEX registry by address. WIRL maps to native logo/symbol. */
function registryLookup(addr: string) {
  const a = addr.toLowerCase();
  // WIRL (wrapped IRL) → display as WIRL with native IRL logo
  if (a === CONTRACTS.WETH.toLowerCase()) {
    return { symbol: "WIRL", name: "Wrapped IRL", decimals: 18, logo: NATIVE_TOKEN.logo };
  }
  const t = TOKENS.find(x => x.address.toLowerCase() === a);
  return t ? { symbol: t.symbol, name: t.name, decimals: t.decimals, logo: t.logo } : null;
}

export function getFaucet(runner: JsonRpcProvider | JsonRpcSigner) {
  return new Contract(CONTRACTS.FAUCET, FAUCET_ABI, runner);
}

const meta = new Map<string, { symbol: string; name: string; decimals: number; logo: string }>();
async function tokenMeta(addr: string, p: JsonRpcProvider) {
  const k = addr.toLowerCase();
  if (meta.has(k)) return meta.get(k)!;
  // Prefer EAGLEDEX registry (gives proper logo + WIRL relabeling) before hitting RPC.
  const reg = registryLookup(addr);
  if (reg) { meta.set(k, reg); return reg; }
  try {
    const c = new Contract(addr, ERC20_ABI, p);
    const [s, n, d] = await Promise.all([c.symbol(), c.name().catch(() => ""), c.decimals()]);
    const rawSym = String(s);
    const sym = rawSym.toUpperCase() === "WETH" ? "WIRL" : rawSym;
    const m = { symbol: sym, name: String(n || sym), decimals: Number(d), logo: "" };
    meta.set(k, m); return m;
  } catch {
    const m = { symbol: addr.slice(0, 6), name: addr, decimals: 18, logo: "" };
    meta.set(k, m); return m;
  }
}

const ZERO = "0x0000000000000000000000000000000000000000";

/** Probe tokens(0..max-1). Stops at the first revert OR zero-address slot. */
export async function readFaucetTokens(
  c: Contract,
  provider: JsonRpcProvider,
  user: string | null,
  max = 16,
): Promise<FaucetTokenInfo[]> {
  const out: FaucetTokenInfo[] = [];
  for (let i = 0; i < max; i++) {
    let addr: string;
    try { addr = await c.tokens(i); } catch { break; }
    if (!addr || addr === ZERO) break;
    const [m, claimAmount, maxClaims, faucetBalance, userClaimed, userLastClaimed] = await Promise.all([
      tokenMeta(addr, provider),
      c.claimAmounts(i).catch(() => 0n),
      c.maxClaims(i).catch(() => 0n),
      new Contract(addr, ERC20_ABI, provider).balanceOf(CONTRACTS.FAUCET).catch(() => 0n),
      user ? c.userClaimCount(user, i).catch(() => 0n) : Promise.resolve(0n),
      user ? c.lastClaimed(user, i).catch(() => 0n) : Promise.resolve(0n),
    ]);
    out.push({
      index: i, address: addr,
      symbol: m.symbol, name: m.name, decimals: m.decimals, logo: m.logo,
      claimAmount, maxClaims, faucetBalance, userClaimed, userLastClaimed,
    });
  }
  return out;
}

export function nextClaimAt(lastClaimedSec: bigint, cooldownSec: bigint): number {
  if (lastClaimedSec === 0n) return 0;
  return Number(lastClaimedSec + cooldownSec) * 1000;
}
