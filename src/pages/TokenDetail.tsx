import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Contract, formatUnits, parseEther, parseUnits } from "ethers";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Globe, Loader2, Send, Star, Twitter } from "lucide-react";
import Seo from "@/components/Seo";
import CandleChart from "@/components/CandleChart";
import { useWeb3 } from "@/lib/web3";
import { sendTx } from "@/lib/tx";
import { ERC20_ABI } from "@/lib/abis";
import { explorerAddr, INTEGRALAYER as CHAIN } from "@/lib/chain";
import { supabase } from "@/integrations/supabase/client";
import {
  getCurve, getLaunchToken, getLaunchFactory, listFavorites, listTrades, readCurveState,
  recordTrade, statsFromTrades, toCandles, toggleFavorite, NATIVE_SYMBOL,
  type CurveState, type LaunchToken, type Trade,
} from "@/lib/launchpad";

const TF = [
  { label: "1m", sec: 60 }, { label: "5m", sec: 300 }, { label: "15m", sec: 900 },
  { label: "1h", sec: 3600 }, { label: "4h", sec: 14400 }, { label: "1d", sec: 86400 },
];
const fmt = (n?: number | null, d = 6) =>
  n == null ? "—" : n !== 0 && Math.abs(n) < 0.000001 ? n.toExponential(2) : n.toLocaleString(undefined, { maximumFractionDigits: d });

const TokenDetail = () => {
  const { address = "" } = useParams();
  const { account, signer, readProvider } = useWeb3();
  const [meta, setMeta] = useState<LaunchToken | null>(null);
  const [curve, setCurve] = useState<string>("");
  const [state, setState] = useState<CurveState>({ available: false });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tf, setTf] = useState(300);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [fav, setFav] = useState(false);

  const loadChain = useCallback(async () => {
    let c = curve;
    if (!c) {
      try { c = await getLaunchFactory(readProvider as never).tokenToCurve(address) as string; } catch { c = ""; }
      if (c && /^0x0{40}$/i.test(c)) c = "";
      setCurve(c);
    }
    if (c) setState(await readCurveState(c, readProvider as never));
  }, [address, curve, readProvider]);

  useEffect(() => {
    getLaunchToken(address).then(m => { setMeta(m); if (m?.curve_address) setCurve(m.curve_address); }).catch(() => {});
    listTrades(address).then(setTrades).catch(() => {});
  }, [address]);

  useEffect(() => { loadChain(); }, [loadChain]);

  useEffect(() => { if (account) listFavorites(account).then(f => setFav(f.includes(address.toLowerCase()))).catch(() => {}); }, [account, address]);

  // Token balance of the connected wallet
  const loadBalance = useCallback(async () => {
    if (!account) { setBalance(null); return; }
    try {
      const erc = new Contract(address, ERC20_ABI, readProvider as never);
      const [b, d] = await Promise.all([erc.balanceOf(account) as Promise<bigint>, erc.decimals() as Promise<bigint>]);
      setBalance(Number(formatUnits(b, d)));
    } catch { setBalance(null); }
  }, [account, address, readProvider]);
  useEffect(() => { loadBalance(); }, [loadBalance]);

  // Realtime trades feed
  useEffect(() => {
    const ch = supabase.channel(`trades-${address}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "token_trades" }, payload => {
        const row = payload.new as Trade & { token_address: string };
        if (row.token_address?.toLowerCase() !== address.toLowerCase()) return;
        setTrades(prev => [...prev, row]);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [address]);

  const candles = useMemo(() => toCandles(trades, tf), [trades, tf]);
  const stats = useMemo(() => statsFromTrades(trades), [trades]);
  const price = state.priceNative ?? stats.price;

  const trade = async () => {
    if (!account || !signer) { toast.error("Connect your wallet first"); return; }
    if (!curve) { toast.error("No bonding curve found for this token"); return; }
    const v = Number(amount);
    if (!v || v <= 0) { toast.error("Enter an amount"); return; }
    setBusy(true);
    try {
      const c = getCurve(curve, signer as never);
      if (side === "buy") {
        await sendTx(`Buy ${meta?.symbol ?? "token"}`, () => c.buy(0n, { value: parseEther(amount) }));
        await recordTrade(address, { price: price ?? 0, amount: price ? v / price : 0, eth_amount: v, side: "buy", trader: account });
      } else {
        const erc = new Contract(address, ERC20_ABI, signer as never);
        const dec = Number(await erc.decimals());
        const wei = parseUnits(amount, dec);
        const allowance = await erc.allowance(account, curve) as bigint;
        if (allowance < wei) await sendTx("Approve", () => erc.approve(curve, wei));
        await sendTx(`Sell ${meta?.symbol ?? "token"}`, () => c.sell(wei, 0n));
        await recordTrade(address, { price: price ?? 0, amount: v, eth_amount: price ? v * price : 0, side: "sell", trader: account });
      }
      setAmount("");
      await Promise.all([loadChain(), loadBalance()]);
      listTrades(address).then(setTrades).catch(() => {});
    } catch (e: unknown) {
      const msg = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as { message?: string })?.message ?? "Transaction failed";
      if (!/reverted|rejected|Wrong network/i.test(msg)) toast.error("Trade failed", { description: msg });
    } finally { setBusy(false); }
  };

  const star = async () => {
    if (!account) { toast.error("Connect your wallet to save favorites"); return; }
    const on = !fav; setFav(on);
    try { await toggleFavorite(account, address, on); } catch { /* optimistic */ }
  };

  const name = meta?.name ?? "Token";
  const symbol = meta?.symbol ?? "???";

  return (
    <div className="animate-slide-up neon-scope space-y-5">
      <Seo title={`${name} (${symbol}) — EAGLEDEX Launchpad`}
        description={`Live price chart and bonding-curve trading for ${name} (${symbol}) on ${CHAIN.name}.`}
        path={`/launchpad/${address}`} />

      <Link to="/launchpad" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Launchpad
      </Link>

      {/* HEADER */}
      <div className="glass rounded-3xl p-5 flex flex-wrap items-center gap-4">
        {meta?.logoUrl
          ? <img src={meta.logoUrl} alt={`${symbol} logo`} className="w-14 h-14 rounded-full object-cover" />
          : <div className="w-14 h-14 rounded-full btn-primary-grad grid place-items-center text-primary-foreground font-extrabold">{symbol.slice(0, 3)}</div>}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold truncate">{name}</h1>
            <span className="text-xs text-muted-foreground font-bold">{symbol}</span>
            <button onClick={star} className="p-1 rounded-full hover:bg-primary/10">
              <Star className={`w-4 h-4 ${fav ? "text-primary fill-primary" : "text-muted-foreground"}`} />
            </button>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
            <a href={explorerAddr(address)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              {address.slice(0, 8)}…{address.slice(-6)} <ExternalLink className="w-3 h-3" />
            </a>
            {meta?.website && <a href={meta.website} target="_blank" rel="noreferrer" className="hover:text-foreground"><Globe className="w-3.5 h-3.5" /></a>}
            {meta?.twitter && <a href={meta.twitter} target="_blank" rel="noreferrer" className="hover:text-foreground"><Twitter className="w-3.5 h-3.5" /></a>}
            {meta?.telegram && <a href={meta.telegram} target="_blank" rel="noreferrer" className="hover:text-foreground"><Send className="w-3.5 h-3.5" /></a>}
          </div>
        </div>
        <div className="ml-auto grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
          <Stat label="Price" value={`${fmt(price, 8)}`} />
          <Stat label="24h" value={stats.change24h == null ? "—" : `${stats.change24h >= 0 ? "+" : ""}${stats.change24h.toFixed(1)}%`} />
          <Stat label={`Vol 24h ${NATIVE_SYMBOL}`} value={fmt(stats.volume24h, 3)} />
          <Stat label={`Liquidity ${NATIVE_SYMBOL}`} value={fmt(state.liquidityNative, 3)} />
        </div>
      </div>

      {state.progress != null && (
        <div className="glass rounded-3xl p-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="font-bold">{state.graduated ? "Graduated to DEX pool" : "Bonding curve progress"}</span>
            <span className="text-muted-foreground">{state.progress.toFixed(2)}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full btn-primary-grad transition-all" style={{ width: `${Math.min(100, state.progress)}%` }} />
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
        {/* CHART */}
        <div className="glass rounded-3xl p-4">
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {TF.map(t => (
              <button key={t.label} onClick={() => setTf(t.sec)}
                className={`px-3 h-8 rounded-full text-[11px] font-bold border transition ${
                  tf === t.sec ? "btn-primary-grad text-primary-foreground border-transparent" : "border-border text-muted-foreground"}`}>
                {t.label}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground">{trades.length} trades indexed</span>
          </div>
          {candles.length === 0
            ? <div className="h-[340px] grid place-items-center text-sm text-muted-foreground">No trades yet — the first buy prints the first candle.</div>
            : <CandleChart candles={candles} />}
        </div>

        {/* TRADE PANEL */}
        <div className="glass rounded-3xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-secondary/50">
            {(["buy", "sell"] as const).map(s => (
              <button key={s} onClick={() => setSide(s)}
                className={`h-10 rounded-xl text-sm font-extrabold capitalize transition ${
                  side === s ? (s === "buy" ? "btn-primary-grad text-primary-foreground" : "bg-destructive text-destructive-foreground") : "text-muted-foreground"}`}>
                {s}
              </button>
            ))}
          </div>

          <label className="block">
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
              <span>Amount ({side === "buy" ? NATIVE_SYMBOL : symbol})</span>
              {side === "sell" && balance != null && (
                <button onClick={() => setAmount(String(balance))} className="font-bold text-primary">
                  Balance {fmt(balance, 4)}
                </button>
              )}
            </div>
            <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.0" inputMode="decimal"
              className="w-full h-14 px-4 rounded-2xl bg-card border border-border text-lg font-bold outline-none focus:border-primary/60" />
          </label>

          {side === "buy" && (
            <div className="flex gap-2">
              {["0.1", "0.5", "1", "5"].map(v => (
                <button key={v} onClick={() => setAmount(v)}
                  className="flex-1 h-9 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:border-primary/60">
                  {v}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-2xl bg-secondary/40 p-3 text-xs space-y-1.5">
            <Row k="Price" v={`${fmt(price, 8)} ${NATIVE_SYMBOL}`} />
            <Row k="Est. receive" v={amount && price ? `${fmt(side === "buy" ? Number(amount) / price : Number(amount) * price, 6)} ${side === "buy" ? symbol : NATIVE_SYMBOL}` : "—"} />
            <Row k="Curve" v={curve ? `${curve.slice(0, 6)}…${curve.slice(-4)}` : "not found"} />
          </div>

          <button onClick={trade} disabled={busy || !curve}
            className={`w-full h-13 py-3.5 rounded-2xl font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-60 ${
              side === "buy" ? "btn-primary-grad text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                  : account ? `${side === "buy" ? "Buy" : "Sell"} ${symbol}` : "Connect wallet"}
          </button>

          {meta?.description && <p className="text-xs text-muted-foreground">{meta.description}</p>}
        </div>
      </div>

      {/* TRADES */}
      <div className="glass rounded-3xl p-4">
        <h2 className="font-bold text-sm mb-3">Recent trades</h2>
        {trades.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No trades yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="text-left"><th className="py-2">Time</th><th>Side</th><th>Price</th><th>Amount</th><th>{NATIVE_SYMBOL}</th><th>Trader</th></tr>
              </thead>
              <tbody>
                {[...trades].reverse().slice(0, 40).map(t => (
                  <tr key={t.id} className="border-t border-border/40">
                    <td className="py-2 text-muted-foreground">{new Date(t.created_at).toLocaleTimeString()}</td>
                    <td className={t.side === "buy" ? "text-primary font-bold" : "text-destructive font-bold"}>{t.side}</td>
                    <td>{fmt(Number(t.price), 8)}</td>
                    <td>{fmt(Number(t.amount), 4)}</td>
                    <td>{fmt(Number(t.eth_amount), 4)}</td>
                    <td className="text-muted-foreground">{t.trader ? `${t.trader.slice(0, 6)}…${t.trader.slice(-4)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-secondary/40 px-3 py-2 min-w-[92px]">
    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-sm font-extrabold truncate">{value}</div>
  </div>
);
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="font-bold truncate">{v}</span></div>
);

export default TokenDetail;
