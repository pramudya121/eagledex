import { useEffect, useMemo, useRef, useState } from "react";
import { usePoolIndex, poolIndex, IndexedPool, PriceSample } from "@/lib/poolIndex";
import { TrendingUp, TrendingDown, ChevronDown } from "lucide-react";

type Range = "5m" | "1h" | "24h" | "all";
const RANGES: { id: Range; label: string; ms: number }[] = [
  { id: "5m",  label: "5m",  ms: 5 * 60_000 },
  { id: "1h",  label: "1h",  ms: 60 * 60_000 },
  { id: "24h", label: "24h", ms: 24 * 60 * 60_000 },
  { id: "all", label: "All", ms: Infinity },
];

interface Props { defaultPair?: string }

const PriceChart = ({ defaultPair }: Props) => {
  const state = usePoolIndex();
  const pools = useMemo(
    () => Object.values(state.pools).sort((a, b) =>
      Number(b.reserve0) > 0 && Number(a.reserve0) > 0
        ? (b.reserve0 > a.reserve0 ? 1 : -1) : 0),
    [state.pools, state.lastUpdated],
  );
  const [pair, setPair] = useState<string | null>(defaultPair ?? null);
  const [range, setRange] = useState<Range>("1h");
  const [open, setOpen] = useState(false);

  // Pick first pool with history when none selected
  useEffect(() => {
    if (pair && state.pools[pair.toLowerCase()]) return;
    const withHist = pools.find(p => (state.priceHistory[p.pair.toLowerCase()] ?? []).length > 1);
    if (withHist) setPair(withHist.pair);
    else if (pools.length) setPair(pools[0].pair);
  }, [pools, pair, state.priceHistory]);

  const pool: IndexedPool | undefined = pair ? state.pools[pair.toLowerCase()] : undefined;
  const allSamples: PriceSample[] = pair ? (state.priceHistory[pair.toLowerCase()] ?? []) : [];
  const cutoff = Date.now() - (RANGES.find(r => r.id === range)?.ms ?? Infinity);
  const samples = allSamples.filter(s => s.t >= cutoff);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary"/> Price Chart</h2>
          {pool && (
            <div className="relative">
              <button onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border hover:border-primary/60 text-xs font-semibold">
                {pool.logo0 && <img src={pool.logo0} className="w-4 h-4 rounded-full object-cover"/>}
                {pool.logo1 && <img src={pool.logo1} className="w-4 h-4 rounded-full object-cover -ml-1.5 border border-card"/>}
                {pool.symbol0}/{pool.symbol1}
                <ChevronDown className="w-3 h-3 opacity-60"/>
              </button>
              {open && (
                <div className="absolute z-20 top-full mt-1 left-0 w-56 max-h-72 overflow-y-auto rounded-xl bg-card border border-border shadow-2xl py-1 animate-fade-in">
                  {pools.map(p => (
                    <button key={p.pair} onClick={() => { setPair(p.pair); setOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/10 flex items-center gap-2 ${p.pair===pair?"text-primary font-bold":""}`}>
                      {p.logo0 && <img src={p.logo0} className="w-4 h-4 rounded-full object-cover"/>}
                      {p.symbol0}/{p.symbol1}
                      <span className="ml-auto text-[10px] text-muted-foreground">{(state.priceHistory[p.pair.toLowerCase()]?.length ?? 0)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-1 text-[11px]">
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)}
              className={`px-2.5 py-1 rounded-md font-bold ${range===r.id ? "btn-primary-grad text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {pool && samples.length > 1 ? (
        <Chart samples={samples} symbol0={pool.symbol0} symbol1={pool.symbol1} />
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {pool ? `Waiting for swap activity to plot ${pool.symbol0}/${pool.symbol1}…` : "No pool data yet"}
        </div>
      )}
    </div>
  );
};

const Chart = ({ samples, symbol0, symbol1 }: { samples: PriceSample[]; symbol0: string; symbol1: string }) => {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [w, setW] = useState(800);
  const h = 240;

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { path, area, last, first, min, max, points } = useMemo(() => {
    const pad = { l: 8, r: 8, t: 14, b: 18 };
    const innerW = Math.max(60, w - pad.l - pad.r);
    const innerH = h - pad.t - pad.b;
    const prices = samples.map(s => s.price);
    let mn = Math.min(...prices), mx = Math.max(...prices);
    if (mn === mx) { mn = mn * 0.999; mx = mx * 1.001; }
    const t0 = samples[0].t, t1 = samples[samples.length - 1].t;
    const dt = Math.max(1, t1 - t0);
    const pts = samples.map((s, i) => {
      const x = pad.l + ((s.t - t0) / dt) * innerW;
      const y = pad.t + (1 - (s.price - mn) / (mx - mn)) * innerH;
      return { x, y, s, i };
    });
    const path = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${path} L${pts[pts.length-1].x.toFixed(1)},${(pad.t+innerH).toFixed(1)} L${pts[0].x.toFixed(1)},${(pad.t+innerH).toFixed(1)} Z`;
    return { path, area, last: prices[prices.length-1], first: prices[0], min: mn, max: mx, points: pts };
  }, [samples, w]);

  const change = ((last - first) / first) * 100;
  const positive = change >= 0;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * w;
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - mx);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    setHover({ i: best, x: points[best].x, y: points[best].y });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-3xl font-extrabold tabular-nums">
            {last.toLocaleString(undefined, { maximumFractionDigits: 6 })}
            <span className="text-xs text-muted-foreground font-normal ml-1">{symbol1}/{symbol0}</span>
          </div>
          <div className={`text-xs font-bold flex items-center gap-1 ${positive ? "text-green-400" : "text-destructive"}`}>
            {positive ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
            {positive ? "+" : ""}{change.toFixed(3)}% • {samples.length} pts
          </div>
        </div>
        <div className="text-right text-[10px] text-muted-foreground font-mono">
          <div>High {max.toLocaleString(undefined,{maximumFractionDigits:6})}</div>
          <div>Low  {min.toLocaleString(undefined,{maximumFractionDigits:6})}</div>
        </div>
      </div>
      <div className="relative" style={{ height: h }}>
        <svg ref={ref} width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
          onMouseMove={onMove} onMouseLeave={() => setHover(null)}
          className="overflow-visible">
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.45"/>
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={area} fill="url(#chartFill)"/>
          <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
          {hover && (
            <>
              <line x1={hover.x} x2={hover.x} y1={0} y2={h} stroke="hsl(var(--border))" strokeDasharray="3 3"/>
              <circle cx={hover.x} cy={hover.y} r={4} fill="hsl(var(--primary))" stroke="black" strokeWidth="1.5"/>
            </>
          )}
        </svg>
        {hover && samples[hover.i] && (
          <div className="absolute pointer-events-none rounded-lg bg-card border border-border px-2.5 py-1.5 text-[10px] font-mono shadow-2xl"
            style={{ left: Math.min(w - 160, Math.max(0, hover.x + 8)), top: 4 }}>
            <div className="font-bold text-primary">{samples[hover.i].price.toLocaleString(undefined,{maximumFractionDigits:8})}</div>
            <div className="text-muted-foreground">{new Date(samples[hover.i].t).toLocaleTimeString()}</div>
            <div className="text-muted-foreground">blk #{samples[hover.i].block}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceChart;
