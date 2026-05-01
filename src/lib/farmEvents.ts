import { Contract, JsonRpcProvider, EventLog, Log } from "ethers";
import { CONTRACTS } from "./chain";
import { FARM_ABI } from "./abis";

export type FarmEventKind = "Deposit" | "Withdraw" | "EmergencyWithdraw" | "RewardPaid";

export type FarmEvent = {
  kind: FarmEventKind;
  pid: number;
  user: string;
  amount: bigint;
  blockNumber: number;
  txHash: string;
  ts?: number;
};

const LOOKBACK_BLOCKS = 50_000;

/** Fetch recent events for a user across all pools. */
export async function fetchUserFarmHistory(
  provider: JsonRpcProvider,
  user: string,
  lookback = LOOKBACK_BLOCKS,
): Promise<FarmEvent[]> {
  const c = new Contract(CONTRACTS.FARM, FARM_ABI, provider);
  const head = await provider.getBlockNumber();
  const from = Math.max(0, head - lookback);
  const filters = [
    { kind: "Deposit" as const, f: c.filters.Deposit(user) },
    { kind: "Withdraw" as const, f: c.filters.Withdraw(user) },
    { kind: "EmergencyWithdraw" as const, f: c.filters.EmergencyWithdraw(user) },
    { kind: "RewardPaid" as const, f: c.filters.RewardPaid(user) },
  ];
  const all: FarmEvent[] = [];
  await Promise.all(
    filters.map(async ({ kind, f }) => {
      try {
        const logs = (await c.queryFilter(f, from, head)) as EventLog[];
        for (const l of logs) {
          const args = l.args as any;
          all.push({
            kind,
            user,
            pid: Number(args.pid ?? args[1]),
            amount: BigInt(args.amount ?? args[2] ?? 0),
            blockNumber: l.blockNumber,
            txHash: l.transactionHash,
          });
        }
      } catch {}
    }),
  );
  all.sort((a, b) => b.blockNumber - a.blockNumber);
  return all.slice(0, 100);
}

/**
 * Subscribe to ALL relevant farm events.
 * onChange receives the event kind, pid, and the user address from the event,
 * so the UI can decide whether the change concerns the connected wallet.
 */
export function subscribeFarmEvents(
  provider: JsonRpcProvider,
  onChange: (kind: FarmEventKind, pid: number, user: string, amount: bigint, txHash: string) => void,
): () => void {
  const c = new Contract(CONTRACTS.FARM, FARM_ABI, provider);
  const handlers: Array<[FarmEventKind, (...a: any[]) => void]> = [
    ["Deposit",           (user, pid, amount, ev) => onChange("Deposit",           Number(pid), String(user), BigInt(amount ?? 0), ev?.log?.transactionHash ?? "")],
    ["Withdraw",          (user, pid, amount, ev) => onChange("Withdraw",          Number(pid), String(user), BigInt(amount ?? 0), ev?.log?.transactionHash ?? "")],
    ["EmergencyWithdraw", (user, pid, amount, ev) => onChange("EmergencyWithdraw", Number(pid), String(user), BigInt(amount ?? 0), ev?.log?.transactionHash ?? "")],
    ["RewardPaid",        (user, pid, amount, ev) => onChange("RewardPaid",        Number(pid), String(user), BigInt(amount ?? 0), ev?.log?.transactionHash ?? "")],
  ];
  for (const [name, fn] of handlers) {
    try { c.on(name, fn); } catch {}
  }
  return () => {
    for (const [name, fn] of handlers) {
      try { c.off(name, fn); } catch {}
    }
  };
}

/**
 * Read just one pool's user-facing slice (pending, userInfo, balances) — used
 * after we receive a relevant event so we can refresh that one pool quickly
 * instead of reloading every pool.
 */
export async function refetchPoolForUser(
  provider: JsonRpcProvider,
  pid: number,
  user: string,
) {
  const c = new Contract(CONTRACTS.FARM, FARM_ABI, provider);
  const [pool, ui, pending] = await Promise.all([
    c.poolInfo(pid),
    c.userInfo(pid, user),
    c.pendingReward(pid, user),
  ]);
  return {
    pid,
    accRewardPerShare: pool.accRewardPerShare ?? pool[3],
    lastRewardBlock:   pool.lastRewardBlock ?? pool[2],
    rewardPerBlock:    pool.rewardPerBlock ?? pool[4],
    totalStaked:       pool.totalStaked ?? pool[5],
    userStaked:        ui.amount ?? ui[0],
    userRewardDebt:    ui.rewardDebt ?? ui[1],
    pending:           pending as bigint,
  };
}
