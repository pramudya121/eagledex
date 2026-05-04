import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatUnits } from "ethers";
import { Loader2, ExternalLink, Layers, TrendingUp, Activity, Search, RefreshCw, Plus, DollarSign, BarChart3, Droplets, Sparkles, Cloud } from "lucide-react";
import { explorerAddr, TOKENS } from "@/lib/chain";
import { Input } from "@/components/ui/input";
import { usePoolIndex, poolTVL, poolPrice, poolVolume, poolVolumeWindow, poolIndex, IndexedPool } from "@/lib/poolIndex";
import { useCloudIndex, cloudIndex } from "@/lib/cloudIndex";
import SyncBadge from "@/components/SyncBadge";
import PoolChartDialog from "@/components/PoolChartDialog";

type SortKey = "tvl" | "vol" | "swaps";

const Pools = () => {
  const state = usePoolIndex();
  const cloud = useCloudIndex();
  const [params] = useSearchParams();
  const highlight = params.get("highlight")?.toLowerCase();
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("tvl");
  const highlightRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (highlight && highlightRef.current) highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" }); }, [highlight, state.lastUpdated]);

  const allPools = useMemo(() => Object.values(state.pools), [state.pools, state.lastUpdated]);
  // Only show pools whose BOTH tokens are in the registry (hides removed/legacy pairs like WIRL/MON).
  const knownAddrs = useMemo(
    () => new Set(TOKENS.filter(t => !t.isNative).map(t => t.address.toLowerCase())),
    []
  );
  const visiblePools = useMemo(
    () => allPools.filter(p => knownAddrs.has(p.token0.toLowerCase()) && knownAddrs.has(p.token1.toLowerCase())),
    [allPools, knownAddrs]
  );
  const totalTVL = visiblePools.reduce((a, p) => a + poolTVL(p), 0);
  const totalVol = visiblePools.reduce((a, p) => a + poolVolume(p), 0);
  const totalSwaps = visiblePools.reduce((a, p) => a + p.swapCount, 0);

  const pools = useMemo(() => {
    const filtered = q
      ? visiblePools.filter(p =>
          p.symbol0.toLowerCase().includes(q.toLowerCase()) ||
          p.symbol1.toLowerCase().includes(q.toLowerCase()) ||
          p.pair.toLowerCase().includes(q.toLowerCase()))
      : visiblePools;
    return [...filtered].sort((a, b) => {
      if (sortKey === "tvl") return poolTVL(b) - poolTVL(a);
      if (sortKey === "vol") return poolVolume(b) - poolVolume(a);
      return b.swapCount - a.swapCount;
    });
  }, [visiblePools, q, sortKey]);

  const loading = state.initializing && pools.length === 0;

  return (
    <div className="max-w-7xl mx-auto animate-slide-up">
      {/* Hero */}
      <div className="text-center mb-6">
        <h1 className="text-4xl font-extrabold tracking-tight"><span className="text-grad">Liquidity Pools</span></h1>
        <p className="text-sm text-muted-foreground mt-2">Explore and provide liquidity to earn trading fees</p>
      </div>

      {/* Top mini stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MiniStat icon={Layers}      label="Total Pools" value={String(allPools.length)} />
        <MiniStat icon={DollarSign}  label="Total TVL"   value={totalTVL.toLocaleString(undefined,{maximumFractionDigits:2})} />
        <MiniStat icon={BarChart3}   label="Volume"      value={totalVol.toLocaleString(undefined,{maximumFractionDigits:2})} />
        <MiniStat icon={Activity}    label="Total Swaps" value={String(totalSwaps)} />
      </div>

      {/* Big hero stats */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <BigStat label="Total Value Locked" value={totalTVL.toLocaleString(undefined,{maximumFractionDigits:2})} sub="From on-chain reserves" highlight />
        <BigStat label="Trading Volume"     value={totalVol.toLocaleString(undefined,{maximumFractionDigits:2})} sub="~50k blocks window" />
        <BigStat label="Active Pairs"       value={String(allPools.length)} sub="indexed live" success />
      </div>

      {/* Toolbar */}
      <div className="glass rounded-2xl p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search pools..." className="pl-9 h-10 bg-card" />
        </div>
        <div className="flex gap-1 text-xs">
          {(["tvl","vol","swaps"] as SortKey[]).map(k => (
            <button key={k} onClick={() => setSortKey(k)}
              className={`px-3 py-2 rounded-lg font-semibold ${sortKey===k ? "btn-primary-grad text-primary-foreground" : "bg-card border border-border hover:border-primary/40"}`}>
              {k === "tvl" ? "↓ TVL" : k === "vol" ? "↑ Volume" : "↑ Swaps"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground border-l border-border/60 pl-2">
          <SyncBadge />
          {state.lastUpdated && <span className="hidden sm:inline">{new Date(state.lastUpdated).toLocaleTimeString()}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground border-l border-border/60 pl-2">
          <SyncBadge />
          <span title={`Cloud last block ${cloud.lastBlock} · ${cloud.scannedLastCall} events last sync`}
            className={`flex items-center gap-1 px-2 py-1 rounded-full border ${
              cloud.status === "ok" ? "border-green-500/40 text-green-400 bg-green-500/10"
              : cloud.status === "syncing" ? "border-primary/40 text-primary bg-primary/10"
              : cloud.status === "error" ? "border-destructive/40 text-destructive bg-destructive/10"
              : "border-border"
            }`}>
            <Cloud className="w-3 h-3"/>{cloud.status === "syncing" ? "Sync…" : cloud.status === "ok" ? "Cloud" : cloud.status === "error" ? "Err" : "Idle"}
          </span>
          {state.lastUpdated && <span className="hidden sm:inline">{new Date(state.lastUpdated).toLocaleTimeString()}</span>}
        </div>
        <button onClick={() => { poolIndex.refresh(); cloudIndex.ping(); }} className="px-3 py-2 rounded-lg bg-card border border-border hover:border-primary text-xs font-semibold flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5"/> Refresh
        </button>
        <Link to="/create-pool" className="px-4 py-2 rounded-lg btn-primary-grad text-primary-foreground font-bold text-xs flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5"/> Create Pool
        </Link>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : !pools.length ? (
        q ? (
          <div className="glass rounded-3xl p-12 text-center">
            <Search className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-semibold mb-1">No pools match “{q}”</p>
            <p className="text-xs text-muted-foreground mb-4">Try another token symbol or clear the search.</p>
            <button onClick={() => setQ("")} className="px-4 py-2 rounded-xl bg-card border border-border hover:border-primary text-xs font-bold">Clear search</button>
          </div>
        ) : (
          // True empty state — no pools indexed at all yet.
          <div className="rounded-3xl p-10 text-center bg-gradient-to-br from-primary/15 via-card to-transparent border border-primary/20">
            <div className="w-16 h-16 mx-auto rounded-2xl btn-primary-grad grid place-items-center mb-4 shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.6)]">
              <Droplets className="w-7 h-7 text-primary-foreground" />
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight mb-1">Be the first liquidity provider</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
              No pools have been indexed yet. Open the Liquidity page, choose two tokens, approve them once, then add liquidity — the pair is created automatically on your first deposit.
            </p>
            <ol className="text-xs text-left max-w-md mx-auto mb-5 space-y-2">
              <Step n={1} title="Pick two tokens" desc="Native IRL pairs use addLiquidityETH; ERC-20 pairs use addLiquidity." />
              <Step n={2} title="Approve (once)" desc="ERC-20 tokens need router approval before they can be deposited. Native IRL skips approval." />
              <Step n={3} title="Add liquidity" desc="The router auto-deploys the pair contract during the same tx. No 'Create pair' step." />
            </ol>
            <Link to="/liquidity" className="btn-primary-grad text-primary-foreground rounded-2xl px-6 h-12 inline-flex items-center gap-2 font-bold">
              <Sparkles className="w-4 h-4" /> Open Liquidity
            </Link>
          </div>
        )
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pools.map(p => {
            const isHi = highlight && p.pair.toLowerCase() === highlight;
            return (
              <div key={p.pair} ref={isHi ? highlightRef : undefined} className={isHi ? "ring-2 ring-primary rounded-2xl shadow-[0_0_30px_-5px_hsl(var(--primary)/0.6)]" : ""}>
                <PoolCard p={p} cloudVol24={cloud.volume24h[p.pair.toLowerCase()]} cloudVol7={cloud.volume7d[p.pair.toLowerCase()]} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Step = ({ n, title, desc }: { n: number; title: string; desc: string }) => (
  <li className="flex gap-3 p-2.5 rounded-xl bg-card border border-border/60">
    <div className="w-6 h-6 rounded-full btn-primary-grad text-primary-foreground grid place-items-center text-[11px] font-bold shrink-0">{n}</div>
    <div className="min-w-0">
      <div className="font-bold text-foreground">{title}</div>
      <div className="text-muted-foreground text-[11px]">{desc}</div>
    </div>
  </li>
);

const MiniStat = ({ icon: Icon, label, value }: any) => (
  <div className="glass rounded-xl p-3 flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-primary/15 grid place-items-center"><Icon className="w-4 h-4 text-primary"/></div>
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
      <div className="font-bold truncate">{value}</div>
    </div>
  </div>
);

const BigStat = ({ label, value, sub, highlight, success }: any) => (
  <div className={`glass rounded-2xl p-6 text-center ${highlight ? "bg-gradient-to-br from-primary/15 to-transparent" : ""}`}>
    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</div>
    <div className={`text-3xl font-extrabold ${highlight ? "text-grad" : success ? "text-green-400" : "text-foreground"}`}>{value}</div>
    <div className="text-[11px] text-muted-foreground mt-2">{sub}</div>
  </div>
);

const PoolCard = ({ p, cloudVol24, cloudVol7 }: { p: IndexedPool; cloudVol24?: { volume0: number; volume1: number; swap_count: number }; cloudVol7?: { volume0: number; volume1: number; swap_count: number } }) => {
  const tvl = poolTVL(p);
  const price = poolPrice(p);
  const vol = poolVolume(p);
  const localVol24 = poolVolumeWindow(p.pair, 24 * 60 * 60 * 1000);
  // Prefer Cloud-aggregated volume (cross-user, cross-device); fallback to local cache.
  const vol24 = cloudVol24
    ? Number(formatUnits(BigInt(Math.floor(cloudVol24.volume0)), p.decimals0)) + Number(formatUnits(BigInt(Math.floor(cloudVol24.volume1)), p.decimals1))
    : localVol24;
  const vol7 = cloudVol7
    ? Number(formatUnits(BigInt(Math.floor(cloudVol7.volume0)), p.decimals0)) + Number(formatUnits(BigInt(Math.floor(cloudVol7.volume1)), p.decimals1))
    : 0;
  const cloudSwaps = cloudVol24?.swap_count ?? 0;
  const [chartOpen, setChartOpen] = useState(false);
  return (
    <div className="glass rounded-2xl p-5 hover:border-primary/60 transition-all hover:-translate-y-1 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex -space-x-2">
          {p.logo0 ? <img src={p.logo0} className="w-9 h-9 rounded-full border-2 border-card object-cover"/> : <div className="w-9 h-9 rounded-full bg-primary/20 grid place-items-center text-xs font-bold border-2 border-card">{p.symbol0[0]}</div>}
          {p.logo1 ? <img src={p.logo1} className="w-9 h-9 rounded-full border-2 border-card object-cover"/> : <div className="w-9 h-9 rounded-full bg-primary/20 grid place-items-center text-xs font-bold border-2 border-card">{p.symbol1[0]}</div>}
        </div>
        <div className="font-bold text-lg">{p.symbol0}<span className="text-muted-foreground mx-1">/</span>{p.symbol1}</div>
        {cloudVol24 && <span title="Volume 24h sourced from Cloud-indexed events" className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/30 font-bold">CLOUD</span>}
        <a href={explorerAddr(p.pair)} target="_blank" rel="noreferrer" className="ml-auto text-muted-foreground hover:text-primary">
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl bg-secondary/40 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3"/> TVL</div>
          <div className="font-bold text-grad text-sm font-mono">{tvl.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
        </div>
        <div className="rounded-xl bg-secondary/40 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Activity className="w-3 h-3"/> Vol 24h {cloudVol7 && <span className="ml-auto text-muted-foreground/70">7d {vol7.toLocaleString(undefined,{maximumFractionDigits:0})}</span>}</div>
          <div className="font-bold text-sm font-mono">{vol24.toLocaleString(undefined,{maximumFractionDigits:2})}{cloudSwaps > 0 && <span className="text-[10px] text-muted-foreground ml-1">· {cloudSwaps} swaps</span>}</div>
        </div>
      </div>

      <div className="space-y-1.5 text-xs mb-3">
        <div className="flex justify-between"><span className="text-muted-foreground">{p.symbol0}</span><span className="font-mono">{Number(formatUnits(p.reserve0, p.decimals0)).toLocaleString(undefined,{maximumFractionDigits:4})}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">{p.symbol1}</span><span className="font-mono">{Number(formatUnits(p.reserve1, p.decimals1)).toLocaleString(undefined,{maximumFractionDigits:4})}</span></div>
        <div className="flex justify-between border-t border-border/40 pt-1.5"><span className="text-muted-foreground">Price</span><span className="font-mono">1 {p.symbol0} = {price.toLocaleString(undefined,{maximumFractionDigits:4})} {p.symbol1}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Total volume</span><span className="font-mono text-muted-foreground">{vol.toLocaleString(undefined,{maximumFractionDigits:2})}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Swaps</span><span className="font-mono">{p.swapCount}</span></div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setChartOpen(true)} className="text-center py-2 rounded-xl bg-secondary border border-border hover:border-primary text-xs font-semibold flex items-center justify-center gap-1">
          <BarChart3 className="w-3 h-3"/> Chart
        </button>
        <a href={explorerAddr(p.pair)} target="_blank" rel="noreferrer" className="text-center py-2 rounded-xl bg-secondary border border-border hover:border-primary text-xs font-semibold flex items-center justify-center gap-1">
          ↗ Tx
        </a>
        <Link to="/liquidity" className="text-center py-2 rounded-xl btn-primary-grad text-primary-foreground text-xs font-bold flex items-center justify-center gap-1">
          <Plus className="w-3 h-3"/> Add
        </Link>
      </div>

      <PoolChartDialog pool={p} open={chartOpen} onOpenChange={setChartOpen} />
    </div>
  );
};

export default Pools;
