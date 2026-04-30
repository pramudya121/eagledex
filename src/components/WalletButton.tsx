import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWeb3, WALLETS, WalletId } from "@/lib/web3";
import { INTEGRALAYER, explorerAddr } from "@/lib/chain";
import { ExternalLink, LogOut, AlertTriangle, Wallet } from "lucide-react";

const short = (a: string) => `${a.slice(0,6)}…${a.slice(-4)}`;

const WalletButton = () => {
  const { account, connect, disconnect, isCorrectChain, switchToIntegralayer, nativeBalance } = useWeb3();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  const onPick = async (id: WalletId) => { await connect(id); setOpen(false); };

  if (!account) {
    return (
      <>
        <Button onClick={() => setOpen(true)} className="btn-primary-grad text-primary-foreground font-semibold rounded-xl">
          <Wallet className="w-4 h-4 mr-2" /> Connect Wallet
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="glass max-w-md">
            <DialogHeader><DialogTitle className="text-xl">Connect a wallet</DialogTitle></DialogHeader>
            <div className="grid gap-2 mt-2">
              {WALLETS.map(w => (
                <button key={w.id} onClick={() => onPick(w.id)}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/60 hover:bg-primary/5 transition-all text-left">
                  <span className="text-2xl">{w.icon}</span>
                  <span className="font-semibold">{w.name}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">All actions are signed and broadcast to {INTEGRALAYER.name}.</p>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (!isCorrectChain) {
    return (
      <Button onClick={switchToIntegralayer} variant="destructive" className="rounded-xl">
        <AlertTriangle className="w-4 h-4 mr-2" /> Switch to Integralayer
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button onClick={() => setMenu(v => !v)} variant="outline" className="rounded-xl border-border bg-card/60 backdrop-blur">
        <span className="w-2 h-2 rounded-full bg-[hsl(var(--success))] mr-2 animate-pulse" />
        <span className="font-mono text-xs">{Number(nativeBalance).toFixed(3)} IRL</span>
        <span className="mx-2 opacity-30">|</span>
        <span className="font-semibold">{short(account)}</span>
      </Button>
      {menu && (
        <div className="absolute right-0 top-full mt-2 w-56 glass rounded-xl p-2 z-50 animate-fade-in">
          <a href={explorerAddr(account)} target="_blank" rel="noreferrer"
             className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-primary/10 text-sm">
            <ExternalLink className="w-4 h-4" /> View on Explorer
          </a>
          <button onClick={() => { disconnect(); setMenu(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-destructive/10 text-sm text-destructive">
            <LogOut className="w-4 h-4" /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletButton;
