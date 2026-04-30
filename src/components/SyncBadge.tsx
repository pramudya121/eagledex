import { usePoolIndex, getSyncStatus } from "@/lib/poolIndex";

const SyncBadge = ({ className = "" }: { className?: string }) => {
  const s = usePoolIndex();
  const sync = getSyncStatus(s);
  const color =
    sync.status === "synced"   ? "border-green-500/30 bg-green-500/10 text-green-400" :
    sync.status === "lagging"  ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" :
                                 "border-destructive/30 bg-destructive/10 text-destructive";
  const dot =
    sync.status === "synced"  ? "bg-green-500" :
    sync.status === "lagging" ? "bg-yellow-400" :
                                "bg-destructive";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${color} ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dot}`}></span>
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dot}`}></span>
      </span>
      {sync.label}
      {s.headBlock > 0 && <span className="opacity-70 font-mono">#{s.syncedBlock || s.headBlock}</span>}
    </span>
  );
};

export default SyncBadge;
