import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Magic UI — NumberTicker. Animates number from 0 → value with easing.
 * Re-runs whenever `value` changes. Uses requestAnimationFrame, no deps.
 */
const NumberTicker = ({
  value,
  duration = 1200,
  decimals = 0,
  className,
  prefix = "",
  suffix = "",
}: {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) => {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const startRef = useRef(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    cancelAnimationFrame(rafRef.current!);
    fromRef.current = display;
    startRef.current = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(fromRef.current + (value - fromRef.current) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const formatted = display.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return <span className={cn("tabular-nums", className)}>{prefix}{formatted}{suffix}</span>;
};

export default NumberTicker;
