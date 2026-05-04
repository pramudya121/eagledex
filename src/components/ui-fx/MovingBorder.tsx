import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Aceternity — MovingBorder.
 * Wrap any block to give it a slowly rotating conic-gradient border.
 */
const MovingBorder = ({
  children,
  className,
  containerClassName,
  borderRadius = "1.5rem",
  duration = 8,
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  borderRadius?: string;
  duration?: number;
}) => (
  <div
    className={cn("relative p-[1.5px] overflow-hidden", containerClassName)}
    style={{ borderRadius, ["--mb-d" as any]: `${duration}s` }}
  >
    <span
      aria-hidden
      className="absolute inset-[-50%] -z-0 animate-[movingBorderSpin_var(--mb-d)_linear_infinite]"
      style={{
        background:
          "conic-gradient(from 0deg, transparent 0%, hsl(var(--primary)) 18%, hsl(var(--primary-glow)) 30%, transparent 50%, transparent 100%)",
      }}
    />
    <div
      className={cn("relative bg-background", className)}
      style={{ borderRadius: `calc(${borderRadius} - 1.5px)` }}
    >
      {children}
    </div>
  </div>
);

export default MovingBorder;
