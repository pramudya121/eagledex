import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Contract, formatUnits } from "ethers";
import { toast } from "sonner";
import { Droplet, Loader2, Sparkles, Clock, CheckCircle2, ExternalLink, Wallet, Zap, Gift, Layers, RefreshCw, Shield, Plus, Copy } from "lucide-react";
import { useWeb3 } from "@/lib/web3";
import { CONTRACTS, explorerAddr } from "@/lib/chain";
import { FAUCET_ABI } from "@/lib/abis";
import { getFaucet, readFaucetTokens, nextClaimAt, FaucetTokenInfo } from "@/lib/faucet";
import { sendTx } from "@/lib/tx";

const Faucet = () => {
  const { account, signer, readProvider } = useWeb3();
  const [tokens, setTokens] = useState<FaucetTokenInfo[]>([]);
  const [cooldown, setCooldown] = useState<bigint>(0n);
  const [owner, setOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  const faucetRead = useMemo(() => getFaucet(readProvider), [readProvider]);
  const isOwner = !!(owner && account && owner.toLowerCase() === account.toLowerCase());

  const load = useCallback(async () => {
    try {
      const [cd, own, list] = await Promise.all([
        faucetRead.cooldown().catch(() => 0n),
        faucetRead.owner().catch(() => null),
        readFaucetTokens(faucetRead, readProvider, account),
      ]);
      setCooldown(cd); setOwner(own); setTokens(list);
    } finally { setLoading(false); setRefreshing(false); }
  }, [faucetRead, readProvider, account]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => load(), 30_000); return () => clearInterval(t); }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); };

  const claim = async (idx: number) => {
    if (!signer) return;
    setBusyIdx(idx);
    try {
      const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
      await sendTx(`Claim ${tokens[idx].symbol}`, () => c.claim(idx));
      await load();
    } catch {} finally { setBusyIdx(null); }
  };

  const claimAll = async () => {
    if (!signer) return;
    setBusyAll(true);
    try {
      const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
      await sendTx("Claim all faucet tokens", () => c.claimAll());
      await load();
    } catch {} finally { setBusyAll(false); }
  };

  const addToWallet = async (t: FaucetTokenInfo) => {
    try {
      const eth: any = (window as any).ethereum;
      if (!eth?.request) { toast.error("No injected wallet detected"); return; }
      await eth.request({
        method: "wallet_watchAsset",
        params: { type: "ERC20", options: { address: t.address, symbol: t.symbol, decimals: t.decimals } },
      });
      toast.success(`Added ${t.symbol} to wallet`);
    } catch {}
  };

  const copyAddr = async (addr: string) => {
    try { await navigator.clipboard.writeText(addr); toast.success("Address copied"); } catch {}
  };

  const allReadyAt = tokens.length === 0 ? 0 : Math.max(...tokens.map(t => nextClaimAt(t.userLastClaimed, cooldown)));
  const allCdLeft = Math.max(0, allReadyAt - now);
  const anyClaimable = tokens.some(t => {
    const cdLeft = Math.max(0, nextClaimAt(t.userLastClaimed, cooldown) - now);
    const exhausted = t.maxClaims > 0n && t.userClaimed >= t.maxClaims;
    return cdLeft === 0 && !exhausted && t.faucetBalance >= t.claimAmount;
  });

  const totalAvailable = tokens.reduce((a, t) => a + Number(formatUnits(t.faucetBalance, t.decimals)), 0);

  return (
    <div className="max-w-5xl mx-auto animate-slide-up">
      {/* Hero with 3D floating drop */}
      <div className="relative overflow-hidden rounded-3xl glass border border-cyan-400/30 p-8 mb-6 bg-gradient-to-br from-cyan-500/10 via-transparent to-fuchsia-500/10">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-fuchsia-500/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

        <div className="relative flex flex-col md:flex-row items-center gap-6">
          {/* 3D drop */}
          <div className="relative w-32 h-32 shrink-0" style={{ perspective: "800px" }}>
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-300 via-sky-500 to-fuchsia-600 shadow-[0_30px_60px_-15px_hsl(195_90%_55%/0.6)]"
              style={{
                animation: "faucet-spin 8s linear infinite",
                transformStyle: "preserve-3d",
              }}
            >
              <div className="absolute inset-3 rounded-full bg-gradient-to-br from-white/40 to-transparent blur-md" />
              <div className="absolute top-4 left-6 w-6 h-3 rounded-full bg-white/70 blur-[2px]" />
            </div>
            <div
              className="absolute inset-0 rounded-full border border-cyan-300/40"
              style={{ animation: "faucet-float 4s ease-in-out infinite" }}
            />
            <Droplet className="absolute inset-0 m-auto w-10 h-10 text-white drop-shadow-lg" />
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-[10px] font-bold uppercase tracking-wider text-cyan-300 mb-2">
              <Sparkles className="w-3 h-3" /> Testnet Faucet
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-fuchsia-400 bg-clip-text text-transparent">
                Free Test Tokens
              </span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Claim test tokens to swap, add liquidity, or farm on EAGLEDEX. Cooldown resets every {cooldown > 0n ? `${Number(cooldown)}s` : "—"}.
            </p>
          </div>

          {/* Total reservoir */}
          <div className="rounded-2xl border border-cyan-400/30 bg-card/50 px-5 py-4 text-center min-w-[140px]">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Reservoir</div>
            <div className="text-2xl font-extrabold mt-1 font-mono">{totalAvailable.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="text-[10px] text-cyan-300">across {tokens.length} token{tokens.length === 1 ? "" : "s"}</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <div className="text-xs text-muted-foreground">
          Contract:{" "}
          <a href={explorerAddr(CONTRACTS.FAUCET)} target="_blank" rel="noreferrer" className="font-mono text-cyan-300 hover:underline inline-flex items-center gap-1">
            {CONTRACTS.FAUCET.slice(0,6)}…{CONTRACTS.FAUCET.slice(-4)} <ExternalLink className="w-3 h-3"/>
          </a>
          <button onClick={() => copyAddr(CONTRACTS.FAUCET)} className="ml-1.5 text-muted-foreground hover:text-foreground"><Copy className="w-3 h-3 inline"/></button>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Link to="/admin/faucet" className="h-9 px-3 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-300 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-fuchsia-500/20 transition">
              <Shield className="w-3.5 h-3.5"/> Admin Panel
            </Link>
          )}
          <button onClick={refresh} disabled={refreshing} className="h-9 px-3 rounded-lg border border-border bg-card/50 text-xs font-bold inline-flex items-center gap-1.5 hover:border-cyan-400/60 transition disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}/> Refresh
          </button>
        </div>
      </div>

      {/* Claim All */}
      {account && tokens.length > 1 && (
        <div className="mb-5">
          <button
            onClick={claimAll}
            disabled={busyAll || !signer || !anyClaimable}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-600 text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-[0_15px_40px_-15px_hsl(195_90%_55%/0.7)] hover:shadow-[0_20px_50px_-15px_hsl(195_90%_55%/0.9)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busyAll ? <Loader2 className="w-5 h-5 animate-spin"/> : <Zap className="w-5 h-5"/>}
            {anyClaimable ? "Claim All Tokens" : allCdLeft > 0 ? `All on cooldown — wait ${Math.ceil(allCdLeft/1000)}s` : "Nothing to claim"}
          </button>
        </div>
      )}

      {/* Connect prompt */}
      {!account && (
        <div className="glass rounded-3xl p-10 text-center border border-cyan-400/30">
          <Wallet className="w-10 h-10 mx-auto text-cyan-400 mb-3" />
          <h2 className="text-xl font-extrabold mb-1">Connect your wallet</h2>
          <p className="text-sm text-muted-foreground">to start claiming test tokens.</p>
        </div>
      )}

      {/* Token grid */}
      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-400"/></div>
      ) : tokens.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">
          <Layers className="w-8 h-8 mx-auto mb-2 opacity-50"/> No tokens configured in the faucet yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tokens.map(t => {
            const ready = nextClaimAt(t.userLastClaimed, cooldown);
            const cdLeft = Math.max(0, ready - now);
            const onCooldown = !!account && cdLeft > 0;
            const exhausted = t.maxClaims > 0n && t.userClaimed >= t.maxClaims;
            const empty = t.faucetBalance < t.claimAmount;
            const claimable = !!account && !onCooldown && !exhausted && !empty;
            const reservoirPct = t.claimAmount > 0n
              ? Math.min(100, Number((t.faucetBalance * 100n) / (t.claimAmount * (t.maxClaims > 0n ? t.maxClaims : 100n))))
              : 100;
            return (
              <div
                key={t.index}
                className="group relative rounded-2xl border border-border/60 bg-card/40 p-5 hover:border-cyan-400/60 transition overflow-hidden"
                style={{ transformStyle: "preserve-3d" }}
              >
                <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/10 blur-2xl group-hover:from-cyan-500/40 transition" />

                <div className="relative flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-card border border-border/60 grid place-items-center overflow-hidden shadow-[0_8px_20px_-8px_hsl(195_90%_55%/0.4)]">
                    {t.logo ? (
                      <img src={t.logo} alt={t.symbol} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-white font-extrabold">
                        {t.symbol.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold truncate">{t.symbol}</span>
                      <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">#{t.index}</span>
                    </div>
                    <a href={explorerAddr(t.address)} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-muted-foreground hover:text-cyan-300 inline-flex items-center gap-0.5">
                      {t.address.slice(0,6)}…{t.address.slice(-4)} <ExternalLink className="w-2.5 h-2.5"/>
                    </a>
                  </div>
                </div>

                {/* Claim amount */}
                <div className="mb-3 p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-400/20">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Claim amount</div>
                  <div className="text-2xl font-extrabold font-mono mt-0.5">
                    {Number(formatUnits(t.claimAmount, t.decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    <span className="text-xs text-cyan-300 ml-1">{t.symbol}</span>
                  </div>
                </div>

                {/* Reservoir bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Reservoir</span>
                    <span className="font-mono">{Number(formatUnits(t.faucetBalance, t.decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-card overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 transition-all" style={{ width: `${reservoirPct}%` }} />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2 mb-4 text-[10px]">
                  <div className="rounded-lg border border-border/60 bg-card/40 p-2">
                    <div className="text-muted-foreground">Your claims</div>
                    <div className="font-mono font-bold">{String(t.userClaimed)}{t.maxClaims > 0n ? ` / ${String(t.maxClaims)}` : ""}</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/40 p-2">
                    <div className="text-muted-foreground">Cooldown</div>
                    <div className="font-mono font-bold flex items-center gap-1">
                      {onCooldown ? (<><Clock className="w-3 h-3 text-yellow-400"/>{Math.ceil(cdLeft / 1000)}s</>) : (<><CheckCircle2 className="w-3 h-3 text-green-400"/>Ready</>)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => claim(t.index)}
                    disabled={!claimable || busyIdx === t.index}
                    className="flex-1 h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_10px_25px_-10px_hsl(195_90%_55%/0.8)] transition"
                  >
                    {busyIdx === t.index ? <Loader2 className="w-4 h-4 animate-spin"/> : <Gift className="w-4 h-4"/>}
                    {!account ? "Connect wallet" : exhausted ? "Max reached" : empty ? "Empty" : onCooldown ? `Wait ${Math.ceil(cdLeft / 1000)}s` : "Claim"}
                  </button>
                  <button
                    onClick={() => addToWallet(t)}
                    title="Add token to wallet"
                    className="h-11 w-11 rounded-xl border border-border bg-card/50 hover:border-cyan-400/60 transition grid place-items-center text-cyan-300"
                  >
                    <Plus className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes faucet-spin { to { transform: rotateY(360deg); } }
        @keyframes faucet-float { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; } 50% { transform: translateY(-8px) scale(1.05); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default Faucet;
