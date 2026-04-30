import { Link } from "react-router-dom";
import {
  ArrowLeftRight, Droplets, Layers, BarChart3, Briefcase, Shield, Zap,
  CheckCircle2, Circle, Clock, Coins, Repeat, BookOpen,
} from "lucide-react";
import Logo from "@/components/Logo";
import { CONTRACTS, INTEGRALAYER, explorerAddr } from "@/lib/chain";

const Section = ({ id, title, children }: any) => (
  <section id={id} className="scroll-mt-24">
    <h2 className="text-2xl font-extrabold mb-4 text-grad">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

const Feature = ({ icon: Icon, title, children }: any) => (
  <div className="glass rounded-2xl p-4">
    <div className="flex items-center gap-2 mb-2">
      <div className="w-9 h-9 rounded-xl btn-primary-grad grid place-items-center text-primary-foreground"><Icon className="w-4 h-4"/></div>
      <h3 className="font-bold text-foreground">{title}</h3>
    </div>
    <p className="text-sm text-muted-foreground">{children}</p>
  </div>
);

type Phase = { phase: string; title: string; status: "done" | "in_progress" | "todo"; items: string[] };
const ROADMAP: Phase[] = [
  {
    phase: "Phase 1",
    title: "Foundation — Core AMM",
    status: "done",
    items: [
      "Deploy UniswapV2-style Factory + Router on Integralayer testnet",
      "Native IRL ↔ WIRL wrap/unwrap",
      "Multi-wallet support: MetaMask, OKX, Rabby, Bitget",
      "Constant-product pools with x · y = k",
    ],
  },
  {
    phase: "Phase 2",
    title: "Trading UX — Swap, Liquidity, Indexing",
    status: "in_progress",
    items: [
      "Premium SPA: Swap, Liquidity, Pools, Analytics, Portfolio",
      "Live on-chain pool indexer (Sync/Swap/Mint/Burn subscriptions)",
      "Per-token approve flow + custom token import",
      "Strict input validation (slippage, deadline, decimals)",
      "Persistent transaction history with pending / confirmed / failed states",
    ],
  },
  {
    phase: "Phase 3",
    title: "Growth — Incentives & Analytics",
    status: "todo",
    items: [
      "Liquidity mining with EGDX rewards",
      "Pool-level fee tier governance",
      "Historical TVL/volume charts (7d, 30d, all-time)",
      "Position P&L and impermanent-loss tracker",
    ],
  },
  {
    phase: "Phase 4",
    title: "Mainnet — Audit & Launch",
    status: "todo",
    items: [
      "Full smart-contract audit",
      "Mainnet deployment on Integralayer",
      "Cross-chain bridge integration",
      "Limit orders & TWAP routing",
    ],
  },
  {
    phase: "Phase 5",
    title: "Beyond — Concentrated Liquidity",
    status: "todo",
    items: [
      "Uniswap V3-style concentrated liquidity pools",
      "Smart routing across multiple pools",
      "Mobile app (iOS / Android)",
      "EAGLEDEX DAO governance",
    ],
  },
];

const PhaseIcon = ({ status }: { status: Phase["status"] }) => {
  if (status === "done") return <CheckCircle2 className="w-5 h-5 text-green-400" />;
  if (status === "in_progress") return <Clock className="w-5 h-5 text-yellow-400 animate-pulse" />;
  return <Circle className="w-5 h-5 text-muted-foreground" />;
};

const Docs = () => {
  const contracts: { label: string; addr: string }[] = [
    { label: "Factory", addr: CONTRACTS.FACTORY },
    { label: "Router", addr: CONTRACTS.ROUTER },
    { label: "WIRL (Wrapped IRL)", addr: CONTRACTS.WETH },
    { label: "Library", addr: CONTRACTS.LIBRARY },
    { label: "Multicall", addr: CONTRACTS.MULTICALL },
  ];

  return (
    <div className="max-w-5xl mx-auto animate-slide-up">
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4"><Logo /></div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
          Welcome to <span className="text-grad">EAGLEDEX</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          A premium, fully on-chain decentralized exchange built natively on the Integralayer testnet —
          fast, transparent, and elegantly designed.
        </p>
      </div>

      {/* TOC */}
      <div className="glass rounded-2xl p-4 mb-10 flex flex-wrap gap-2 justify-center text-sm">
        {[
          ["#what", "What is EAGLEDEX"],
          ["#how", "How it works"],
          ["#features", "Features"],
          ["#contracts", "Contracts"],
          ["#guides", "User guides"],
          ["#roadmap", "Roadmap"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="px-3 py-1.5 rounded-lg hover:bg-primary/10 hover:text-primary transition">{label}</a>
        ))}
      </div>

      <div className="space-y-12">
        <Section id="what" title="What is EAGLEDEX?">
          <p>
            EAGLEDEX is a community-driven <strong className="text-foreground">Automated Market Maker (AMM)</strong>
            running natively on the <strong className="text-foreground">Integralayer testnet</strong>
            (chain ID {INTEGRALAYER.chainId}). It lets anyone swap ERC-20 tokens, provide liquidity, and earn
            trading fees — without intermediaries, custodians, or order books.
          </p>
          <p>
            Inspired by the eagle: sharp, swift, and watchful — EAGLEDEX combines a Uniswap V2-style constant-product
            engine with a refined, "lovable" interface designed for both newcomers and on-chain power users.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <Feature icon={Shield} title="Fully on-chain">
              Every swap, mint, and burn is settled directly on Integralayer. No off-chain matching, no hidden books.
            </Feature>
            <Feature icon={Zap} title="Permissionless">
              Anyone can list a token, create a pair, or provide liquidity — instantly and without approval.
            </Feature>
            <Feature icon={Coins} title="Earn fees">
              Liquidity providers receive a pro-rata share of every swap fee on their pools.
            </Feature>
            <Feature icon={Repeat} title="Native + wrapped">
              Trade native IRL seamlessly via the WIRL wrapper at 1:1, with no slippage and no fee.
            </Feature>
          </div>
        </Section>

        <Section id="how" title="How the AMM works">
          <p>
            EAGLEDEX pools follow the constant-product formula{" "}
            <code className="px-2 py-0.5 rounded bg-secondary text-primary font-mono">x · y = k</code>.
            Each pool holds reserves of two tokens; the price is determined by the ratio of those reserves.
            When you swap, the pool's invariant <code className="font-mono">k</code> is preserved (minus the fee),
            which automatically moves the price.
          </p>
          <p>
            Liquidity providers deposit both tokens in the current pool ratio and receive{" "}
            <strong className="text-foreground">LP tokens</strong> representing their share. Burning LP tokens
            redeems the underlying assets plus accumulated fees.
          </p>
        </Section>

        <Section id="features" title="What you can do today">
          <div className="grid sm:grid-cols-2 gap-3">
            <Feature icon={ArrowLeftRight} title="Swap">Trade any listed token, with adjustable slippage and deadline. IRL ↔ WIRL is auto-detected as a 1:1 wrap/unwrap.</Feature>
            <Feature icon={Droplets} title="Liquidity">Add or remove liquidity. New pairs can be created by anyone — the UI waits for confirmation before unlocking the next step.</Feature>
            <Feature icon={Layers} title="Pools">A live, indexed view of every pair with TVL, price, volume, and swap count — no manual refresh required.</Feature>
            <Feature icon={BarChart3} title="Analytics">Aggregate testnet metrics, top pairs, and a real-time recent-swaps feed.</Feature>
            <Feature icon={Briefcase} title="Portfolio">Your token balances, LP positions (share % + underlying values), and full liquidity activity history.</Feature>
            <Feature icon={BookOpen} title="Custom tokens">Import any ERC-20 by address — the UI fetches metadata directly on-chain.</Feature>
          </div>
        </Section>

        <Section id="contracts" title="Deployed contracts (Integralayer testnet)">
          <div className="glass rounded-2xl divide-y divide-border/40 overflow-hidden">
            {contracts.map(c => (
              <div key={c.addr} className="flex items-center justify-between p-3 hover:bg-secondary/40">
                <span className="font-semibold">{c.label}</span>
                <a href={explorerAddr(c.addr)} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary hover:underline">{c.addr.slice(0,8)}…{c.addr.slice(-6)}</a>
              </div>
            ))}
          </div>
          <p className="text-xs">
            RPC: <code className="font-mono">{INTEGRALAYER.rpcUrl}</code> • Explorer: <a href={INTEGRALAYER.explorer} className="text-primary hover:underline">{INTEGRALAYER.explorer}</a>
          </p>
        </Section>

        <Section id="guides" title="User guides">
          <ol className="list-decimal pl-5 space-y-2">
            <li><strong className="text-foreground">Connect a wallet</strong> (MetaMask / OKX / Rabby / Bitget). The app will offer to add the Integralayer network if needed.</li>
            <li><strong className="text-foreground">Get test IRL</strong> from a faucet, then optionally wrap a portion to WIRL on the Swap page.</li>
            <li><strong className="text-foreground">Swap</strong> tokens with your preferred slippage and deadline.</li>
            <li><strong className="text-foreground">Provide liquidity</strong> on the Liquidity page — approve each token once, then deposit at the current pool ratio.</li>
            <li><strong className="text-foreground">Track</strong> your positions and transaction history on the Portfolio page.</li>
          </ol>
        </Section>

        <Section id="roadmap" title="Roadmap">
          <div className="relative pl-6">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-primary via-primary/40 to-transparent" />
            <div className="space-y-5">
              {ROADMAP.map((p) => (
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
                      }`}>{p.status.replace("_"," ")}</span>
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

        <div className="glass rounded-3xl p-8 text-center bg-gradient-to-br from-primary/15 to-transparent">
          <h3 className="text-2xl font-extrabold mb-2">Ready to take flight?</h3>
          <p className="text-sm text-muted-foreground mb-4">Open Swap and try EAGLEDEX in under a minute.</p>
          <Link to="/swap" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl btn-primary-grad text-primary-foreground font-bold">
            <ArrowLeftRight className="w-4 h-4" /> Launch the App
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Docs;
