import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useWeb3, WALLETS, WalletId, isWalletInstalled, WC_AVAILABLE } from "@/lib/web3";
import { INTEGRALAYER, explorerAddr } from "@/lib/chain";
import { ExternalLink, LogOut, AlertTriangle, Wallet, X, Home, Sparkles, Info } from "lucide-react";
import { WALLET_ICON } from "./WalletIcons";
import { toast } from "sonner";

const short = (a: string) => `${a.slice(0,6)}…${a.slice(-4)}`;

const WalletButton = () => {
  const { account, connect, disconnect, isCorrectChain, switchToIntegralayer, nativeBalance } = useWeb3();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  const onPick = async (id: WalletId) => {
    if (id === "walletconnect" && !WC_AVAILABLE) {
      toast.error("WalletConnect not configured", {
        description: "Set VITE_WC_PROJECT_ID from cloud.reown.com to enable QR pairing.",
        action: { label: "Get ID", onClick: () => window.open("https://cloud.reown.com", "_blank") },
      });
      return;
    }
    setOpen(false);
    await connect(id);
  };

  if (!account) {
    // WalletConnect always lives in "popular" so users can scan from any mobile wallet
    const installed = WALLETS.filter(w => w.id !== "walletconnect" && isWalletInstalled(w.id));
    const popular   = WALLETS.filter(w => w.id === "walletconnect" || !isWalletInstalled(w.id));

    return (
      <>
        <Button onClick={() => setOpen(true)} className="btn-primary-grad text-primary-foreground font-semibold rounded-xl">
          <Wallet className="w-4 h-4 mr-2" /> Connect Wallet
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className="p-0 max-w-3xl border-0 bg-transparent shadow-none [&>button]:hidden"
          >
            <div className="grid sm:grid-cols-[300px_1fr] rounded-3xl overflow-hidden border border-border/60 shadow-[0_30px_80px_-30px_hsl(var(--primary)/0.5)] bg-[hsl(var(--background))]">
              {/* ===== LEFT — wallet list ===== */}
              <div className="bg-[hsl(var(--background))] p-5 border-r border-border/60 max-h-[70vh] overflow-y-auto">
                <h2 className="text-lg font-extrabold mb-4">Connect Wallet</h2>

                {installed.length > 0 && (
                  <>
                    <div className="text-xs font-bold text-primary mb-2">Installed</div>
                    <ul className="space-y-1 mb-4">
                      {installed.map(w => {
                        const Icon = WALLET_ICON[w.id];
                        return (
                          <li key={w.id}>
                            <button onClick={() => onPick(w.id)}
                              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-primary/10 transition text-left">
                              <Icon />
                              <span className="font-bold text-sm">{w.name}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                {popular.length > 0 && (
                  <>
                    <div className="text-xs font-bold text-muted-foreground mb-2">Popular</div>
                    <ul className="space-y-1">
                      {popular.map(w => {
                        const Icon = WALLET_ICON[w.id];
                        const wcDisabled = w.id === "walletconnect" && !WC_AVAILABLE;
                        return (
                          <li key={w.id}>
                            <button onClick={() => onPick(w.id)}
                              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-primary/10 transition text-left">
                              <Icon />
                              <span className="font-bold text-sm flex-1">{w.name}</span>
                              {wcDisabled && (
                                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-500 flex items-center gap-1">
                                  <Info className="w-2.5 h-2.5"/> setup
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed">
                  All actions are signed and broadcast to {INTEGRALAYER.name}.
                </p>
              </div>

              {/* ===== RIGHT — educational panel ===== */}
              <div className="relative bg-secondary/30 p-7">
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="absolute top-4 right-4 w-9 h-9 grid place-items-center rounded-full bg-card hover:bg-secondary transition border border-border"
                >
                  <X className="w-4 h-4" />
                </button>

                <h3 className="text-center font-extrabold text-lg mb-6 mt-2">What is a Wallet?</h3>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl btn-primary-grad grid place-items-center text-primary-foreground shrink-0">
                      <Home className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold mb-1">A Home for your Digital Assets</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Wallets are used to send, receive, store, and display digital assets like
                        Ethereum, ERC-20 tokens, and NFTs.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 grid place-items-center text-white shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold mb-1">A New Way to Sign In</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Instead of creating new accounts and passwords on every website, just
                        connect your wallet — one identity, every dApp.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col items-center gap-2">
                  <a href="https://ethereum.org/en/wallets/find-wallet/" target="_blank" rel="noreferrer"
                    className="px-6 py-2.5 rounded-full btn-primary-grad text-primary-foreground font-bold text-sm">
                    Get a Wallet
                  </a>
                  <a href="https://ethereum.org/en/wallets/" target="_blank" rel="noreferrer"
                    className="text-xs text-primary font-semibold hover:underline">
                    Learn More
                  </a>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Wrong chain → silently auto-switch/add. UI stays clean.
  if (!isCorrectChain) {
    switchToIntegralayer().catch(() => {});
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
