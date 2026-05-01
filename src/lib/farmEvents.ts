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

/** Subscribe to ALL relevant farm events; calls onChange whenever something happens. */
export function subscribeFarmEvents(
  provider: JsonRpcProvider,
  onChange: (kind: FarmEventKind, pid: number, user: string) => void,
): () => void {
  const c = new Contract(CONTRACTS.FARM, FARM_ABI, provider);
  const handlers: Array<[FarmEventKind, (...a: any[]) => void]> = [
    ["Deposit", (user, pid) => onChange("Deposit", Number(pid), String(user))],
    ["Withdraw", (user, pid) => onChange("Withdraw", Number(pid), String(user))],
    ["EmergencyWithdraw", (user, pid) => onChange("EmergencyWithdraw", Number(pid), String(user))],
    ["RewardPaid", (user, pid) => onChange("RewardPaid", Number(pid), String(user))],
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
