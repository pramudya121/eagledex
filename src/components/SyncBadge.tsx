import { usePoolIndex, getSyncStatus, getDataSource } from "@/lib/poolIndex";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Radio, Repeat, Database, WifiOff } from "lucide-react";

const SyncBadge = ({ className = "" }: { className?: string }) => {
  const s = usePoolIndex();
  const sync = getSyncStatus(s);
  const src = getDataSource(s);
  const color =
    sync.status === "synced"   ? "border-green-500/30 bg-green-500/10 text-green-400" :
    sync.status === "lagging"  ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" :
                                 "border-destructive/30 bg-destructive/10 text-destructive";
  const dot =
    sync.status === "synced"  ? "bg-green-500" :
    sync.status === "lagging" ? "bg-yellow-400" :
                                "bg-destructive";
  const SrcIcon =
    src.source === "events"   ? Radio :
    src.source === "rpc-poll" ? Repeat :
    src.source === "cache"    ? Database :
                                WifiOff;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border cursor-help ${color} ${className}`}>
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dot}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${dot}`}></span>
          </span>
          {sync.label}
          <SrcIcon className="w-3 h-3 opacity-80" />
          {s.headBlock > 0 && <span className="opacity-70 font-mono">#{s.syncedBlock || s.headBlock}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs max-w-[260px]">
        <div className="font-bold mb-1 flex items-center gap-1.5"><SrcIcon className="w-3.5 h-3.5"/> Data source: {src.label}</div>
        <div className="text-muted-foreground">{src.detail}</div>
        <div className="mt-1.5 pt-1.5 border-t border-border/40 grid grid-cols-2 gap-x-2 font-mono">
          <span className="text-muted-foreground">Head</span><span>#{s.headBlock || "—"}</span>
          <span className="text-muted-foreground">Synced</span><span>#{s.syncedBlock || "—"}</span>
          <span className="text-muted-foreground">Events</span><span>{s.eventCount}</span>
          <span className="text-muted-foreground">Polls</span><span>{s.pollCount}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default SyncBadge;
