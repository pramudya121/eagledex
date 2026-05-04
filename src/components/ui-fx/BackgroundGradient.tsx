import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Aceternity — BackgroundGradient.
 * Wraps content in a soft animated gradient halo + glass body.
 */
const BackgroundGradient = ({
  children,
  className,
  containerClassName,
  animate = true,
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  animate?: boolean;
}) => (
  <div className={cn("relative group p-[2px] rounded-3xl", containerClassName)}>
    <div
      aria-hidden
      className={cn(
        "absolute -inset-px rounded-[inherit] opacity-60 group-hover:opacity-100 blur-md transition duration-500",
        animate && "animate-[bgGradientShift_8s_ease_infinite] bg-[length:300%_300%]",
      )}
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-glow)) 30%, transparent 60%, hsl(var(--primary)) 100%)",
      }}
    />
    <div
      aria-hidden
      className={cn(
        "absolute -inset-px rounded-[inherit] opacity-100",
        animate && "animate-[bgGradientShift_8s_ease_infinite] bg-[length:300%_300%]",
      )}
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--primary)/0.7) 0%, hsl(var(--primary-glow)/0.5) 30%, transparent 60%, hsl(var(--primary)/0.6) 100%)",
      }}
    />
    <div className={cn("relative rounded-[calc(1.5rem-2px)] bg-card", className)}>{children}</div>
  </div>
);

export default BackgroundGradient;
