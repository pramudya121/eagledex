import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Magic UI — ShimmerButton
 * A premium gradient button with a continuously sweeping shine + soft inner ring.
 * Pure CSS — no extra deps. Works as a drop-in <button>.
 */
export interface ShimmerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  background?: string;
}

const ShimmerButton = forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  ({ className, children, shimmerColor = "hsl(var(--primary-foreground))", borderRadius = "9999px", background, ...props }, ref) => {
    return (
      <button
        ref={ref}
        {...props}
        style={{
          // CSS vars consumed by ::before/::after
          ["--shimmer-color" as any]: shimmerColor,
          ["--shimmer-bg" as any]: background ?? "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))",
          ["--shimmer-radius" as any]: borderRadius,
        }}
        className={cn(
          "group relative inline-flex items-center justify-center gap-2 overflow-hidden",
          "px-6 h-12 font-bold text-primary-foreground",
          "shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.6)]",
          "transition-transform duration-200 active:translate-y-[1px] hover:-translate-y-[1px]",
          "[background:var(--shimmer-bg)] [border-radius:var(--shimmer-radius)]",
          // Inner subtle ring
          "before:absolute before:inset-0 before:rounded-[inherit] before:p-px",
          "before:bg-[linear-gradient(135deg,rgba(255,255,255,0.55),rgba(255,255,255,0))]",
          "before:[mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)] before:[mask-composite:exclude] before:pointer-events-none",
          // Shimmer sweep
          "after:absolute after:inset-0 after:rounded-[inherit] after:pointer-events-none",
          "after:bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.45)_50%,transparent_75%)]",
          "after:bg-[length:250%_100%] after:bg-[position:200%_0]",
          "after:transition-[background-position] after:duration-[1500ms] after:ease-out",
          "hover:after:bg-[position:-50%_0] after:animate-[shimmerSweep_3s_linear_infinite]",
          className,
        )}
      >
        <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      </button>
    );
  },
);
ShimmerButton.displayName = "ShimmerButton";
export default ShimmerButton;
