import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeftRight, Droplets, Layers, BarChart3, Shield, Zap, Sparkles, CheckCircle2, Lock, Activity } from "lucide-react";
import Logo from "@/components/Logo";
import TokenGlobe from "@/components/TokenGlobe";
import { usePoolIndex, poolTVL } from "@/lib/poolIndex";
import { useCloudIndex } from "@/lib/cloudIndex";
import { useMemo } from "react";

const Home = () => {
  const state = usePoolIndex();
  const cloud = useCloudIndex();
  const stats = useMemo(() => {
    const pools = Object.values(state.pools);
    const tvl = pools.reduce((a, p) => a + poolTVL(p), 0);
    const cloudVol = Object.values(cloud.volume24h).reduce((a, v) => a + (v.volume0 + v.volume1) / 1e18, 0);
    const cloudSwaps = Object.values(cloud.volume24h).reduce((a, v) => a + v.swap_count, 0);
    const swaps = cloudSwaps > 0 ? cloudSwaps : pools.reduce((a, p) => a + p.swapCount, 0);
    return { pools: pools.length, tvl, swaps, vol24h: cloudVol };
  }, [state.pools, state.lastUpdated, cloud.volume24h]);

  return (
    <div className="animate-slide-up">
      {/* HERO */}
      <section className="relative grid lg:grid-cols-2 gap-10 items-center pt-4 pb-12">
        {/* Soft radial halo behind globe */}
        <div aria-hidden className="absolute right-0 top-0 w-[640px] h-[640px] -z-10 rounded-full pointer-events-none opacity-60"
             style={{ background: "radial-gradient(circle at center, hsl(var(--primary) / 0.18), transparent 60%)" }} />

        <div className="space-y-6 relative z-10">
          <div className="flex items-center gap-3">
            <Logo size={120} />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
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
            <Link
              to="/swap"
              className="group relative btn-primary-grad text-primary-foreground rounded-2xl px-6 h-12 inline-flex items-center gap-2 font-bold shadow-[0_20px_50px_-15px_hsl(var(--primary)/0.6)] hover:shadow-[0_25px_70px_-15px_hsl(var(--primary)/0.85)] transition-all hover:-translate-y-0.5"
            >
              Launch Swap
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/liquidity"
              className="group rounded-2xl px-6 h-12 inline-flex items-center gap-2 font-bold border border-border bg-card hover:border-primary/60 hover:bg-card/80 transition-all hover:-translate-y-0.5"
            >
              <Droplets className="w-4 h-4 text-primary transition-transform group-hover:scale-110" />
              Provide Liquidity
            </Link>
          </div>

          {/* Trust strip */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> 100% on-chain</span>
            <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-primary" /> Non-custodial</span>
            <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-primary" /> Live indexer</span>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-md pt-2">
            <Stat label="Total Pools" value={String(stats.pools)} />
            <Stat label="On-chain TVL" value={stats.tvl.toLocaleString(undefined, { maximumFractionDigits: 1 })} />
            <Stat label={stats.vol24h > 0 ? "Volume 24h" : "Total Swaps"} value={stats.vol24h > 0 ? stats.vol24h.toLocaleString(undefined, { maximumFractionDigits: 1 }) : String(stats.swaps)} />
          </div>
        </div>

        {/* 3D Globe */}
        <div className="w-full aspect-square max-w-[460px] mx-auto sm:max-w-[520px] lg:max-w-[560px]">
          <TokenGlobe height={undefined as unknown as number} />
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-10">
        <div className="text-center mb-8 max-w-2xl mx-auto">
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-primary mb-2">Built for traders</div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Everything you need, <span className="text-grad">nothing you don't</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Feature icon={ArrowLeftRight} title="Smart Routing" desc="Multi-hop best-route finder across every liquid hub for tighter execution." />
          <Feature icon={Zap} title="Real-time Sync" desc="A live on-chain indexer keeps reserves, swaps and prices fresh — no refresh needed." />
          <Feature icon={Shield} title="Slippage Guard" desc="Per-hop impact, deadline & min-out enforced on every swap. No nasty surprises." />
          <Feature icon={Droplets} title="LP Made Simple" desc="Add or remove liquidity with auto-quoted ratios, share-of-pool preview and one-click MAX." />
          <Feature icon={Layers} title="Open Pool Explorer" desc="Search, sort and inspect every pair: TVL, volume, swap count and live price." />
          <Feature icon={BarChart3} title="On-chain Analytics" desc="Live charts plotted from raw Swap events — provably honest, no off-chain feeds." />
        </div>
      </section>

      {/* CTA */}
      <section className="relative my-10">
        <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-br from-primary/60 via-primary/10 to-transparent shadow-[0_40px_100px_-30px_hsl(var(--primary)/0.5)]">
          <div className="rounded-[calc(1.5rem-1.5px)] glass p-8 md:p-12 text-center bg-gradient-to-br from-primary/10 via-transparent to-primary/5">
            <Sparkles className="w-7 h-7 text-primary mx-auto mb-3 animate-pulse" />
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
              Ready to <span className="text-grad">trade</span>?
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Connect your wallet and start swapping in seconds. All actions are on-chain, transparent, and verifiable on the explorer.
            </p>
            <Link
              to="/swap"
              className="group mt-5 btn-primary-grad text-primary-foreground rounded-2xl px-7 h-12 inline-flex items-center gap-2 font-bold shadow-[0_20px_50px_-15px_hsl(var(--primary)/0.6)] hover:shadow-[0_25px_70px_-15px_hsl(var(--primary)/0.85)] transition-all hover:-translate-y-0.5"
            >
              Open EAGLEDEX
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="glass rounded-xl p-3 hover:border-primary/40 transition-colors border border-transparent">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-extrabold text-grad text-lg truncate">{value}</div>
  </div>
);

const Feature = ({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) => (
  <div className="group glass rounded-2xl p-5 hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 border border-transparent hover:shadow-[0_20px_50px_-20px_hsl(var(--primary)/0.4)]">
    <div className="w-10 h-10 rounded-xl btn-primary-grad grid place-items-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.6)]">
      <Icon className="w-5 h-5 text-primary-foreground" />
    </div>
    <h3 className="font-bold text-lg mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground">{desc}</p>
  </div>
);

export default Home;
