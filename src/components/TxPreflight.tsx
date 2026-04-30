import { GasEstimate, formatFee } from "@/lib/gas";
import { AlertTriangle, Flame, Info, ShieldAlert } from "lucide-react";

interface Props {
  est: GasEstimate | null;
  loading?: boolean;
  symbol: string;                         // native symbol for fee display
  warnings?: string[];                    // additional soft warnings (deadline, slippage, etc.)
  className?: string;
}

const TxPreflight = ({ est, loading, symbol, warnings = [], className = "" }: Props) => {
  if (!est && !loading && !warnings.length) return null;
  return (
    <div className={`rounded-xl form-field-inset p-3 space-y-2 text-xs animate-fade-in ${className}`}>
      <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-primary">
        <Flame className="w-3.5 h-3.5" /> Pre-flight check
      </div>
      {loading && <div className="text-muted-foreground flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"/> Simulating transaction…</div>}

      {est && est.ok && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono">
          <span className="text-muted-foreground">Gas (estimate)</span>
          <span className="text-right">{est.gasLimit?.toLocaleString()} </span>
          <span className="text-muted-foreground">Gas (+20% buffer)</span>
          <span className="text-right text-foreground font-semibold">{est.gasLimitWithBuffer?.toLocaleString()}</span>
          <span className="text-muted-foreground">Gas price</span>
          <span className="text-right">{est.gasPriceGwei ?? "—"} gwei</span>
          <span className="text-muted-foreground">Network fee</span>
          <span className="text-right text-grad font-bold">{formatFee(est.feeWei)} {symbol}</span>
        </div>
      )}

      {est && !est.ok && est.revertReason && (
        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold mb-0.5">Transaction would revert</div>
            <div className="break-words">{est.revertReason}</div>
          </div>
        </div>
      )}

      {est?.warning && (
        <div className="flex items-start gap-1.5 text-yellow-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {est.warning}
        </div>
      )}

      {warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-1.5 text-yellow-300">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
        </div>
      ))}
    </div>
  );
};

export default TxPreflight;