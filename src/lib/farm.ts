import { Contract, JsonRpcProvider, JsonRpcSigner } from "ethers";
import { CONTRACTS } from "./chain";
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
  pending?: bigint;
  userStaked?: bigint;
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
export async function readTokenMeta(addr: string, runner: JsonRpcProvider) {
  const key = addr.toLowerCase();
  if (tokMetaCache.has(key)) return tokMetaCache.get(key)!;
  try {
    const c = new Contract(addr, ERC20_ABI, runner);
    const [symbol, decimals] = await Promise.all([c.symbol(), c.decimals()]);
    const m = { symbol: String(symbol), decimals: Number(decimals) };
    tokMetaCache.set(key, m);
    return m;
  } catch {
    const m = { symbol: addr.slice(0, 6), decimals: 18 };
    tokMetaCache.set(key, m);
    return m;
  }
}