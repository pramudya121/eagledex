import { cn } from "@/lib/utils";

/**
 * Magic UI — BorderBeam. A glowing dot travels around the parent's border.
 * Place inside any relatively-positioned container with `overflow-hidden`.
 */
const BorderBeam = ({
  size = 220,
  duration = 9,
  delay = 0,
  colorFrom = "hsl(var(--primary))",
  colorTo = "hsl(var(--primary-glow))",
  className,
}: {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  className?: string;
}) => (
  <div
    aria-hidden
    className={cn(
      "pointer-events-none absolute inset-0 rounded-[inherit]",
      "[border:1.5px_solid_transparent]",
      "[mask-clip:padding-box,border-box] [mask-composite:intersect]",
      "[mask-image:linear-gradient(transparent,transparent),linear-gradient(black,black)]",
      "after:absolute after:aspect-square after:w-[var(--bb-size)]",
      "after:animate-[borderBeam_var(--bb-d)_linear_infinite]",
      "after:[offset-anchor:90%_50%] after:[offset-path:rect(0_auto_auto_0_round_var(--bb-size))]",
      "after:[background:linear-gradient(to_left,var(--bb-from),var(--bb-to),transparent)]",
      className,
    )}
    style={{
      ["--bb-size" as any]: `${size}px`,
      ["--bb-d" as any]: `${duration}s`,
      ["--bb-from" as any]: colorFrom,
      ["--bb-to" as any]: colorTo,
      animationDelay: `${delay}s`,
    }}
  />
);

export default BorderBeam;
