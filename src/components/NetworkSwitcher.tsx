import { useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { CHAINS, getActiveChain, setActiveChain } from "@/lib/chain";

const NetworkSwitcher = () => {
  const [open, setOpen] = useState(false);
  const active = getActiveChain();

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        title={`Active network: ${active.name} (chainId ${active.chainId})`}
        className="h-9 px-2.5 rounded-full border border-border bg-card/60 backdrop-blur flex items-center gap-1.5 text-xs font-bold hover:bg-secondary/60 transition"
      >
        <Globe className="w-3.5 h-3.5 text-primary" />
        <span className="hidden sm:inline">{active.shortName}</span>
        <span className="text-[10px] text-muted-foreground hidden md:inline">·{active.chainId}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 glass rounded-xl p-2 z-50 animate-fade-in">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              Select Network
            </div>
            {CHAINS.map(c => {
              const isActive = c.key === active.key;
              return (
                <button
                  key={c.key}
                  onClick={() => { if (!isActive) setActiveChain(c.key); else setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                    isActive ? "bg-primary/15 text-foreground" : "hover:bg-primary/10"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full btn-primary-grad grid place-items-center text-primary-foreground text-[10px] font-extrabold">
                    {c.symbol.slice(0, 3)}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-bold leading-tight">{c.shortName}</div>
                    <div className="text-[10px] text-muted-foreground">chainId {c.chainId}</div>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-primary" />}
                </button>
              );
            })}
            <div className="px-3 pt-2 pb-1 text-[10px] text-muted-foreground leading-snug">
              Switching reloads the app and applies that chain's contracts & tokens.
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NetworkSwitcher;
