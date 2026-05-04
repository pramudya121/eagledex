import { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Aceternity-style Spotlight — a soft conic glow positioned absolutely behind hero content.
 * Use inside a relatively positioned parent.
 */
const Spotlight = ({
  className,
  fill = "hsl(var(--primary))",
  style,
}: { className?: string; fill?: string; style?: CSSProperties }) => (
  <div
    aria-hidden
    className={cn(
      "pointer-events-none absolute -z-0 blur-3xl opacity-60 mix-blend-screen",
      "animate-[spotlightFloat_10s_ease-in-out_infinite_alternate]",
      className,
    )}
    style={{
      background: `radial-gradient(closest-side, ${fill}, transparent 70%)`,
      ...style,
    }}
  />
);

export default Spotlight;
