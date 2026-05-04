// Sticky compact transaction status indicator in the header.
// Shows pending count + most recent tx with explorer link.
import { useMemo, useState } from "react";
import { Activity, CheckCircle2, ExternalLink, Loader2, XCircle, Trash2 } from "lucide-react";
import { useTxHistory, txStore, txExplorer, TxRecord } from "@/lib/txStore";

const StatusIcon = ({ s }: { s: TxRecord["status"] }) =>
  s === "pending" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
  : s === "confirmed" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
  : <XCircle className="w-3.5 h-3.5 text-destructive" />;

const TxStatusBar = () => {
  const list = useTxHistory();
  const [open, setOpen] = useState(false);
  const pending = useMemo(() => list.filter(t => t.status === "pending").length, [list]);
  const latest = list[0];

  if (list.length === 0) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
          pending > 0 ? "border-primary/60 bg-primary/10 text-primary animate-pulse"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
        }`}>
        {pending > 0 ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Activity className="w-3.5 h-3.5"/>}
        {pending > 0 ? `${pending} pending` : "Tx"}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
          <div className="absolute right-0 mt-2 w-80 z-50 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl p-2 animate-fade-in">
            <div className="flex items-center justify-between px-2 py-1.5 mb-1">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent transactions</div>
              <button onClick={() => { txStore.clear(); setOpen(false); }}
                className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1">
                <Trash2 className="w-3 h-3"/> Clear
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {list.slice(0, 20).map(t => (
                <div key={t.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-secondary/50">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <StatusIcon s={t.status}/>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">{t.label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {t.status === "pending" ? "Awaiting confirmation"
                          : t.status === "confirmed" ? `Block ${t.blockNumber ?? "?"}`
                          : (t.error?.slice(0, 40) ?? "Failed")}
                      </div>
                    </div>
                  </div>
                  {t.hash && (
                    <a href={txExplorer(t.hash)} target="_blank" rel="noreferrer"
                      className="p-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition">
                      <ExternalLink className="w-3 h-3"/>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TxStatusBar;
