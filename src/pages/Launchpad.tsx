import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Plus, Rocket, Search, Star, TrendingUp } from "lucide-react";
import Seo from "@/components/Seo";
import { useWeb3 } from "@/lib/web3";
import { INTEGRALAYER as CHAIN } from "@/lib/chain";
import {
  launchpadEnabled, listLaunchTokens, readOnchainLaunches, readCurveState,
  listFavorites, toggleFavorite, listTrades, statsFromTrades,
  type LaunchToken, NATIVE_SYMBOL,
} from "@/lib/launchpad";

type Row = LaunchToken;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmt = (n?: number | null, d = 6) =>
  n == null ? "—" : n < 0.000001 && n > 0 ? n.toExponential(2) : n.toLocaleString(undefined, { maximumFractionDigits: d });

const Launchpad = () => {
  const { readProvider, account } = useWeb3();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "volume" | "progress">("new");
  const [favs, setFavs] = useState<string[]>([]);
  const [onlyFavs, setOnlyFavs] = useState(false);

  useEffect(() => { if (account) listFavorites(account).then(setFavs).catch(() => {}); else setFavs([]); }, [account]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const meta = await listLaunchTokens().catch(() => [] as LaunchToken[]);
        const byAddr = new Map(meta.map(m => [m.token_address.toLowerCase(), { ...m } as Row]));
        // Chain is the source of truth — fold in launches without metadata.
        const chainList = await readOnchainLaunches(readProvider as never, 40).catch(() => []);
        for (const l of chainList) {
          const k = l.token.toLowerCase();
          const existing = byAddr.get(k);
          if (existing) { existing.curve_address = existing.curve_address || l.curve; continue; }
          byAddr.set(k, {
            token_address: l.token, curve_address: l.curve, creator: l.creator,
            name: l.name || "Unknown", symbol: l.symbol || "???",
            description: null, logo_path: null, website: null, twitter: null, telegram: null,
            total_supply: null, decimals: 18, verified: false, views: 0,
            created_at: new Date(l.createdAt * 1000).toISOString(),
          } as Row);
        }
        const list = [...byAddr.values()];
        if (alive) { setRows(list); setLoading(false); }

        // Enrich progressively (curve state + 24h stats) without blocking the grid.
        for (const r of list.slice(0, 24)) {
          const [state, trades] = await Promise.all([
            r.curve_address ? readCurveState(r.curve_address, readProvider as never) : Promise.resolve({ available: false }),
            listTrades(r.token_address, 400).catch(() => []),
          ]);
          const s = statsFromTrades(trades as never);
          if (!alive) return;
          setRows(prev => prev.map(p => p.token_address.toLowerCase() === r.token_address.toLowerCase()
            ? { ...p,
                priceNative: (state as never as { priceNative?: number }).priceNative ?? s.price,
                progress: (state as never as { progress?: number }).progress ?? null,
                liquidity: (state as never as { liquidityNative?: number }).liquidityNative ?? null,
                graduated: (state as never as { graduated?: boolean }).graduated,
                change24h: s.change24h, volume24h: s.volume24h }
            : p));
        }
      } catch { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [readProvider]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows.filter(r =>
      !needle || r.name.toLowerCase().includes(needle) || r.symbol.toLowerCase().includes(needle) ||
      r.token_address.toLowerCase().includes(needle));
    if (onlyFavs) list = list.filter(r => favs.includes(r.token_address.toLowerCase()));
    return list.sort((a, b) =>
      sort === "volume" ? (b.volume24h ?? 0) - (a.volume24h ?? 0)
      : sort === "progress" ? (b.progress ?? 0) - (a.progress ?? 0)
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [rows, q, sort, onlyFavs, favs]);

  const trending = useMemo(
    () => [...rows].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0)).slice(0, 3),
    [rows]);

  const onStar = async (addr: string) => {
    if (!account) return;
    const k = addr.toLowerCase();
    const on = !favs.includes(k);
    setFavs(p => on ? [...p, k] : p.filter(x => x !== k));
    try { await toggleFavorite(account, k, on); } catch { /* optimistic */ }
  };

  if (!launchpadEnabled()) {
    return (
      <div className="max-w-xl mx-auto glass rounded-3xl p-8 text-center">
        <Rocket className="w-10 h-10 mx-auto text-primary mb-3" />
        <h1 className="text-2xl font-extrabold mb-2">Launchpad unavailable</h1>
        <p className="text-sm text-muted-foreground">No launchpad contracts are configured for {CHAIN.name}.</p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up neon-scope space-y-8">
      <Seo title={`Launchpad — fair-launch tokens on ${CHAIN.name}`}
        description={`Discover, launch and trade bonding-curve tokens on EAGLEDEX Launchpad, live on ${CHAIN.name}.`}
        path="/launchpad" />

      <section className="glass rounded-3xl p-6 md:p-8 bg-gradient-to-br from-primary/10 via-transparent to-primary/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-semibold mb-3">
              <Flame className="w-3.5 h-3.5 text-primary" /> <span className="text-grad">Fair launch · bonding curve</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">EAGLEDEX <span className="text-grad">Launchpad</span></h1>
            <p className="text-sm text-muted-foreground max-w-lg mt-2">
              Launch a token in seconds, trade it instantly on its curve, and graduate to a real pool once the curve fills.
            </p>
          </div>
          <Link to="/launchpad/create"
            className="btn-primary-grad text-primary-foreground rounded-2xl px-6 h-12 inline-flex items-center gap-2 font-bold">
            <Plus className="w-4 h-4" /> Create Token
          </Link>
        </div>
      </section>

      {trending.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 font-bold mb-3"><TrendingUp className="w-4 h-4 text-primary" /> Trending</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {trending.map(t => <Card key={`t-${t.token_address}`} row={t} fav={favs.includes(t.token_address.toLowerCase())} onStar={onStar} />)}
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, symbol or address"
              className="w-full h-11 pl-9 pr-3 rounded-2xl bg-card border border-border text-sm outline-none focus:border-primary/60" />
          </div>
          {(["new", "volume", "progress"] as const).map(s => (
            <button key={s} onClick={() => setSort(s)}
              className={`h-11 px-4 rounded-2xl text-xs font-bold border transition ${
                sort === s ? "btn-primary-grad text-primary-foreground border-transparent" : "border-border text-muted-foreground"}`}>
              {s === "new" ? "Newest" : s === "volume" ? "Volume 24h" : "Progress"}
            </button>
          ))}
          <button onClick={() => setOnlyFavs(v => !v)} disabled={!account}
            title={account ? "Show favorites only" : "Connect wallet to use favorites"}
            className={`h-11 px-4 rounded-2xl text-xs font-bold border transition disabled:opacity-40 ${
              onlyFavs ? "btn-primary-grad text-primary-foreground border-transparent" : "border-border text-muted-foreground"}`}>
            <Star className="w-3.5 h-3.5 inline mr-1" /> Favorites
          </button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="glass rounded-3xl h-40 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">
            No tokens yet. Be the first to <Link to="/launchpad/create" className="text-primary font-bold">launch one</Link>.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(r => <Card key={r.token_address} row={r} fav={favs.includes(r.token_address.toLowerCase())} onStar={onStar} />)}
          </div>
        )}
      </section>
    </div>
  );
};

const Card = ({ row, fav, onStar }: { row: Row; fav: boolean; onStar: (a: string) => void }) => (
  <div className="glass rounded-3xl p-4 hover:-translate-y-1 transition relative">
    <button onClick={() => onStar(row.token_address)} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-primary/10">
      <Star className={`w-4 h-4 ${fav ? "text-primary fill-primary" : "text-muted-foreground"}`} />
    </button>
    <Link to={`/launchpad/${row.token_address}`} className="block">
      <div className="flex items-center gap-3">
        {row.logoUrl
          ? <img src={row.logoUrl} alt={`${row.symbol} logo`} className="w-11 h-11 rounded-full object-cover" />
          : <div className="w-11 h-11 rounded-full btn-primary-grad grid place-items-center text-primary-foreground font-extrabold text-xs">
              {row.symbol.slice(0, 3).toUpperCase()}
            </div>}
        <div className="min-w-0">
          <div className="font-bold truncate">{row.name}</div>
          <div className="text-[11px] text-muted-foreground">{row.symbol} · {short(row.token_address)}</div>
        </div>
      </div>
      {row.description && <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{row.description}</p>}
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <Mini label="Price" value={fmt(row.priceNative, 8)} />
        <Mini label="24h" value={row.change24h == null ? "—" : `${row.change24h >= 0 ? "+" : ""}${row.change24h.toFixed(1)}%`}
          tone={row.change24h == null ? undefined : row.change24h >= 0 ? "up" : "down"} />
        <Mini label={`Liq ${NATIVE_SYMBOL}`} value={fmt(row.liquidity, 3)} />
      </div>
      {row.progress != null && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{row.graduated ? "Graduated" : "Curve progress"}</span><span>{row.progress.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full btn-primary-grad" style={{ width: `${Math.min(100, row.progress)}%` }} />
          </div>
        </div>
      )}
    </Link>
  </div>
);

const Mini = ({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) => (
  <div className="rounded-xl bg-secondary/40 p-2">
    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={`text-xs font-bold truncate ${tone === "up" ? "text-primary" : tone === "down" ? "text-destructive" : ""}`}>{value}</div>
  </div>
);

export default Launchpad;
