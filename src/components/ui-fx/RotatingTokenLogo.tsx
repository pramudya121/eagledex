import { cn } from "@/lib/utils";
import { TOKENS } from "@/lib/chain";

/**
 * 3D rotating token logo carousel — pure CSS transforms.
 * Tokens are positioned around a rotating Y-axis for an "atom" feel.
 */
const RotatingTokenLogo = ({ size = 240, className }: { size?: number; className?: string }) => {
  const tokens = TOKENS.filter(t => !t.isNative).slice(0, 8);
  const radius = size * 0.6;
  return (
    <div
      className={cn("relative grid place-items-center [perspective:1100px]", className)}
      style={{ width: size, height: size }}
    >
      {/* Center logo with breathing glow */}
      <div className="relative z-10 w-[36%] aspect-square rounded-full btn-primary-grad grid place-items-center shadow-[0_0_60px_hsl(var(--primary)/0.7)] animate-pulse-glow">
        <span className="font-extrabold text-primary-foreground text-xl tracking-tight">EAGLE</span>
      </div>

      {/* Orbit ring */}
      <div
        className="absolute inset-0 rounded-full border border-primary/25"
        style={{ boxShadow: "inset 0 0 60px hsl(var(--primary)/0.15)" }}
      />

      {/* Rotating ring of tokens */}
      <div
        className="absolute inset-0 [transform-style:preserve-3d] animate-[orbitSpin_24s_linear_infinite]"
        style={{ transform: "rotateX(65deg)" }}
      >
        {tokens.map((t, i) => {
          const angle = (i / tokens.length) * Math.PI * 2;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          return (
            <div
              key={t.address}
              className="absolute left-1/2 top-1/2 [transform-style:preserve-3d]"
              style={{ transform: `translate(-50%, -50%) translate3d(${x}px, 0px, ${z}px)` }}
            >
              {/* counter-spin to keep logos upright-ish */}
              <div
                className="animate-[orbitCounterSpin_24s_linear_infinite] rounded-full bg-card border border-border shadow-[0_8px_25px_-5px_hsl(var(--primary)/0.6)] grid place-items-center"
                style={{ width: size * 0.16, height: size * 0.16, transform: "rotateX(-65deg)" }}
              >
                <img src={t.logo} alt={t.symbol} className="w-[78%] h-[78%] rounded-full object-cover" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RotatingTokenLogo;
