import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeftRight, Droplets, Layers, BarChart3, Shield, Zap, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";
import { usePoolIndex, poolTVL, poolPrice } from "@/lib/poolIndex";
import { useMemo } from "react";
import { TOKENS } from "@/lib/chain";
import ShimmerButton from "@/components/ui-fx/ShimmerButton";
import Spotlight from "@/components/ui-fx/Spotlight";
import Marquee from "@/components/ui-fx/Marquee";
import RotatingTokenLogo from "@/components/ui-fx/RotatingTokenLogo";
import NumberTicker from "@/components/ui-fx/NumberTicker";
import TextGenerateEffect from "@/components/ui-fx/TextGenerateEffect";

const Home = () => {
  const state = usePoolIndex();
  const stats = useMemo(() => {
    const pools = Object.values(state.pools);
    const tvl = pools.reduce((a, p) => a + poolTVL(p), 0);
    const swaps = pools.reduce((a, p) => a + p.swapCount, 0);
    return { pools: pools.length, tvl, swaps };
  }, [state.pools, state.lastUpdated]);

  // Token ticker — derive a representative price per token from pools
  const ticker = useMemo(() => {
    const tokens = TOKENS.filter(t => !t.isNative);
    return tokens.map(t => {
      const pool = Object.values(state.pools).find(
        p => p.token0.toLowerCase() === t.address.toLowerCase() || p.token1.toLowerCase() === t.address.toLowerCase(),
      );
      let price = 0;
      if (pool) {
        const p01 = poolPrice(pool);
        price = pool.token0.toLowerCase() === t.address.toLowerCase() ? p01 : (p01 ? 1 / p01 : 0);
      }
      return { ...t, price };
    });
  }, [state.pools, state.lastUpdated]);

  return (
    <div className="animate-slide-up">
      {/* HERO */}
      <section className="relative grid lg:grid-cols-2 gap-10 items-center pt-4 pb-12 isolate">
        <Spotlight className="-top-32 -left-10 w-[520px] h-[480px]" />
        <Spotlight className="-bottom-20 right-0 w-[460px] h-[400px]" fill="hsl(var(--primary-glow))" />

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
            <TextGenerateEffect words="Trade the universe of" /> <br />
            <span className="text-grad"><TextGenerateEffect words="on-chain tokens." stagger={120} /></span>
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-lg">
            EAGLEDEX is a fully on-chain AMM built on Integralayer. Swap, provide liquidity, and earn fees with
            transparent routing, real-time pool analytics, and a sleek pitch-black UI.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/swap">
              <ShimmerButton className="px-6 h-12">
                Launch Swap <ArrowRight className="w-4 h-4" />
              </ShimmerButton>
            </Link>
            <Link to="/liquidity" className="rounded-2xl px-6 h-12 inline-flex items-center gap-2 font-bold border border-border bg-card hover:border-primary/60 transition">
              <Droplets className="w-4 h-4 text-primary" /> Provide Liquidity
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-md pt-2">
            <Stat label="Total Pools" value={stats.pools} />
            <Stat label="On-chain TVL" value={stats.tvl} decimals={1} />
            <Stat label="Total Swaps" value={stats.swaps} />
          </div>
        </div>

        {/* 3D Rotating token globe — pure CSS, replaces three.js dependency for hero */}
        <div className="relative w-full grid place-items-center">
          <RotatingTokenLogo size={420} className="max-w-full" />
        </div>
      </section>

      {/* LIVE TICKER (Marquee) */}
      <section className="my-6">
        <div className="glass rounded-2xl py-3 overflow-hidden">
          <Marquee speed={40}>
            {ticker.map((t, i) => (
              <div key={`${t.address}-${i}`} className="flex items-center gap-2 px-4">
                <img src={t.logo} alt={t.symbol} className="w-6 h-6 rounded-full" />
                <span className="font-bold text-sm">{t.symbol}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {t.price > 0 ? t.price.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—"}
                </span>
                <span className="w-1 h-1 rounded-full bg-primary/60" />
              </div>
            ))}
          </Marquee>
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
        <Link to="/swap" className="inline-block mt-5">
          <ShimmerButton className="px-7 h-12">
            Open EAGLEDEX <ArrowRight className="w-4 h-4" />
          </ShimmerButton>
        </Link>
      </section>
    </div>
  );
};

const Stat = ({ label, value, decimals = 0 }: { label: string; value: number; decimals?: number }) => (
  <div className="glass rounded-xl p-3">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-extrabold text-grad text-lg truncate">
      <NumberTicker value={value} decimals={decimals} />
    </div>
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
