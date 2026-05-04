import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Magic UI — Marquee. Infinite horizontal scroller. */
const Marquee = ({
  children,
  className,
  reverse = false,
  pauseOnHover = true,
  speed = 30, // seconds per loop
}: {
  children: ReactNode;
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  speed?: number;
}) => (
  <div className={cn("group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]", className)}>
    <div
      className={cn(
        "flex shrink-0 gap-6 w-max",
        reverse ? "animate-[marqueeR_var(--mq-d)_linear_infinite]" : "animate-[marqueeL_var(--mq-d)_linear_infinite]",
        pauseOnHover && "group-hover:[animation-play-state:paused]",
      )}
      style={{ ["--mq-d" as any]: `${speed}s` }}
    >
      {children}
      {children}
    </div>
  </div>
);

export default Marquee;
