import { Contract, JsonRpcProvider, JsonRpcSigner } from "ethers";
import { CONTRACTS, TOKENS } from "./chain";
import { FARM_ABI, ERC20_ABI } from "./abis";

export type PoolInfoRaw = {
  stakingToken: string;
  rewardToken: string;
  lastRewardBlock: bigint;
  accRewardPerShare: bigint;
  rewardPerBlock: bigint;
  totalStaked: bigint;
};

export type FarmPool = PoolInfoRaw & {
  pid: number;
  stakingSymbol: string;
  stakingDecimals: number;
  rewardSymbol: string;
  rewardDecimals: number;
  rewardReserve?: bigint;       // reward-token balance held by the farm contract
  pending?: bigint;
  userStaked?: bigint;
  userRewardDebt?: bigint;
  userAllowance?: bigint;
  userBalance?: bigint;
};

export function getFarm(runner: JsonRpcProvider | JsonRpcSigner) {
  return new Contract(CONTRACTS.FARM, FARM_ABI, runner);
}

export async function readPoolInfo(c: Contract, pid: number): Promise<PoolInfoRaw | null> {
  try {
    const r = await c.poolInfo(pid);
    return {
      stakingToken: r.stakingToken ?? r[0],
      rewardToken: r.rewardToken ?? r[1],
      lastRewardBlock: r.lastRewardBlock ?? r[2],
      accRewardPerShare: r.accRewardPerShare ?? r[3],
      rewardPerBlock: r.rewardPerBlock ?? r[4],
      totalStaked: r.totalStaked ?? r[5],
    };
  } catch {
    return null;
  }
}

/** Read all pools by probing pid 0..N until poolInfo reverts. */
export async function readAllPools(c: Contract, max = 32): Promise<PoolInfoRaw[]> {
  const out: PoolInfoRaw[] = [];
  for (let i = 0; i < max; i++) {
    const info = await readPoolInfo(c, i);
    if (!info) break;
    out.push(info);
  }
  return out;
}

const tokMetaCache = new Map<string, { symbol: string; decimals: number }>();
function registrySymbol(addr: string): { symbol: string; decimals: number } | null {
  const a = addr.toLowerCase();
  if (a === CONTRACTS.WETH.toLowerCase()) return { symbol: "WSVP", decimals: 18 };
  const t = TOKENS.find(x => x.address.toLowerCase() === a);
  return t ? { symbol: t.symbol, decimals: t.decimals } : null;
}
export async function readTokenMeta(addr: string, runner: JsonRpcProvider) {
  const key = addr.toLowerCase();
  if (tokMetaCache.has(key)) return tokMetaCache.get(key)!;
  const reg = registrySymbol(addr);
  if (reg) { tokMetaCache.set(key, reg); return reg; }
  try {
    const c = new Contract(addr, ERC20_ABI, runner);
    const [symbol, decimals] = await Promise.all([c.symbol(), c.decimals()]);
    const raw = String(symbol);
    const m = { symbol: raw.toUpperCase() === "WETH" ? "WSVP" : raw, decimals: Number(decimals) };
    tokMetaCache.set(key, m);
    return m;
  } catch {
    const m = { symbol: addr.slice(0, 6), decimals: 18 };
    tokMetaCache.set(key, m);
    return m;
  }
}

const ACC_PRECISION = 10n ** 12n;

/**
 * Mirrors the contract's pendingReward() math so the UI can tick rewards
 * forward between RPC calls without spamming the node.
 *
 *   acc = pool.accRewardPerShare
 *   if (block > lastRewardBlock && totalStaked > 0):
 *       acc += (block - lastRewardBlock) * rewardPerBlock * 1e12 / totalStaked
 *   pending = user.amount * acc / 1e12 - user.rewardDebt
 */
export function computePendingLocal(p: FarmPool, currentBlock: bigint): bigint {
  if (!p.userStaked || p.userStaked === 0n) return p.pending ?? 0n;
  let acc = p.accRewardPerShare;
  if (currentBlock > p.lastRewardBlock && p.totalStaked > 0n) {
    const blocks = currentBlock - p.lastRewardBlock;
    acc = acc + (blocks * p.rewardPerBlock * ACC_PRECISION) / p.totalStaked;
  }
  const debt = p.userRewardDebt ?? 0n;
  const pending = (p.userStaked * acc) / ACC_PRECISION - debt;
  return pending > 0n ? pending : 0n;
}
