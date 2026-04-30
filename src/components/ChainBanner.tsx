import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useWeb3 } from "@/lib/web3";
import { INTEGRALAYER } from "@/lib/chain";

/**
 * Persistent banner shown at the top of the app whenever the user is connected
 * but on a chain other than Integralayer. Provides a single one-click switch.
 */
const ChainBanner = () => {
  const { account, isCorrectChain, chainId, switchToIntegralayer } = useWeb3();
  const [busy, setBusy] = useState(false);

  if (!account || isCorrectChain) return null;

  const onSwitch = async () => {
    setBusy(true);
    try { await switchToIntegralayer(); } finally { setBusy(false); }
  };

  return (
    <div className="bg-destructive/15 border-b border-destructive/40">
      <div className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="font-semibold text-destructive">Wrong network</span>
          <span className="text-muted-foreground hidden sm:inline">
            Your wallet is on chain {chainId ?? "?"}. Switch to {INTEGRALAYER.name} (chainId {INTEGRALAYER.chainId}) to transact.
          </span>
        </div>
        <button
          onClick={onSwitch}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : null}
          Switch network
        </button>
      </div>
    </div>
  );
};

export default ChainBanner;