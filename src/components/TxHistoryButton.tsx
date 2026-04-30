import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useTxHistory, txExplorer, txStore, TxStatus } from "@/lib/txStore";
import { Activity, CheckCircle2, XCircle, Loader2, ExternalLink, Trash2 } from "lucide-react";

const StatusIcon = ({ s }: { s: TxStatus }) =>
  s === "pending" ? <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
  : s === "confirmed" ? <CheckCircle2 className="w-4 h-4 text-green-400" />
  : <XCircle className="w-4 h-4 text-destructive" />;

const StatusBadge = ({ s }: { s: TxStatus }) => {
  const cls = s === "pending" ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
    : s === "confirmed" ? "bg-green-500/15 text-green-300 border-green-500/30"
    : "bg-destructive/15 text-destructive border-destructive/30";
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>{s}</span>;
};

const TxHistoryButton = () => {
  const list = useTxHistory();
  const [open, setOpen] = useState(false);
  const pending = list.filter(t => t.status === "pending").length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="relative p-2 rounded-xl bg-secondary/60 border border-border hover:border-primary transition" aria-label="Transactions">
          <Activity className="w-4 h-4" />
          {pending > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 text-black text-[10px] font-bold grid place-items-center animate-pulse">{pending}</span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="glass border-border w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Transactions</span>
            {list.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => txStore.clear()} className="text-xs h-7">
                <Trash2 className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)] pr-1">
          {list.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No transactions yet. Your swaps, liquidity actions and pair creations will appear here.
            </div>
          )}
          {list.map(t => (
            <div key={t.id} className="rounded-xl border border-border bg-secondary/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="mt-0.5"><StatusIcon s={t.status} /></div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{t.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(t.startedAt).toLocaleTimeString()}
                      {t.blockNumber && ` · Block ${t.blockNumber}`}
                    </div>
                  </div>
                </div>
                <StatusBadge s={t.status} />
              </div>
              {t.error && <div className="mt-2 text-[11px] text-destructive break-words">{t.error}</div>}
              {t.hash && (
                <a href={txExplorer(t.hash)} target="_blank" rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  {t.hash.slice(0, 10)}…{t.hash.slice(-6)} <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TxHistoryButton;
