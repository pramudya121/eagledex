import { ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * Aceternity — GlowingStars background.
 * Renders a deterministic grid of tiny stars that twinkle independently.
 */
export const GlowingStarsBackground = ({
  density = 36,
  className,
}: { density?: number; className?: string }) => {
  const stars = useMemo(() => {
    return Array.from({ length: density }).map((_, i) => {
      // pseudo-random but stable per index
      const x = (i * 73) % 100;
      const y = (i * 137) % 100;
      const delay = (i * 0.27) % 4;
      const dur = 2 + ((i * 0.41) % 3);
      const size = 1 + ((i * 0.31) % 2);
      return { x, y, delay, dur, size, i };
    });
  }, [density]);

  return (
    <div aria-hidden className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {stars.map((s) => (
        <span
          key={s.i}
          className="absolute rounded-full bg-primary animate-[starTwinkle_var(--dur)_ease-in-out_infinite]"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            ["--dur" as any]: `${s.dur}s`,
            boxShadow: "0 0 8px hsl(var(--primary)), 0 0 14px hsl(var(--primary-glow))",
          }}
        />
      ))}
    </div>
  );
};

/** Card wrapper with stars background. */
export const GlowingStarsBackgroundCard = ({
  children,
  className,
  density,
}: { children: ReactNode; className?: string; density?: number }) => (
  <div className={cn("relative overflow-hidden glass rounded-2xl p-5", className)}>
    <GlowingStarsBackground density={density} />
    <div className="relative">{children}</div>
  </div>
);

export default GlowingStarsBackgroundCard;
