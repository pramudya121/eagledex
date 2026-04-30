import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "@/lib/web3";
import { Contract, formatUnits } from "ethers";
import { ERC20_ABI, PAIR_ABI } from "@/lib/abis";
import { TOKENS, explorerAddr, explorerTx } from "@/lib/chain";
import {
  Loader2, Wallet as WalletIcon, ExternalLink, CheckCircle2, XCircle, Clock,
  Wallet, Layers, Coins, Briefcase, Send, ArrowLeftRight, Droplets, BookOpen, Zap, Copy,
} from "lucide-react";
import { usePoolIndex } from "@/lib/poolIndex";
import { useTxHistory, TxRecord } from "@/lib/txStore";
import SyncBadge from "@/components/SyncBadge";
import { toast } from "sonner";

interface LPPosition {
  pair: string;
  symbol0: string; symbol1: string;
  logo0?: string; logo1?: string;
  decimals0: number; decimals1: number;
  lpBalance: bigint;
  totalSupply: bigint;
  reserve0: bigint; reserve1: bigint;
  underlying0: bigint; underlying1: bigint;
  sharePct: number;
}

const Portfolio = () => {
  const { account, readProvider, nativeBalance } = useWeb3();
  const indexState = usePoolIndex();
  const txHistory = useTxHistory();

  const [balances, setBalances] = useState<{ sym: string; name: string; bal: string; logo?: string; addr: string }[]>([]);
  const [lps, setLps] = useState<LPPosition[]>([]);
  const [loadingBal, setLoadingBal] = useState(false);
  const [loadingLp, setLoadingLp] = useState(false);

  useEffect(() => {
    if (!account) return;
    (async () => {
      setLoadingBal(true);
      try {
        const erc = TOKENS.filter(t => !t.isNative);
        const bals = await Promise.all(erc.map(async t => {
          try {
            const c = new Contract(t.address, ERC20_ABI, readProvider);
            const b = await c.balanceOf(account);
            return { sym: t.symbol, name: t.name, bal: formatUnits(b, t.decimals), logo: t.logo, addr: t.address };
          } catch { return null; }
        }));
        setBalances(bals.filter(Boolean) as any[]);
      } finally { setLoadingBal(false); }
    })();
  }, [account, readProvider]);

  useEffect(() => {
    if (!account) { setLps([]); return; }
    const pools = Object.values(indexState.pools);
    if (pools.length === 0) return;
    let cancelled = false;
    setLoadingLp(true);
    (async () => {
      try {
        const positions = await Promise.all(pools.map(async (p): Promise<LPPosition | null> => {
          try {
            const c = new Contract(p.pair, PAIR_ABI, readProvider);
            const lpBal: bigint = await c.balanceOf(account);
            if (lpBal === 0n) return null;
            const ts = p.totalSupply > 0n ? p.totalSupply : await c.totalSupply();
            const u0 = (p.reserve0 * lpBal) / ts;
            const u1 = (p.reserve1 * lpBal) / ts;
            const share = Number((lpBal * 1_000_000n) / ts) / 10_000;
            return {
              pair: p.pair, symbol0: p.symbol0, symbol1: p.symbol1,
              logo0: p.logo0, logo1: p.logo1,
              decimals0: p.decimals0, decimals1: p.decimals1,
              lpBalance: lpBal, totalSupply: ts,
              reserve0: p.reserve0, reserve1: p.reserve1,
              underlying0: u0, underlying1: u1, sharePct: share,
            };
          } catch { return null; }
        }));
        if (!cancelled) setLps(positions.filter(Boolean) as LPPosition[]);
      } finally { if (!cancelled) setLoadingLp(false); }
    })();
    return () => { cancelled = true; };
  }, [account, readProvider, indexState.pools, indexState.lastUpdated]);

  const liqHistory = useMemo(() =>
    txHistory.filter(t => /liquid|pair|approve lp/i.test(t.label)).slice(0, 25),
    [txHistory]);

  if (!account) return (
    <div className="max-w-md mx-auto glass rounded-3xl p-10 text-center mt-20">
      <WalletIcon className="w-12 h-12 mx-auto text-primary mb-4" />
      <h2 className="text-xl font-bold mb-2">Connect your wallet</h2>
      <p className="text-muted-foreground text-sm">View your token balances, LP positions, and transaction history</p>
    </div>
  );

  const totalLpUnderlying = lps.reduce(
    (a, p) => a + Number(formatUnits(p.underlying0, p.decimals0)) + Number(formatUnits(p.underlying1, p.decimals1)),
    0,
  );
  const totalAssetsCount = balances.filter(b => Number(b.bal) > 0).length + (Number(nativeBalance) > 0 ? 1 : 0);

  const copyAddr = () => { navigator.clipboard.writeText(account); toast.success("Address copied"); };

  return (
    <div className="max-w-7xl mx-auto animate-slide-up space-y-6">
      {/* Hero */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight"><span className="text-grad">Portfolio</span></h1>
        <p className="text-sm text-muted-foreground">Your tokens and liquidity positions</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Wallet}  label="Total Portfolio Value" value={`${(Number(nativeBalance) + totalLpUnderlying).toLocaleString(undefined,{maximumFractionDigits:4})}`} sub="IRL + LP underlying" />
        <StatCard icon={Coins}   label="Tokens Held"           value={String(totalAssetsCount)} sub="non-zero balances" />
        <StatCard icon={Layers}  label="LP Positions"          value={String(lps.length)} sub="across pools" />
        <StatCard icon={Briefcase} label="Native (IRL)"        value={Number(nativeBalance).toLocaleString(undefined,{maximumFractionDigits:4})} sub="wallet balance" />
      </div>

      {/* Account chip */}
      <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/40 grid place-items-center text-primary-foreground text-xs font-bold">
            {account.slice(2, 4).toUpperCase()}
          </div>
          <span className="font-mono text-sm truncate">{account.slice(0, 10)}…{account.slice(-8)}</span>
          <button onClick={copyAddr} className="p-1 rounded hover:bg-secondary/60 text-muted-foreground hover:text-primary"><Copy className="w-3.5 h-3.5"/></button>
          <a href={explorerAddr(account)} target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-secondary/60 text-muted-foreground hover:text-primary"><ExternalLink className="w-3.5 h-3.5"/></a>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <SyncBadge />
          {indexState.lastUpdated && <span className="hidden sm:inline">{new Date(indexState.lastUpdated).toLocaleTimeString()}</span>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Token Balances - 2 cols */}
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2"><Coins className="w-4 h-4 text-primary"/> Token Balances</h2>
            {loadingBal && <Loader2 className="w-4 h-4 animate-spin opacity-60"/>}
          </div>
          <div className="space-y-1">
            {balances.map(b => (
              <div key={b.addr} className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary/40 transition border border-transparent hover:border-primary/30">
                <div className="flex items-center gap-3 min-w-0">
                  {b.logo ? <img src={b.logo} className="w-9 h-9 rounded-full object-cover bg-secondary"/> : <div className="w-9 h-9 rounded-full bg-primary/20 grid place-items-center font-bold text-xs">{b.sym[0]}</div>}
                  <div className="min-w-0">
                    <div className="font-semibold">{b.sym}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{b.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-sm">{Number(b.bal).toLocaleString(undefined,{maximumFractionDigits:4})}</div>
                  <a href={explorerAddr(b.addr)} target="_blank" rel="noreferrer" className="text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-0.5">
                    {b.addr.slice(0,6)}…{b.addr.slice(-4)} <ExternalLink className="w-2.5 h-2.5"/>
                  </a>
                </div>
              </div>
            ))}
            {!balances.length && !loadingBal && <p className="text-sm text-muted-foreground text-center py-6">No token balances</p>}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass rounded-2xl p-5">
          <h2 className="font-bold mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-primary"/> Quick Actions</h2>
          <div className="space-y-2">
            <ActionLink to="/swap"      icon={ArrowLeftRight} label="Swap Tokens" primary />
            <ActionLink to="/liquidity" icon={Droplets}       label="Add Liquidity" />
            <ActionLink to="/pools"     icon={Layers}         label="View Pools" />
            <ActionLink to="/docs"      icon={BookOpen}       label="Docs" />
            <button onClick={copyAddr} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 border border-border text-sm font-medium">
              <Send className="w-4 h-4 text-primary"/> Copy Address
            </button>
          </div>
        </div>
      </div>

      {/* LP Positions */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold flex items-center gap-2"><Layers className="w-4 h-4 text-primary"/> Liquidity Positions</h2>
          {loadingLp && <Loader2 className="w-4 h-4 animate-spin opacity-60"/>}
        </div>
        {!lps.length && !loadingLp ? (
          <div className="text-center py-10">
            <Droplets className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40"/>
            <p className="text-sm text-muted-foreground">No LP positions yet</p>
            <Link to="/liquidity" className="inline-block mt-3 px-4 py-2 rounded-xl btn-primary-grad text-primary-foreground font-semibold text-sm">+ Add Liquidity</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lps.map(lp => (
              <div key={lp.pair} className="rounded-2xl border border-border p-4 hover:border-primary/60 transition bg-gradient-to-br from-primary/5 to-transparent">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {lp.logo0 ? <img src={lp.logo0} className="w-8 h-8 rounded-full border-2 border-card object-cover"/> : <div className="w-8 h-8 rounded-full bg-primary/20 border-2 border-card grid place-items-center text-[10px] font-bold">{lp.symbol0[0]}</div>}
                      {lp.logo1 ? <img src={lp.logo1} className="w-8 h-8 rounded-full border-2 border-card object-cover"/> : <div className="w-8 h-8 rounded-full bg-primary/20 border-2 border-card grid place-items-center text-[10px] font-bold">{lp.symbol1[0]}</div>}
                    </div>
                    <span className="font-bold">{lp.symbol0}/{lp.symbol1}</span>
                  </div>
                  <a href={explorerAddr(lp.pair)} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink className="w-3.5 h-3.5"/></a>
                </div>
                <div className="text-center py-2 mb-3 rounded-xl bg-primary/10 border border-primary/20">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Pool Share</div>
                  <div className="text-2xl font-extrabold text-grad">{lp.sharePct.toFixed(4)}%</div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">{lp.symbol0}</span><span className="font-mono font-semibold">{Number(formatUnits(lp.underlying0, lp.decimals0)).toLocaleString(undefined,{maximumFractionDigits:6})}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{lp.symbol1}</span><span className="font-mono font-semibold">{Number(formatUnits(lp.underlying1, lp.decimals1)).toLocaleString(undefined,{maximumFractionDigits:6})}</span></div>
                  <div className="flex justify-between border-t border-border/40 pt-1.5"><span className="text-muted-foreground">LP tokens</span><span className="font-mono">{Number(formatUnits(lp.lpBalance, 18)).toLocaleString(undefined,{maximumFractionDigits:4})}</span></div>
                </div>
                <Link to="/liquidity" className="mt-3 block text-center py-2 rounded-xl bg-secondary border border-border hover:border-primary text-xs font-semibold">Manage</Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Liquidity activity */}
      <div className="glass rounded-2xl p-5">
        <h2 className="font-bold mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-primary"/> Liquidity Activity</h2>
        {liqHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No add/remove/create-pair history yet</p>
        ) : (
          <div className="space-y-1">{liqHistory.map(tx => <TxRow key={tx.id} tx={tx} />)}</div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sub }: any) => (
  <div className="glass rounded-2xl p-4 bg-gradient-to-br from-primary/10 to-transparent">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <Icon className="w-4 h-4 text-primary"/>
    </div>
    <div className="text-2xl font-extrabold text-grad truncate">{value}</div>
    <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>
  </div>
);

const ActionLink = ({ to, icon: Icon, label, primary }: any) => (
  <Link to={to} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
    primary ? "btn-primary-grad text-primary-foreground" : "bg-secondary/40 hover:bg-secondary/70 border border-border"
  }`}>
    <Icon className="w-4 h-4"/> {label}
  </Link>
);

const TxRow = ({ tx }: { tx: TxRecord }) => {
  const Icon = tx.status === "confirmed" ? CheckCircle2 : tx.status === "failed" ? XCircle : Clock;
  const color = tx.status === "confirmed" ? "text-green-400" : tx.status === "failed" ? "text-destructive" : "text-yellow-400 animate-pulse";
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/40 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`w-4 h-4 shrink-0 ${color}`} />
        <div className="min-w-0">
          <div className="font-medium truncate">{tx.label}</div>
          <div className="text-[11px] text-muted-foreground">
            {new Date(tx.startedAt).toLocaleString()}{tx.blockNumber ? ` • block ${tx.blockNumber}` : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
          tx.status === "confirmed" ? "border-green-500/30 bg-green-500/10 text-green-400" :
          tx.status === "failed"    ? "border-destructive/30 bg-destructive/10 text-destructive" :
                                      "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
        }`}>{tx.status}</span>
        {tx.hash && (
          <a href={explorerTx(tx.hash)} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
            <ExternalLink className="w-3.5 h-3.5"/>
          </a>
        )}
      </div>
    </div>
  );
};

export default Portfolio;
