import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IndexedPool, PriceSample, poolIndex, poolTVL, poolPrice, poolVolumeWindow } from "@/lib/poolIndex";
import { TrendingUp, TrendingDown, Activity, Layers, ExternalLink } from "lucide-react";
import { explorerAddr } from "@/lib/chain";

type Range = "5m" | "1h" | "24h" | "7d" | "all";
const RANGES: { id: Range; label: string; ms: number; bucketMs: number }[] = [
  { id: "5m",  label: "5m",  ms: 5 * 60_000,        bucketMs: 15_000 },
  { id: "1h",  label: "1h",  ms: 60 * 60_000,       bucketMs: 60_000 },
  { id: "24h", label: "24h", ms: 24 * 60 * 60_000,  bucketMs: 30 * 60_000 },
  { id: "7d",  label: "7d",  ms: 7 * 24 * 60 * 60_000, bucketMs: 4 * 60 * 60_000 },
  { id: "all", label: "All", ms: Infinity, bucketMs: 60 * 60_000 },
];

interface Candle { t: number; o: number; h: number; l: number; c: number; v: number; }

function bucketize(samples: PriceSample[], bucketMs: number): Candle[] {
  if (!samples.length) return [];
  const out: Candle[] = [];
  let cur: Candle | null = null;
  for (const s of samples) {
    const bk = Math.floor(s.t / bucketMs) * bucketMs;
    if (!cur || cur.t !== bk) {
      if (cur) out.push(cur);
      cur = { t: bk, o: s.price, h: s.price, l: s.price, c: s.price, v: s.volume };
    } else {
      cur.h = Math.max(cur.h, s.price);
      cur.l = Math.min(cur.l, s.price);
      cur.c = s.price;
      cur.v += s.volume;
    }
  }
  if (cur) out.push(cur);
  return out;
}

interface Props { pool: IndexedPool; open: boolean; onOpenChange: (o: boolean) => void; }

const PoolChartDialog = ({ pool, open, onOpenChange }: Props) => {
  const [range, setRange] = useState<Range>("1h");
  const [, force] = useState(0);

  // Re-render when indexer pushes new samples
  useEffect(() => {
    if (!open) return;
    return poolIndex.subscribe(() => force(n => n + 1));
  }, [open]);

  const cfg = RANGES.find(r => r.id === range)!;
  const all = poolIndex.getPriceHistory(pool.pair);
  const cutoff = Date.now() - cfg.ms;
  const filtered = all.filter(s => s.t >= cutoff);
  const candles = useMemo(() => bucketize(filtered, cfg.bucketMs), [filtered, cfg.bucketMs]);

  const tvl = poolTVL(pool);
  const price = poolPrice(pool);
  const vol24 = poolVolumeWindow(pool.pair, 24 * 60 * 60_000);
  const lastClose = candles.length ? candles[candles.length - 1].c : price;
  const firstOpen = candles.length ? candles[0].o : price;
  const change = firstOpen > 0 ? ((lastClose - firstOpen) / firstOpen) * 100 : 0;
  const positive = change >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="form-surface max-w-3xl !rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <div className="flex -space-x-2">
              {pool.logo0 && <img src={pool.logo0} className="w-7 h-7 rounded-full border-2 border-card object-cover"/>}
              {pool.logo1 && <img src={pool.logo1} className="w-7 h-7 rounded-full border-2 border-card object-cover"/>}
            </div>
            <span className="font-extrabold">{pool.symbol0} / {pool.symbol1}</span>
            <a href={explorerAddr(pool.pair)} target="_blank" rel="noreferrer"
              className="text-muted-foreground hover:text-primary text-xs font-mono flex items-center gap-1">
              {pool.pair.slice(0,8)}…{pool.pair.slice(-6)} <ExternalLink className="w-3 h-3"/>
            </a>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Stat icon={<TrendingUp className="w-3 h-3"/>} label="Price" value={price.toLocaleString(undefined,{maximumFractionDigits:6})} sub={`${pool.symbol1}/${pool.symbol0}`} />
          <Stat icon={<Layers className="w-3 h-3"/>} label="TVL" value={tvl.toLocaleString(undefined,{maximumFractionDigits:2})} />
          <Stat icon={<Activity className="w-3 h-3"/>} label="Vol 24h" value={vol24.toLocaleString(undefined,{maximumFractionDigits:2})} />
          <Stat icon={<Activity className="w-3 h-3"/>} label="Swaps" value={String(pool.swapCount)} />
        </div>

        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="text-2xl font-extrabold tabular-nums">
              {lastClose.toLocaleString(undefined,{maximumFractionDigits:8})}
            </div>
            <div className={`text-xs font-bold flex items-center gap-1 ${positive?"text-green-400":"text-destructive"}`}>
              {positive ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
              {positive?"+":""}{change.toFixed(3)}% · {candles.length} candles
            </div>
          </div>
          <div className="flex gap-1 text-[11px]">
            {RANGES.map(r => (
              <button key={r.id} onClick={() => setRange(r.id)}
                className={`px-2.5 py-1 rounded-md font-bold ${range===r.id?"btn-primary-grad text-primary-foreground":"bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {candles.length > 1 ? (
          <CandleChart candles={candles} symbol0={pool.symbol0} symbol1={pool.symbol1} />
        ) : (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Waiting for swap activity to plot candles…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({ icon, label, value, sub }: any) => (
  <div className="rounded-xl bg-secondary/40 p-2.5">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon}{label}</div>
    <div className="font-bold font-mono text-sm truncate">{value}</div>
    {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
  </div>
);

const CandleChart = ({ candles, symbol0, symbol1 }: { candles: Candle[]; symbol0: string; symbol1: string }) => {
  const ref = useRef<SVGSVGElement>(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState<number | null>(null);
  const priceH = 240;
  const volH = 60;
  const totalH = priceH + volH + 8;

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const pad = { l: 8, r: 48, t: 8, b: 4 };
    const innerW = Math.max(60, w - pad.l - pad.r);
    const slot = innerW / candles.length;
    const cw = Math.max(2, Math.min(14, slot * 0.7));

    const highs = candles.map(c => c.h), lows = candles.map(c => c.l);
    let mn = Math.min(...lows), mx = Math.max(...highs);
    if (mn === mx) { mn = mn * 0.999; mx = mx * 1.001; }
    const py = (p: number) => pad.t + (1 - (p - mn) / (mx - mn)) * (priceH - pad.t - pad.b);

    const maxV = Math.max(1, ...candles.map(c => c.v));
    const vy = (v: number) => priceH + 8 + (1 - v / maxV) * volH;

    const items = candles.map((c, i) => {
      const x = pad.l + slot * i + slot / 2;
      const up = c.c >= c.o;
      return {
        i, c, x, up, cw,
        yHigh: py(c.h), yLow: py(c.l),
        yOpen: py(c.o), yClose: py(c.c),
        vY: vy(c.v), vH: priceH + 8 + volH - vy(c.v),
      };
    });

    return { items, mn, mx, maxV, pad };
  }, [candles, w]);

  const last = candles[candles.length - 1];
  const hov = hover != null ? candles[hover] : null;

  return (
    <div className="relative" style={{ height: totalH }}>
      <svg ref={ref} width="100%" height={totalH} viewBox={`0 0 ${w} ${totalH}`} preserveAspectRatio="none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = ((e.clientX - rect.left) / rect.width) * w;
          let best = 0, bd = Infinity;
          for (const it of layout.items) {
            const d = Math.abs(it.x - mx);
            if (d < bd) { bd = d; best = it.i; }
          }
          setHover(best);
        }}
        onMouseLeave={() => setHover(null)}
        className="overflow-visible">
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const y = layout.pad.t + f * (priceH - layout.pad.t - layout.pad.b);
          const p = layout.mx - f * (layout.mx - layout.mn);
          return (
            <g key={i}>
              <line x1={layout.pad.l} x2={w - layout.pad.r} y1={y} y2={y} stroke="hsl(var(--border))" strokeOpacity="0.3" strokeDasharray="2 4"/>
              <text x={w - layout.pad.r + 4} y={y + 3} fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                {p.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </text>
            </g>
          );
        })}

        {/* candles */}
        {layout.items.map(it => {
          const color = it.up ? "hsl(142 71% 45%)" : "hsl(0 72% 56%)";
          const bodyTop = Math.min(it.yOpen, it.yClose);
          const bodyH = Math.max(1, Math.abs(it.yClose - it.yOpen));
          return (
            <g key={it.i} opacity={hover != null && hover !== it.i ? 0.55 : 1}>
              <line x1={it.x} x2={it.x} y1={it.yHigh} y2={it.yLow} stroke={color} strokeWidth="1"/>
              <rect x={it.x - it.cw/2} y={bodyTop} width={it.cw} height={bodyH} fill={color} rx="1"/>
              <rect x={it.x - it.cw/2} y={it.vY} width={it.cw} height={Math.max(1, it.vH)} fill={color} opacity="0.45" rx="1"/>
            </g>
          );
        })}

        {/* hover crosshair */}
        {hov && hover != null && (
          <line x1={layout.items[hover].x} x2={layout.items[hover].x} y1={0} y2={totalH}
            stroke="hsl(var(--border))" strokeDasharray="3 3"/>
        )}

        {/* divider between price & volume */}
        <line x1={layout.pad.l} x2={w - layout.pad.r} y1={priceH + 4} y2={priceH + 4} stroke="hsl(var(--border))" strokeOpacity="0.4"/>
      </svg>

      {hov && (
        <div className="absolute pointer-events-none rounded-lg bg-card border border-border px-2.5 py-1.5 text-[10px] font-mono shadow-2xl space-y-0.5"
          style={{ left: Math.min(w - 200, Math.max(0, layout.items[hover!].x + 10)), top: 4 }}>
          <div className="text-[9px] text-muted-foreground">{new Date(hov.t).toLocaleString()}</div>
          <div>O <span className="text-foreground">{hov.o.toLocaleString(undefined,{maximumFractionDigits:8})}</span></div>
          <div>H <span className="text-green-400">{hov.h.toLocaleString(undefined,{maximumFractionDigits:8})}</span></div>
          <div>L <span className="text-destructive">{hov.l.toLocaleString(undefined,{maximumFractionDigits:8})}</span></div>
          <div>C <span className={hov.c >= hov.o ? "text-green-400" : "text-destructive"}>{hov.c.toLocaleString(undefined,{maximumFractionDigits:8})}</span></div>
          <div className="text-muted-foreground">Vol {hov.v.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
        </div>
      )}
    </div>
  );
};

export default PoolChartDialog;
