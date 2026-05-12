import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight, Droplets, Layers, BarChart3, Briefcase, Shield, Zap,
  CheckCircle2, Circle, Clock, Coins, Repeat, BookOpen, Search, Send,
  Wallet, Coins as Faucet, Sparkles, Lock, Flame, Code2, FileCode,
  TrendingUp, Activity, History, Map, HelpCircle, ChevronRight, Lightbulb,
} from "lucide-react";
import Logo from "@/components/Logo";
import { CONTRACTS, INTEGRALAYER, explorerAddr, TOKENS, CHAINS, getActiveChain } from "@/lib/chain";
import { Globe } from "lucide-react";

/* ---------- Sidebar config (mirrors the reference layout) ---------- */
type NavItem = { id: string; label: string; icon: any };
type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "Getting Started",
    items: [
      { id: "intro",   label: "Introduction",     icon: Sparkles },
      { id: "wallet",  label: "Connect Wallet",   icon: Wallet },
      { id: "faucet",  label: "Get Testnet Tokens", icon: Faucet },
    ],
  },
  {
    title: "User Guides",
    items: [
      { id: "swap",      label: "How to Swap",       icon: ArrowLeftRight },
      { id: "liquidity", label: "Provide Liquidity", icon: Droplets },
      { id: "portfolio", label: "Portfolio & Send",  icon: Briefcase },
      { id: "analytics", label: "Analytics & Pairs", icon: BarChart3 },
    ],
  },
  {
    title: "DeFi Concepts",
    items: [
      { id: "amm",         label: "AMM & Pricing",        icon: TrendingUp },
      { id: "il",          label: "Impermanent Loss",     icon: Activity },
      { id: "slippage",    label: "Slippage & Price Impact", icon: Zap },
      { id: "lp-tokens",   label: "LP Tokens & Fees",     icon: Coins },
    ],
  },
  {
    title: "Technical",
    items: [
      { id: "networks",    label: "Networks",          icon: Globe },
      { id: "stack",       label: "Technology Stack",  icon: Code2 },
      { id: "contracts",   label: "Smart Contracts",   icon: FileCode },
      { id: "tokens",      label: "Supported Tokens",  icon: Layers },
    ],
  },
  {
    title: "Roadmap & FAQ",
    items: [
      { id: "roadmap", label: "Development Roadmap", icon: Map },
      { id: "faq",     label: "FAQ",                 icon: HelpCircle },
    ],
  },
];

/* ---------- Roadmap data ---------- */
type Phase = { phase: string; title: string; status: "done" | "in_progress" | "todo"; items: string[] };
const ROADMAP: Phase[] = [
  { phase: "Phase 1", title: "Foundation — Core AMM", status: "done", items: [
    "Deploy UniswapV2-style Factory + Router on Integralayer testnet",
    "Native IRL ↔ WIRL wrap/unwrap",
    "Multi-wallet support: MetaMask, OKX, Rabby, Bitget",
    "Constant-product pools with x · y = k",
  ]},
  { phase: "Phase 2", title: "Trading UX — Swap, Liquidity, Indexing", status: "done", items: [
    "Premium SPA: Swap, Liquidity, Pools, Analytics, Portfolio",
    "Live on-chain pool indexer (Sync/Swap/Mint/Burn subscriptions)",
    "Adaptive RPC fallback when subgraph is unavailable",
    "Gas pre-flight + revert reason surfaced in the UI",
    "Persistent transaction history with pending / confirmed / failed states",
    "Premium multi-wallet connect dialog (MetaMask, Rabby, OKX, Bitget, SubWallet, Coinbase, Rainbow, WalletConnect)",
  ]},
  { phase: "Phase 3", title: "Multi-Chain Expansion", status: "done", items: [
    "Network switcher in header — pick any supported chain on the fly",
    "Second deployment on Arc Testnet (chainId 5042002, native USDC)",
    "Per-chain contract registry: Factory, Router, Wrapped native, Library, Multicall, Farm",
    "Per-chain token registry & per-chain indexer cache (no data mixing on switch)",
    "Wallet auto-adds the chain via wallet_addEthereumChain on first switch",
  ]},
  { phase: "Phase 4", title: "Growth — Incentives & Analytics", status: "in_progress", items: [
    "Liquidity mining with EGDX rewards on every supported chain",
    "Cloud-indexed cross-user volume (24h / 7d) via Postgres",
    "Historical TVL/volume charts (7d, 30d, all-time)",
    "Position P&L and impermanent-loss tracker",
  ]},
  { phase: "Phase 5", title: "Mainnet — Audit & Launch", status: "todo", items: [
    "Full smart-contract audit",
    "Mainnet deployments",
    "Cross-chain bridge & unified liquidity routing",
    "Limit orders, TWAP routing, V3-style concentrated liquidity",
  ]},
];

const PhaseIcon = ({ status }: { status: Phase["status"] }) => {
  if (status === "done") return <CheckCircle2 className="w-5 h-5 text-green-400" />;
  if (status === "in_progress") return <Clock className="w-5 h-5 text-yellow-400 animate-pulse" />;
  return <Circle className="w-5 h-5 text-muted-foreground" />;
};

/* ---------- Reusable bits ---------- */
const Section = ({ id, title, kicker, children }: any) => (
  <section id={id} className="scroll-mt-24">
    {kicker && <div className="text-[11px] uppercase tracking-[0.18em] text-primary font-bold mb-1">{kicker}</div>}
    <h2 className="text-2xl md:text-3xl font-extrabold mb-4 text-grad">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

const FeatureCard = ({ icon: Icon, title, desc, accent = "primary" }: any) => (
  <div className="glass rounded-2xl p-5 hover:-translate-y-0.5 hover:border-primary/50 transition group">
    <div className={`w-10 h-10 rounded-xl mb-3 grid place-items-center ${
      accent === "green" ? "bg-green-500/15 text-green-400" :
      accent === "orange" ? "bg-orange-500/15 text-orange-400" :
      accent === "blue" ? "bg-blue-500/15 text-blue-400" :
      accent === "purple" ? "bg-fuchsia-500/15 text-fuchsia-400" :
      "bg-primary/15 text-primary"
    }`}>
      <Icon className="w-5 h-5" />
    </div>
    <h3 className="font-bold text-foreground mb-1">{title}</h3>
    <p className="text-xs text-muted-foreground">{desc}</p>
  </div>
);

/* ---------- Page ---------- */
const Docs = () => {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<string>("intro");

  // Highlight current section based on scroll position
  useEffect(() => {
    const ids = NAV.flatMap(g => g.items.map(i => i.id));
    const onScroll = () => {
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top - 120 <= 0) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filteredNav = useMemo(() => {
    if (!q.trim()) return NAV;
    const needle = q.toLowerCase();
    return NAV
      .map(g => ({ ...g, items: g.items.filter(i => i.label.toLowerCase().includes(needle)) }))
      .filter(g => g.items.length > 0);
  }, [q]);

  const chain = getActiveChain();
  const contracts: { label: string; addr: string }[] = [
    { label: "Factory",                              addr: CONTRACTS.FACTORY },
    { label: "Router",                               addr: CONTRACTS.ROUTER },
    { label: `Wrapped Native (${chain.wrappedToken.symbol})`, addr: CONTRACTS.WETH },
    { label: "Library",                              addr: CONTRACTS.LIBRARY },
    { label: "Multicall",                            addr: CONTRACTS.MULTICALL },
    { label: "Farm (MasterChef)",                    addr: CONTRACTS.FARM },
    ...(CONTRACTS.FAUCET ? [{ label: "Faucet", addr: CONTRACTS.FAUCET }] : []),
  ];

  return (
    <div className="max-w-7xl mx-auto animate-slide-up">
      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        {/* ============== SIDEBAR ============== */}
        <aside className="lg:sticky lg:top-20 self-start">
          <div className="glass rounded-2xl p-3 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search docs..."
                className="w-full bg-card border border-border rounded-lg pl-8 pr-2 h-9 text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <nav className="space-y-4">
              {filteredNav.map(group => (
                <div key={group.title}>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/80 font-bold px-2 mb-1.5">
                    {group.title}
                  </div>
                  <ul className="space-y-0.5">
                    {group.items.map(item => {
                      const Icon = item.icon;
                      const isActive = active === item.id;
                      return (
                        <li key={item.id}>
                          <a
                            href={`#${item.id}`}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                              isActive
                                ? "bg-primary/15 text-primary border border-primary/30"
                                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{item.label}</span>
                            {isActive && <ChevronRight className="w-3 h-3 ml-auto shrink-0" />}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {filteredNav.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No matches</p>
              )}
            </nav>
          </div>
        </aside>

        {/* ============== MAIN ============== */}
        <main className="space-y-12 min-w-0">
          {/* Welcome hero */}
          <section id="intro" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <Logo size={56} />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
              Welcome to <span className="text-grad">EAGLEDEX</span>
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-3xl">
              EAGLEDEX is a <span className="text-foreground font-semibold">multi-chain decentralized exchange</span>{" "}
              powered by the battle-tested <span className="text-foreground font-semibold">UniswapV2 protocol</span>.
              It runs natively on{" "}
              {CHAINS.map((c, i) => (
                <span key={c.key}>
                  <span className="text-foreground font-semibold">{c.name}</span>
                  {i < CHAINS.length - 2 ? ", " : i === CHAINS.length - 2 ? " and " : ""}
                </span>
              ))}
              {" "}— switch any time from the network selector in the header.
              You're currently viewing docs for <span className="text-primary font-bold">{chain.name}</span>{" "}
              (chainId {chain.chainId}).
            </p>

            {/* Top hero feature row — like the screenshot */}
            <div className="grid sm:grid-cols-3 gap-3 mt-6">
              <FeatureCard icon={Lock}  title="Non-Custodial" desc="You always maintain full control over your assets." accent="green" />
              <FeatureCard icon={Flame} title="Multi-Chain"   desc={`Live on ${CHAINS.length} testnets — pick from the header.`} accent="orange" />
              <FeatureCard icon={Code2} title="Open Source"   desc="Verified and transparent smart contracts." accent="blue" />
            </div>

            {/* Tip banner */}
            <div className="mt-5 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl btn-primary-grad grid place-items-center text-primary-foreground shrink-0">
                <Lightbulb className="w-4 h-4" />
              </div>
              <p className="text-sm">
                <span className="font-bold text-foreground">New to DeFi?</span> Start by connecting your wallet,
                getting testnet tokens from the faucet, then try your first swap. Use the docs sidebar for help anytime!
              </p>
            </div>

            {/* Key features grid (2 cols, like reference) */}
            <h2 className="flex items-center gap-2 font-extrabold text-xl md:text-2xl mt-8 mb-4">
              <Sparkles className="w-5 h-5 text-primary" /> Key Features
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <FeatureCard icon={ArrowLeftRight} title="Token Swap"      desc="Instantly trade tokens with AMM pricing." accent="primary" />
              <FeatureCard icon={Droplets}       title="Liquidity Pools" desc="Provide liquidity and earn 0.30% fees." accent="blue" />
              <FeatureCard icon={BarChart3}      title="Analytics"       desc="Real-time charts, TVL, volume, pair data." accent="purple" />
              <FeatureCard icon={Briefcase}      title="Portfolio"       desc="Track holdings, LP positions, send tokens." accent="orange" />
              <FeatureCard icon={Coins}          title="EGDX Token"      desc="Native governance & utility token (EGDX)." accent="primary" />
              <FeatureCard icon={History}        title="History"         desc="Complete transaction history with details." accent="green" />
            </div>
          </section>

          {/* Connect wallet */}
          <Section id="wallet" kicker="Getting started" title="Connect your wallet">
            <p>
              Click <span className="text-foreground font-semibold">Connect Wallet</span> in the header. EAGLEDEX
              works with MetaMask, OKX, Rabby, Bitget, Coinbase, Rainbow, SubWallet and WalletConnect. The first
              time you connect, the app will offer to add the active network automatically — currently{" "}
              <span className="text-foreground font-semibold">{chain.name}</span> (chainId {chain.chainId}).
              Use the <span className="text-foreground font-semibold">network switcher</span> next to the wallet
              button to jump between chains; the app will reload with that chain's contracts and tokens.
            </p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Open the wallet menu in the top-right corner.</li>
              <li>Pick a wallet provider — installed wallets are detected automatically.</li>
              <li>Approve the connection request and the network-add prompt if shown.</li>
              <li>(Optional) Click the globe icon in the header to switch to another supported chain.</li>
            </ol>
          </Section>

          {/* Faucet */}
          <Section id="faucet" kicker="Getting started" title="Get testnet tokens">
            <p>
              You'll need a small amount of native <span className="text-foreground font-semibold">{chain.symbol}</span> for
              gas, plus any ERC-20s you want to trade. {CONTRACTS.FAUCET ? (
                <>Use the in-app <Link to="/faucet" className="text-primary hover:underline">Faucet</Link> to claim test tokens.</>
              ) : (
                <>The Faucet contract is not deployed on this chain yet — bridge or request tokens externally.</>
              )}
              {" "}You can also wrap part of your native {chain.symbol} into{" "}
              <span className="text-foreground font-semibold">{chain.wrappedToken.symbol}</span> to use it inside pools.
            </p>
            <p>
              Tip: {chain.symbol} ↔ {chain.wrappedToken.symbol} is auto-detected as a 1:1 wrap/unwrap on the Swap page — no slippage, no fee.
            </p>
          </Section>

          {/* How to Swap */}
          <Section id="swap" kicker="User guides" title="How to swap">
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Open the <Link to="/swap" className="text-primary hover:underline">Swap</Link> page and pick your input/output tokens.</li>
              <li>Enter an amount — the best multi-hop quote is calculated automatically.</li>
              <li>Review minimum-received, price impact, gas estimate and route in the pre-flight panel.</li>
              <li>If the input is an ERC-20, approve once. Then sign the swap transaction.</li>
            </ol>
          </Section>

          {/* Provide liquidity */}
          <Section id="liquidity" kicker="User guides" title="Provide liquidity">
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Go to <Link to="/liquidity" className="text-primary hover:underline">Liquidity</Link> and pick the two tokens you want to LP.</li>
              <li>If the pair doesn't exist yet, you'll mint the pool — your input ratio sets the opening price.</li>
              <li>Approve each ERC-20 (once), then click <span className="text-foreground font-semibold">Add Liquidity</span>.</li>
              <li>You'll receive LP tokens representing your share. Burn them later to redeem assets + fees.</li>
            </ol>
          </Section>

          <Section id="portfolio" kicker="User guides" title="Portfolio & send">
            <p>
              The <Link to="/portfolio" className="text-primary hover:underline">Portfolio</Link> page shows
              all your token balances, LP positions (with share % and underlying values), and a full history of
              your transactions on EAGLEDEX.
            </p>
          </Section>

          <Section id="analytics" kicker="User guides" title="Analytics & pairs">
            <p>
              The <Link to="/analytics" className="text-primary hover:underline">Analytics</Link> dashboard
              aggregates testnet metrics: total TVL, volume, swap count and a real-time chart of recent swaps.
              Browse every pair on the <Link to="/pools" className="text-primary hover:underline">Pools</Link> page.
            </p>
          </Section>

          {/* DeFi concepts */}
          <Section id="amm" kicker="DeFi concepts" title="AMM & pricing">
            <p>
              Pools follow the constant-product formula{" "}
              <code className="px-2 py-0.5 rounded bg-secondary text-primary font-mono">x · y = k</code>.
              Each pool holds reserves of two tokens; the price is determined by their ratio. Every swap preserves
              <code className="font-mono"> k</code> (minus the fee), which automatically moves the price.
            </p>
          </Section>

          <Section id="il" kicker="DeFi concepts" title="Impermanent loss">
            <p>
              When the relative price of your two LP tokens diverges, the AMM rebalances your position —
              leaving you with less of the appreciating token. This is called <em>impermanent loss</em>; it becomes
              permanent only when you withdraw. Trading fees you earn while LP'ing partially or fully offset it.
            </p>
          </Section>

          <Section id="slippage" kicker="DeFi concepts" title="Slippage & price impact">
            <p>
              <span className="text-foreground font-semibold">Price impact</span> is how much your trade moves
              the pool price; large trades on shallow pools have large impact.{" "}
              <span className="text-foreground font-semibold">Slippage tolerance</span> is the max additional
              price drift you accept before the tx reverts. EAGLEDEX defaults to 0.5% for swaps and 1% for LP.
            </p>
          </Section>

          <Section id="lp-tokens" kicker="DeFi concepts" title="LP tokens & fees">
            <p>
              Adding liquidity mints LP tokens proportional to your share of the pool. A flat
              <span className="text-foreground font-semibold"> 0.30%</span> fee on every swap is added back to the
              reserves, so your LP tokens are worth slightly more over time. Burn LP to redeem the underlying.
            </p>
          </Section>

          {/* Networks (multi-chain overview) */}
          <Section id="networks" kicker="Technical" title="Supported networks">
            <p>
              EAGLEDEX is multi-chain. Each chain has its own Factory, Router, wrapped-native and token registry.
              Switch the active network from the <span className="text-foreground font-semibold">globe icon</span> in the header.
            </p>
            <div className="grid md:grid-cols-2 gap-3 mt-2">
              {CHAINS.map(c => {
                const isActive = c.key === chain.key;
                return (
                  <div key={c.key} className={`glass rounded-2xl p-4 border ${isActive ? "border-primary/60" : "border-transparent"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full btn-primary-grad grid place-items-center text-primary-foreground text-[11px] font-extrabold">
                          {c.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-bold text-foreground leading-tight">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground">chainId {c.chainId} · native {c.symbol}</div>
                        </div>
                      </div>
                      {isActive && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">Active</span>}
                    </div>
                    <ul className="text-[11px] space-y-1 font-mono">
                      <li className="flex justify-between gap-2"><span className="text-muted-foreground">RPC</span><span className="truncate text-foreground">{c.rpcUrl.replace(/^https?:\/\//, "")}</span></li>
                      <li className="flex justify-between gap-2"><span className="text-muted-foreground">Explorer</span><a href={c.explorer} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline">{c.explorer.replace(/^https?:\/\//, "")}</a></li>
                      <li className="flex justify-between gap-2"><span className="text-muted-foreground">Wrapped</span><span className="truncate text-foreground">{c.wrappedToken.symbol}</span></li>
                      <li className="flex justify-between gap-2"><span className="text-muted-foreground">Tokens</span><span className="text-foreground">{c.tokens.length}</span></li>
                    </ul>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Technology stack */}
          <Section id="stack" kicker="Technical" title="Technology stack">
            <ul className="grid sm:grid-cols-2 gap-2 list-none">
              <li className="glass rounded-xl p-3"><span className="text-foreground font-semibold">Chains</span> · {CHAINS.map(c => c.shortName).join(" + ")}</li>
              <li className="glass rounded-xl p-3"><span className="text-foreground font-semibold">Protocol</span> · UniswapV2-style AMM</li>
              <li className="glass rounded-xl p-3"><span className="text-foreground font-semibold">Frontend</span> · React + Vite + Tailwind + ethers v6</li>
              <li className="glass rounded-xl p-3"><span className="text-foreground font-semibold">Indexing</span> · RPC events + Postgres cloud cache (per chain)</li>
            </ul>
          </Section>

          {/* Smart contracts */}
          <Section id="contracts" kicker="Technical" title={`Smart contracts · ${chain.name}`}>
            <p className="text-xs">
              Showing the deployed contracts for the currently selected chain. Switch chains from the header to see
              the addresses on another network.
            </p>
            <div className="glass rounded-2xl divide-y divide-border/40 overflow-hidden">
              {contracts.map(c => (
                <div key={c.addr} className="flex items-center justify-between p-3 hover:bg-secondary/40">
                  <span className="font-semibold">{c.label}</span>
                  <a href={explorerAddr(c.addr)} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary hover:underline">
                    {c.addr.slice(0, 8)}…{c.addr.slice(-6)}
                  </a>
                </div>
              ))}
            </div>
            <p className="text-xs">
              RPC: <code className="font-mono">{chain.rpcUrl}</code> · Explorer:{" "}
              <a href={chain.explorer} className="text-primary hover:underline">{chain.explorer}</a>
            </p>
          </Section>

          <Section id="tokens" kicker="Technical" title="Supported tokens">
            <p>
              EAGLEDEX is permissionless — any ERC-20 can be paired. Below is the default registry deployed on{" "}
              <span className="text-foreground font-semibold">{INTEGRALAYER.name}</span>. You can also import
              any custom token by address from the token picker.
            </p>
            <div className="glass rounded-2xl divide-y divide-border/40 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.2fr_2fr_auto] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-bold bg-secondary/30">
                <span>Token</span>
                <span className="hidden sm:block">Contract</span>
                <span className="text-right">Explorer</span>
              </div>
              {TOKENS.map(t => (
                <div key={t.symbol} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.2fr_2fr_auto] gap-3 items-center px-4 py-3 hover:bg-secondary/40 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={t.logo} alt={t.symbol} className="w-8 h-8 rounded-full object-cover bg-card shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                        {t.symbol}
                        {t.isNative && <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-bold uppercase">Native</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">{t.name}</div>
                    </div>
                  </div>
                  <div className="hidden sm:block font-mono text-[11px] text-muted-foreground truncate">
                    {t.isNative ? "— native gas token —" : t.address}
                  </div>
                  {t.isNative ? (
                    <span className="text-[11px] text-muted-foreground text-right">—</span>
                  ) : (
                    <a href={explorerAddr(t.address)} target="_blank" rel="noreferrer"
                      className="text-primary text-[11px] font-semibold hover:underline whitespace-nowrap text-right">
                      View ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* Roadmap */}
          <Section id="roadmap" kicker="Roadmap & FAQ" title="Development roadmap">
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-primary via-primary/40 to-transparent" />
              <div className="space-y-5">
                {ROADMAP.map(p => (
                  <div key={p.phase} className="relative">
                    <div className="absolute -left-6 top-1"><PhaseIcon status={p.status} /></div>
                    <div className="glass rounded-2xl p-4">
                      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
                        <div>
                          <div className="text-xs uppercase tracking-wider text-primary font-bold">{p.phase}</div>
                          <div className="font-bold text-lg text-foreground">{p.title}</div>
                        </div>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          p.status === "done" ? "bg-green-500/15 text-green-400" :
                          p.status === "in_progress" ? "bg-yellow-500/15 text-yellow-400" :
                          "bg-secondary text-muted-foreground"
                        }`}>{p.status.replace("_", " ")}</span>
                      </div>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {p.items.map(it => (
                          <li key={it} className="flex items-start gap-2">
                            <span className="text-primary mt-1">•</span><span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* FAQ */}
          <Section id="faq" kicker="Roadmap & FAQ" title="Frequently asked questions">
            <div className="space-y-2">
              {[
                ["Is EAGLEDEX custodial?", "No. All swaps and LP actions are signed from your wallet and settled on-chain. EAGLEDEX never holds your funds."],
                ["Why does my swap revert?", "Usually because slippage was exceeded, the deadline passed, or the path has insufficient liquidity. The pre-flight panel surfaces the exact revert reason before you sign."],
                ["How are LP fees collected?", "Every swap charges 0.30% which is added to the pool reserves. You realize the fees when you burn your LP tokens."],
                ["What's the difference between IRL and WIRL?", "IRL is the native gas token. WIRL is its 1:1 ERC-20 wrapper used inside pools. Wrap/unwrap is free and instant."],
              ].map(([q, a]) => (
                <details key={q} className="glass rounded-xl p-3 group">
                  <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground text-sm">
                    {q}
                    <ChevronRight className="w-4 h-4 text-muted-foreground transition group-open:rotate-90" />
                  </summary>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{a}</p>
                </details>
              ))}
            </div>
          </Section>

          {/* CTA */}
          <div className="glass rounded-3xl p-8 text-center bg-gradient-to-br from-primary/15 to-transparent">
            <h3 className="text-2xl font-extrabold mb-2">Ready to take flight?</h3>
            <p className="text-sm text-muted-foreground mb-4">Open Swap and try EAGLEDEX in under a minute.</p>
            <Link to="/swap" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl btn-primary-grad text-primary-foreground font-bold">
              <ArrowLeftRight className="w-4 h-4" /> Launch the App
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Docs;
