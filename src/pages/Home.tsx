import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeftRight, Droplets, Layers, BarChart3, Shield, Zap, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";
import TokenGlobe from "@/components/TokenGlobe";
import { usePoolIndex, poolTVL } from "@/lib/poolIndex";
import { useMemo } from "react";

const Home = () => {
  const state = usePoolIndex();
  const stats = useMemo(() => {
    const pools = Object.values(state.pools);
    const tvl = pools.reduce((a, p) => a + poolTVL(p), 0);
    const swaps = pools.reduce((a, p) => a + p.swapCount, 0);
    return { pools: pools.length, tvl, swaps };
  }, [state.pools, state.lastUpdated]);

  return (
    <div className="animate-slide-up">
      {/* HERO */}
      <section className="relative grid lg:grid-cols-2 gap-10 items-center pt-4 pb-12">
        <div className="space-y-6 relative z-10">
          <div className="flex items-center gap-3">
            <Logo size={120} />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-grad">Live on Integralayer Testnet</span>
            <span className="text-muted-foreground">· Chain 26218</span>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">
            Trade the universe of <br />
            <span className="text-grad">on-chain</span> tokens.
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-lg">
            EAGLEDEX is a fully on-chain AMM built on Integralayer. Swap, provide liquidity, and earn fees with
            transparent routing, real-time pool analytics, and a sleek pitch-black UI.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/swap" className="btn-primary-grad text-primary-foreground rounded-2xl px-6 h-12 inline-flex items-center gap-2 font-bold">
              Launch Swap <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/liquidity" className="rounded-2xl px-6 h-12 inline-flex items-center gap-2 font-bold border border-border bg-card hover:border-primary/60 transition">
              <Droplets className="w-4 h-4 text-primary" /> Provide Liquidity
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-md pt-2">
            <Stat label="Total Pools" value={String(stats.pools)} />
            <Stat label="On-chain TVL" value={stats.tvl.toLocaleString(undefined,{maximumFractionDigits:1})} />
            <Stat label="Total Swaps" value={String(stats.swaps)} />
          </div>
        </div>

        {/* 3D Globe — fully borderless. The TokenGlobe canvas is transparent
            and renders directly on top of the nebula background — no wrappers,
            no radial overlays that could leave a visible disc. */}
        <div className="w-full aspect-square max-w-[460px] mx-auto sm:max-w-[520px] lg:max-w-[560px]">
          <TokenGlobe height={undefined as unknown as number} />
        </div>
      </section>

      {/* FEATURES */}
      <section className="grid md:grid-cols-3 gap-4 py-10">
        <Feature icon={ArrowLeftRight} title="Smart Routing" desc="Multi-hop best-route finder across every liquid hub for tighter execution." />
        <Feature icon={Zap} title="Real-time Sync" desc="A live on-chain indexer keeps reserves, swaps and prices fresh — no refresh needed." />
        <Feature icon={Shield} title="Slippage Guard" desc="Per-hop impact, deadline & min-out enforced on every swap. No nasty surprises." />
        <Feature icon={Droplets} title="LP Made Simple" desc="Add or remove liquidity with auto-quoted ratios, share-of-pool preview and one-click MAX." />
        <Feature icon={Layers} title="Open Pool Explorer" desc="Search, sort and inspect every pair: TVL, volume, swap count and live price." />
        <Feature icon={BarChart3} title="On-chain Analytics" desc="Live charts plotted from raw Swap events — provably honest, no off-chain feeds." />
      </section>

      {/* CTA */}
      <section className="glass rounded-3xl p-8 md:p-10 text-center my-10 bg-gradient-to-br from-primary/10 via-transparent to-primary/5">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Ready to <span className="text-grad">trade</span>?</h2>
        <p className="text-muted-foreground max-w-lg mx-auto">Connect your wallet and start swapping in seconds. All actions are on-chain, transparent, and verifiable on the explorer.</p>
        <Link to="/swap" className="mt-5 btn-primary-grad text-primary-foreground rounded-2xl px-7 h-12 inline-flex items-center gap-2 font-bold">
          Open EAGLEDEX <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="glass rounded-xl p-3">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-extrabold text-grad text-lg truncate">{value}</div>
  </div>
);

const Feature = ({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) => (
  <div className="glass rounded-2xl p-5 hover:-translate-y-1 transition">
    <div className="w-10 h-10 rounded-xl btn-primary-grad grid place-items-center mb-3">
      <Icon className="w-5 h-5 text-primary-foreground" />
    </div>
    <h3 className="font-bold text-lg mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground">{desc}</p>
  </div>
);

export default Home;