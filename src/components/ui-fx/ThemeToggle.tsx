import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Premium theme toggle. Persists to localStorage and toggles `dark` class on <html>.
 * The site is dark-first; toggling "light" reduces overlay opacity and shifts a few tokens.
 */
const ThemeToggle = ({ className }: { className?: string }) => {
  const [dark, setDark] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("theme");
      if (v === "light") return false;
      return true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setDark(d => !d)}
      className={cn(
        "relative inline-flex items-center w-14 h-8 rounded-full border border-border bg-card overflow-hidden transition-colors duration-500",
        dark ? "bg-[#0a0606]" : "bg-[#fdf2f2]",
        className,
      )}
    >
      {/* Sun/moon icons */}
      <Sun className={cn("w-3.5 h-3.5 absolute left-2 transition-all duration-500", dark ? "opacity-30 scale-90" : "opacity-100 text-primary")} />
      <Moon className={cn("w-3.5 h-3.5 absolute right-2 transition-all duration-500", dark ? "opacity-100 text-primary" : "opacity-30 scale-90")} />
      {/* Knob */}
      <span
        className={cn(
          "absolute top-1 w-6 h-6 rounded-full btn-primary-grad shadow-[0_4px_12px_hsl(var(--primary)/0.5)] transition-all duration-500 ease-out",
          dark ? "left-7" : "left-1",
        )}
      />
    </button>
  );
};

export default ThemeToggle;
