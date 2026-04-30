import { useMemo } from "react";
import { formatUnits } from "ethers";
import { Loader2, TrendingUp, Activity, Layers, Zap, ArrowUpRight, ArrowDownRight, DollarSign } from "lucide-react";
import { explorerTx } from "@/lib/chain";
import { usePoolIndex, poolTVL, poolVolume, poolPrice } from "@/lib/poolIndex";
import SyncBadge from "@/components/SyncBadge";
import PriceChart from "@/components/PriceChart";

const Analytics = () => {
  const state = usePoolIndex();
  const pools = useMemo(() => Object.values(state.pools), [state.pools, state.lastUpdated]);

  const totalTVL = pools.reduce((a, p) => a + poolTVL(p), 0);
  const totalVol = pools.reduce((a, p) => a + poolVolume(p), 0);
  const totalSwaps = pools.reduce((a, p) => a + p.swapCount, 0);

  const top = useMemo(() => [...pools].sort((a, b) => poolTVL(b) - poolTVL(a)).slice(0, 8), [pools]);
  const recent = state.recentSwaps.slice(0, 15);

  // TVL distribution (top 5 + Others)
  const dist = useMemo(() => {
    const sorted = [...pools].sort((a, b) => poolTVL(b) - poolTVL(a));
    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5).reduce((a, p) => a + poolTVL(p), 0);
    const items = top5.map(p => ({ label: `${p.symbol0}/${p.symbol1}`, value: poolTVL(p) }));
    if (others > 0) items.push({ label: "Others", value: others });
    return items;
  }, [pools]);

  if (state.initializing && pools.length === 0) {
    return <div className="grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary"/></div>;
  }

  return (
    <div className="max-w-7xl mx-auto animate-slide-up space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight"><span className="text-grad">Analytics</span></h1>
        <div className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-2 flex-wrap">
          <SyncBadge />
          <span>•</span>
          <span>Live on-chain metrics{state.lastUpdated ? ` • ${new Date(state.lastUpdated).toLocaleTimeString()}` : ""}</span>
        </div>
      </div>

      {/* Hero metrics */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-6 bg-gradient-to-br from-primary/15 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total Value Locked</div>
            <DollarSign className="w-4 h-4 text-primary"/>
          </div>
          <div className="text-4xl font-extrabold text-grad">{totalTVL.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
          <div className="text-xs text-muted-foreground mt-2">Sum of all pool reserves</div>
        </div>
        <div className="glass rounded-2xl p-6 bg-gradient-to-br from-primary/10 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Trading Volume</div>
            <Zap className="w-4 h-4 text-primary"/>
          </div>
          <div className="text-4xl font-extrabold">{totalVol.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
          <div className="text-xs text-muted-foreground mt-2">~50k recent blocks</div>
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat icon={Layers}     label="Total Pairs"  value={String(pools.length)} />
        <MiniStat icon={Activity}   label="Total Swaps"  value={String(totalSwaps)} />
        <MiniStat icon={TrendingUp} label="Avg TVL/pool" value={pools.length ? (totalTVL/pools.length).toLocaleString(undefined,{maximumFractionDigits:2}) : "0"} />
        <MiniStat icon={Zap}        label="Fee tier"     value="0.30%" />
      </div>

      {/* Realtime price chart */}
      <PriceChart />

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top pairs table */}
        <div className="glass rounded-2xl p-5">
          <h2 className="font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary"/> Top Pairs by TVL</h2>
          <div className="grid grid-cols-12 text-[10px] uppercase tracking-wider text-muted-foreground px-2 pb-2 border-b border-border/40">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Pair</div>
            <div className="col-span-3 text-right">TVL</div>
            <div className="col-span-3 text-right">Volume</div>
          </div>
          <div className="space-y-1 mt-1">
            {top.map((p, i) => (
              <div key={p.pair} className="grid grid-cols-12 items-center p-2 rounded-lg hover:bg-secondary/40 text-sm">
                <div className="col-span-1 font-mono text-xs text-muted-foreground">{i+1}</div>
                <div className="col-span-5 flex items-center gap-2 min-w-0">
                  <div className="flex -space-x-2 shrink-0">
                    {p.logo0 ? <img src={p.logo0} className="w-6 h-6 rounded-full border border-card object-cover"/> : <div className="w-6 h-6 rounded-full bg-primary/20 border border-card"/>}
                    {p.logo1 ? <img src={p.logo1} className="w-6 h-6 rounded-full border border-card object-cover"/> : <div className="w-6 h-6 rounded-full bg-primary/20 border border-card"/>}
                  </div>
                  <span className="font-semibold truncate">{p.symbol0}/{p.symbol1}</span>
                </div>
                <div className="col-span-3 text-right font-mono text-xs">{poolTVL(p).toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                <div className="col-span-3 text-right font-mono text-xs text-muted-foreground">{poolVolume(p).toLocaleString(undefined,{maximumFractionDigits:2})}</div>
              </div>
            ))}
            {!top.length && <p className="text-sm text-muted-foreground text-center py-6">No pairs</p>}
          </div>
        </div>

        {/* Recent swaps */}
        <div className="glass rounded-2xl p-5">
          <h2 className="font-bold mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-primary"/> Recent Swaps</h2>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {recent.map((e, i) => {
              const inSym = e.amount0In > 0n ? e.symbol0 : e.symbol1;
              const outSym = e.amount0Out > 0n ? e.symbol0 : e.symbol1;
              const inAmt = e.amount0In > 0n ? e.amount0In : e.amount1In;
              const outAmt = e.amount0Out > 0n ? e.amount0Out : e.amount1Out;
              return (
                <a key={`${e.txHash}-${i}`} href={explorerTx(e.txHash)} target="_blank" rel="noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/40 text-sm border border-transparent hover:border-primary/30">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/15 grid place-items-center"><ArrowUpRight className="w-3.5 h-3.5 text-primary"/></div>
                    <div>
                      <div className="font-semibold text-xs">{inSym} → {outSym}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {Number(formatUnits(inAmt, 18)).toLocaleString(undefined,{maximumFractionDigits:4})} → {Number(formatUnits(outAmt, 18)).toLocaleString(undefined,{maximumFractionDigits:4})}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">#{e.blockNumber}</span>
                </a>
              );
            })}
            {!recent.length && <p className="text-sm text-muted-foreground text-center py-8">No recent swaps</p>}
          </div>
        </div>
      </div>

      {/* TVL distribution */}
      <div className="glass rounded-2xl p-5">
        <h2 className="font-bold mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-primary"/> TVL Distribution</h2>
        {!dist.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">No data</p>
        ) : (
          <div className="space-y-3">
            {dist.map((d, i) => {
              const pct = totalTVL > 0 ? (d.value / totalTVL) * 100 : 0;
              return (
                <div key={d.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold">{d.label}</span>
                    <span className="font-mono text-muted-foreground">{d.value.toLocaleString(undefined,{maximumFractionDigits:2})} • {pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full btn-primary-grad rounded-full" style={{ width: `${Math.max(2, pct)}%`, opacity: 1 - i*0.13 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const MiniStat = ({ icon: Icon, label, value }: any) => (
  <div className="glass rounded-2xl p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <Icon className="w-4 h-4 text-primary"/>
    </div>
    <div className="text-xl font-extrabold">{value}</div>
  </div>
);

export default Analytics;
