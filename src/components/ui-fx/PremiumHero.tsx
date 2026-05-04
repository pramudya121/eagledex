import { ReactNode } from "react";
import Spotlight from "./Spotlight";
import TextGenerateEffect from "./TextGenerateEffect";
import { cn } from "@/lib/utils";

/**
 * Reusable premium hero section.
 * - Animated text reveal
 * - Two spotlights (top-left + bottom-right)
 * - Optional kicker chip + CTA slot
 * Drop in at the top of any page for visual consistency.
 */
const PremiumHero = ({
  title,
  subtitle,
  kicker,
  actions,
  align = "center",
  className,
}: {
  title: string;
  subtitle?: string;
  kicker?: ReactNode;
  actions?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) => (
  <section className={cn("relative isolate py-8 md:py-10", align === "center" ? "text-center" : "text-left", className)}>
    <Spotlight className="-top-20 left-1/4 w-[520px] h-[420px]" />
    <Spotlight className="-bottom-24 right-1/5 w-[420px] h-[360px]" fill="hsl(var(--primary-glow))" />
    {kicker && (
      <div className={cn("relative z-10 mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-semibold", align === "center" && "mx-auto")}>
        {kicker}
      </div>
    )}
    <h1 className="relative z-10 text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">
      <TextGenerateEffect words={title} className="text-grad" />
    </h1>
    {subtitle && (
      <p className={cn("relative z-10 mt-3 text-sm md:text-base text-muted-foreground", align === "center" && "max-w-xl mx-auto")}>{subtitle}</p>
    )}
    {actions && <div className={cn("relative z-10 mt-5 flex flex-wrap gap-3", align === "center" && "justify-center")}>{actions}</div>}
  </section>
);

export default PremiumHero;
