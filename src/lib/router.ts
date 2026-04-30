// Smart routing for EAGLEDEX.
// Tries direct A→B, then 1-hop A→HUB→B for every known liquid hub,
// then 2-hop A→H1→H2→B for the highest-liquidity hubs.
// Returns the best route by output amount, plus per-hop price-impact and slippage contribution.
import { Contract } from "ethers";
import { CONTRACTS, TOKENS } from "./chain";
import { ROUTER_ABI } from "./abis";
import { poolIndex, poolTVL } from "./poolIndex";

export interface HopDetail {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  priceBefore: number;          // spot price out/in (pre-trade)
  priceAfter: number;           // effective execution price out/in
  impactBps: number;            // (before - after)/before in bps, clamped >= 0
  slippageContribBps: number;   // share of total route impact attributable to this hop (bps of total impact)
}

export interface RouteQuote {
  path: string[];          // token addresses in route
  amounts: bigint[];       // amounts at each hop
  amountOut: bigint;
  hops: number;
  midPrice?: bigint;
  priceImpactBps?: number;       // total price impact in bps
  hopDetails?: HopDetail[];
  alternatives?: { path: string[]; amountOut: bigint; hops: number }[]; // for UI
}

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Auto-pick liquid hub tokens: WIRL + top-TVL tokens that appear in many pools. */
function discoverHubs(tokenIn: string, tokenOut: string): string[] {
  const state = poolIndex.snapshot();
  const tally = new Map<string, number>(); // addr -> sum TVL across pools it's in
  const pools = Object.values(state.pools) as import("./poolIndex").IndexedPool[];
  for (const p of pools) {
    const tvl = poolTVL(p);
    tally.set(p.token0.toLowerCase(), (tally.get(p.token0.toLowerCase()) ?? 0) + tvl);
    tally.set(p.token1.toLowerCase(), (tally.get(p.token1.toLowerCase()) ?? 0) + tvl);
  }
  const ranked = [...tally.entries()]
    .filter(([a]) => !eq(a, tokenIn) && !eq(a, tokenOut))
    .sort((a, b) => b[1] - a[1])
    .map(([a]) => a);

  const hubs = new Set<string>();
  // WIRL is always a hub if not endpoint
  if (!eq(CONTRACTS.WETH, tokenIn) && !eq(CONTRACTS.WETH, tokenOut)) hubs.add(CONTRACTS.WETH.toLowerCase());
  // Add top-3 liquid intermediaries
  for (const a of ranked.slice(0, 3)) hubs.add(a);
  // Fallback: include any TOKENS-listed token that has any pool, capped to 4 total hubs
  for (const t of TOKENS) {
    if (hubs.size >= 4) break;
    if (t.isNative) continue;
    const k = t.address.toLowerCase();
    if (eq(k, tokenIn) || eq(k, tokenOut)) continue;
    if (tally.has(k)) hubs.add(k);
  }
  return [...hubs];
}

async function tryQuote(router: Contract, path: string[], amountIn: bigint): Promise<RouteQuote | null> {
  try {
    const amounts: bigint[] = await router.getAmountsOut(amountIn, path);
    if (!amounts.length) return null;
    return {
      path,
      amounts,
      amountOut: amounts[amounts.length - 1],
      hops: path.length - 1,
    };
  } catch {
    return null;
  }
}

/**
 * Find the best route from tokenIn → tokenOut for amountIn.
 * Returns null if no path has any liquidity.
 */
export async function findBestRoute(
  router: Contract,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
): Promise<RouteQuote | null> {
  if (amountIn <= 0n) return null;
  if (eq(tokenIn, tokenOut)) return null;

  const hubs = discoverHubs(tokenIn, tokenOut);

  const candidates: string[][] = [[tokenIn, tokenOut]];
  // 1-hop
  for (const h of hubs) candidates.push([tokenIn, h, tokenOut]);
  // 2-hop (only between top hubs to limit RPC cost)
  const topHubs = hubs.slice(0, 3);
  for (const h1 of topHubs) for (const h2 of topHubs) {
    if (eq(h1, h2)) continue;
    candidates.push([tokenIn, h1, h2, tokenOut]);
  }

  const results = await Promise.all(candidates.map(p => tryQuote(router, p, amountIn)));
  const valid = results.filter(Boolean) as RouteQuote[];
  if (!valid.length) return null;

  // Best = highest output. Fewer hops wins ties.
  valid.sort((a, b) => {
    if (a.amountOut === b.amountOut) return a.hops - b.hops;
    return a.amountOut > b.amountOut ? -1 : 1;
  });
  const best = valid[0];
  best.alternatives = valid.slice(1, 4).map(v => ({ path: v.path, amountOut: v.amountOut, hops: v.hops }));

  // Price-impact (whole route): compare swap rate vs spot rate using a tiny probe.
  try {
    const probeIn = 10n ** 12n;
    const spot = await router.getAmountsOut(probeIn, best.path).catch(() => null) as bigint[] | null;
    if (spot && spot.length) {
      const spotOut = spot[spot.length - 1];
      const expected = (amountIn * spotOut) / probeIn;
      if (expected > 0n) {
        const diff = expected > best.amountOut ? expected - best.amountOut : 0n;
        best.priceImpactBps = Number((diff * 10_000n) / expected);
      }
    }
  } catch {}

  // Per-hop details: spot (before) vs effective (after) price for each hop.
  try {
    const probeIn = 10n ** 12n;
    const details: HopDetail[] = [];
    for (let i = 0; i < best.path.length - 1; i++) {
      const hopPath = [best.path[i], best.path[i + 1]];
      const inAmt = best.amounts[i];
      const outAmt = best.amounts[i + 1];
      let priceBefore = 0;
      try {
        const spot = await router.getAmountsOut(probeIn, hopPath) as bigint[];
        if (spot?.length === 2 && spot[0] > 0n) {
          priceBefore = Number(spot[1]) / Number(spot[0]);
        }
      } catch {}
      const priceAfter = inAmt > 0n ? Number(outAmt) / Number(inAmt) : 0;
      const impactBps = priceBefore > 0
        ? Math.max(0, Math.round(((priceBefore - priceAfter) / priceBefore) * 10_000))
        : 0;
      details.push({
        tokenIn: best.path[i],
        tokenOut: best.path[i + 1],
        amountIn: inAmt,
        amountOut: outAmt,
        priceBefore,
        priceAfter,
        impactBps,
        slippageContribBps: 0, // filled below
      });
    }
    // Distribute total impact contribution across hops based on each hop's impact share.
    const sumImpact = details.reduce((a, d) => a + d.impactBps, 0);
    for (const d of details) {
      d.slippageContribBps = sumImpact > 0 ? Math.round((d.impactBps / sumImpact) * 10_000) : 0;
    }
    best.hopDetails = details;
  } catch {}

  return best;
}

export const routeLabel = (path: string[], symbolOf: (addr: string) => string) =>
  path.map(symbolOf).join(" → ");

export const impactSeverity = (bps: number | undefined): "ok" | "warn" | "danger" => {
  if (bps == null) return "ok";
  if (bps >= 1000) return "danger";
  if (bps >= 300) return "warn";
  return "ok";
};
