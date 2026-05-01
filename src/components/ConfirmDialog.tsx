import { ReactNode } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

export const ConfirmDialog = ({
  open, title, description, details, danger, busy, confirmLabel = "Confirm", onCancel, onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  details?: ReactNode;
  danger?: boolean;
  busy?: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in" onClick={onCancel}>
      <div className={`glass rounded-3xl p-6 w-full max-w-md border ${danger ? "border-red-500/40" : "border-primary/30"}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${danger ? "bg-red-500/15 text-red-400" : "btn-primary-grad text-primary-foreground"}`}>
            <AlertTriangle className="w-5 h-5"/>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-lg leading-tight">{title}</h3>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4"/></button>
        </div>

        {details && (
          <div className="rounded-xl border border-border bg-card/60 p-3 text-xs space-y-1.5 font-mono mb-4">
            {details}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onCancel} disabled={busy}
            className="flex-1 h-11 rounded-xl bg-card border border-border hover:border-primary text-sm font-semibold disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            className={`flex-1 h-11 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 ${
              danger
                ? "bg-red-500/15 border border-red-500/50 text-red-300 hover:bg-red-500/25"
                : "btn-primary-grad text-primary-foreground"
            }`}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
