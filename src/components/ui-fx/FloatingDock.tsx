import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface DockItem {
  to: string;
  label: string;
  icon: any;
  end?: boolean;
}

/**
 * Aceternity — FloatingDock (mobile).
 * Fixed bottom dock. Tap to navigate. Active item lifts + glows.
 */
const FloatingDock = ({ items, className }: { items: DockItem[]; className?: string }) => (
  <div className={cn("md:hidden fixed bottom-3 inset-x-0 z-50 flex justify-center px-3 pointer-events-none", className)}>
    <div className="pointer-events-auto flex items-end gap-1 px-2 py-1.5 rounded-2xl border border-border/70 bg-background/80 backdrop-blur-xl shadow-[0_18px_50px_-15px_hsl(var(--primary)/0.45)] overflow-x-auto max-w-full">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "group relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200",
              isActive
                ? "btn-primary-grad text-primary-foreground -translate-y-2 scale-110 shadow-[0_10px_25px_-8px_hsl(var(--primary)/0.7)]"
                : "text-muted-foreground hover:text-foreground hover:-translate-y-1",
            )
          }
        >
          <Icon className="w-4 h-4" />
          <span className="leading-none">{label}</span>
        </NavLink>
      ))}
    </div>
  </div>
);

export default FloatingDock;
