import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatUnits } from "ethers";
import { Loader2, ExternalLink, Layers, TrendingUp, Activity, Search, RefreshCw, Plus, DollarSign, BarChart3 } from "lucide-react";
import { explorerAddr, TOKENS } from "@/lib/chain";
import { Input } from "@/components/ui/input";
import { usePoolIndex, poolTVL, poolPrice, poolVolume, poolIndex, IndexedPool } from "@/lib/poolIndex";
import SyncBadge from "@/components/SyncBadge";

type SortKey = "tvl" | "vol" | "swaps";

const Pools = () => {
  const state = usePoolIndex();
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("tvl");

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
        <button onClick={() => poolIndex.refresh()} className="px-3 py-2 rounded-lg bg-card border border-border hover:border-primary text-xs font-semibold flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5"/> Refresh
        </button>
        <Link to="/liquidity" className="px-4 py-2 rounded-lg btn-primary-grad text-primary-foreground font-bold text-xs flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5"/> Create Pool
        </Link>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : !pools.length ? (
        <div className="glass rounded-3xl p-12 text-center">
          <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No pools match your search.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pools.map(p => <PoolCard key={p.pair} p={p} />)}
        </div>
      )}
    </div>
  );
};

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

const PoolCard = ({ p }: { p: IndexedPool }) => {
  const tvl = poolTVL(p);
  const price = poolPrice(p);
  const vol = poolVolume(p);
  return (
    <div className="glass rounded-2xl p-5 hover:border-primary/60 transition-all hover:-translate-y-1 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex -space-x-2">
          {p.logo0 ? <img src={p.logo0} className="w-9 h-9 rounded-full border-2 border-card object-cover"/> : <div className="w-9 h-9 rounded-full bg-primary/20 grid place-items-center text-xs font-bold border-2 border-card">{p.symbol0[0]}</div>}
          {p.logo1 ? <img src={p.logo1} className="w-9 h-9 rounded-full border-2 border-card object-cover"/> : <div className="w-9 h-9 rounded-full bg-primary/20 grid place-items-center text-xs font-bold border-2 border-card">{p.symbol1[0]}</div>}
        </div>
        <div className="font-bold text-lg">{p.symbol0}<span className="text-muted-foreground mx-1">/</span>{p.symbol1}</div>
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
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Activity className="w-3 h-3"/> Volume</div>
          <div className="font-bold text-sm font-mono">{vol.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
        </div>
      </div>

      <div className="space-y-1.5 text-xs mb-3">
        <div className="flex justify-between"><span className="text-muted-foreground">{p.symbol0}</span><span className="font-mono">{Number(formatUnits(p.reserve0, p.decimals0)).toLocaleString(undefined,{maximumFractionDigits:4})}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">{p.symbol1}</span><span className="font-mono">{Number(formatUnits(p.reserve1, p.decimals1)).toLocaleString(undefined,{maximumFractionDigits:4})}</span></div>
        <div className="flex justify-between border-t border-border/40 pt-1.5"><span className="text-muted-foreground">Price</span><span className="font-mono">1 {p.symbol0} = {price.toLocaleString(undefined,{maximumFractionDigits:4})} {p.symbol1}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Swaps</span><span className="font-mono">{p.swapCount}</span></div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a href={explorerAddr(p.pair)} target="_blank" rel="noreferrer" className="text-center py-2 rounded-xl bg-secondary border border-border hover:border-primary text-xs font-semibold flex items-center justify-center gap-1">
          ↗ Details
        </a>
        <Link to="/liquidity" className="text-center py-2 rounded-xl btn-primary-grad text-primary-foreground text-xs font-bold flex items-center justify-center gap-1">
          <Plus className="w-3 h-3"/> Add Liquidity
        </Link>
      </div>
    </div>
  );
};

export default Pools;
