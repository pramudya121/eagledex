import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Gift, ExternalLink, History, Loader2 } from "lucide-react";
import { formatUnits } from "ethers";
import { useWeb3 } from "@/lib/web3";
import { explorerTx } from "@/lib/chain";
import { fetchUserFarmHistory, FarmEvent } from "@/lib/farmEvents";
import { FarmPool } from "@/lib/farm";

const KIND_META: Record<FarmEvent["kind"], { label: string; Icon: any; tone: string }> = {
  Deposit:           { label: "Stake",     Icon: ArrowDownToLine, tone: "text-emerald-400" },
  Withdraw:          { label: "Unstake",   Icon: ArrowUpFromLine, tone: "text-sky-400" },
  EmergencyWithdraw: { label: "Emergency", Icon: AlertTriangle,   tone: "text-red-400" },
  RewardPaid:        { label: "Harvest",   Icon: Gift,            tone: "text-yellow-400" },
};

export const FarmHistory = ({ pools, refreshKey }: { pools: FarmPool[]; refreshKey: number }) => {
  const { account, readProvider } = useWeb3();
  const [items, setItems] = useState<FarmEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account) { setItems([]); return; }
    let cancel = false;
    setLoading(true);
    fetchUserFarmHistory(readProvider, account)
      .then(rs => { if (!cancel) setItems(rs); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [account, readProvider, refreshKey]);

  if (!account) return null;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-primary"/>
        <h2 className="font-bold">Your farming history</h2>
        <span className="text-[11px] text-muted-foreground ml-1">(last ~50k blocks)</span>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-auto"/>}
      </div>

      {!items.length ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          {loading ? "Loading…" : "No farm activity yet."}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {items.map((e, i) => {
            const meta = KIND_META[e.kind];
            const pool = pools.find(p => p.pid === e.pid);
            const sym  = e.kind === "RewardPaid" ? (pool?.rewardSymbol ?? "?") : (pool?.stakingSymbol ?? "?");
            const dec  = e.kind === "RewardPaid" ? (pool?.rewardDecimals ?? 18) : (pool?.stakingDecimals ?? 18);
            const amt  = Number(formatUnits(e.amount, dec));
            return (
              <a key={`${e.txHash}-${i}`} href={explorerTx(e.txHash)} target="_blank" rel="noreferrer"
                 className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 hover:border-primary/40 px-3 py-2 transition-colors">
                <meta.Icon className={`w-4 h-4 ${meta.tone}`}/>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    {meta.label} <span className="text-[10px] text-muted-foreground font-mono">pid #{e.pid}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">block {e.blockNumber}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sm">{amt.toLocaleString(undefined,{maximumFractionDigits:6})}</div>
                  <div className="text-[10px] text-muted-foreground">{sym}</div>
                </div>
                <ExternalLink className="w-3 h-3 text-muted-foreground"/>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FarmHistory;
