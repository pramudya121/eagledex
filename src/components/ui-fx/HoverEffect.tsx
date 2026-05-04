import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

export interface HoverItem {
  title: string;
  description: string;
  icon?: ReactNode;
  link?: string;
}

/**
 * Aceternity — HoverEffect cards.
 * A grid where the hovered card grows a soft primary halo behind it.
 */
const HoverEffect = ({ items, className }: { items: HoverItem[]; className?: string }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className={cn("grid sm:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {items.map((it, i) => {
        const Wrapper: any = it.link ? "a" : "div";
        const wrapProps = it.link ? { href: it.link } : {};
        return (
          <Wrapper
            key={i}
            {...wrapProps}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className="relative block group p-2 h-full"
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 rounded-3xl bg-primary/15 blur-xl transition-opacity duration-500",
                hovered === i ? "opacity-100" : "opacity-0",
              )}
            />
            <div className="relative h-full glass rounded-2xl p-5 transition-transform duration-300 group-hover:-translate-y-1">
              {it.icon && <div className="w-10 h-10 rounded-xl btn-primary-grad grid place-items-center mb-3 text-primary-foreground">{it.icon}</div>}
              <h3 className="font-bold text-lg mb-1">{it.title}</h3>
              <p className="text-sm text-muted-foreground">{it.description}</p>
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
};

export default HoverEffect;
