import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, HistogramSeries, type IChartApi } from "lightweight-charts";
import type { Candle } from "@/lib/launchpad";

/** Candlestick + volume chart driven by aggregated trade candles. */
const CandleChart = ({ candles, height = 340 }: { candles: Candle[]; height?: number }) => {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const priceRef = useRef<any>(null);
  const volRef = useRef<any>(null);

  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      height,
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(226,232,240,0.7)",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      timeScale: { borderColor: "rgba(148,163,184,0.15)", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
    });
    priceRef.current = c.addSeries(CandlestickSeries, {
      upColor: "#22d3ee", downColor: "#f43f5e",
      borderUpColor: "#22d3ee", borderDownColor: "#f43f5e",
      wickUpColor: "#22d3ee", wickDownColor: "#f43f5e",
      priceFormat: { type: "price", precision: 8, minMove: 0.00000001 },
    });
    volRef.current = c.addSeries(HistogramSeries, {
      color: "rgba(34,211,238,0.35)",
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chart.current = c;
    const ro = new ResizeObserver(() => c.applyOptions({ width: box.current?.clientWidth ?? 0 }));
    ro.observe(box.current);
    c.applyOptions({ width: box.current.clientWidth });
    return () => { ro.disconnect(); c.remove(); chart.current = null; };
  }, [height]);

  useEffect(() => {
    if (!priceRef.current) return;
    priceRef.current.setData(candles.map(k => ({ time: k.time as any, open: k.open, high: k.high, low: k.low, close: k.close })));
    volRef.current?.setData(candles.map(k => ({
      time: k.time as any, value: k.volume,
      color: k.close >= k.open ? "rgba(34,211,238,0.35)" : "rgba(244,63,94,0.35)",
    })));
    chart.current?.timeScale().fitContent();
  }, [candles]);

  return <div ref={box} className="w-full" />;
};

export default CandleChart;
