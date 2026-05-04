import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Aceternity — TextGenerateEffect.
 * Reveals words one-by-one with a fade + blur-out animation.
 */
const TextGenerateEffect = ({
  words,
  className,
  wordClassName,
  stagger = 80,
}: {
  words: string;
  className?: string;
  wordClassName?: string;
  stagger?: number;
}) => {
  const list = words.split(/\s+/);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= list.length) clearInterval(id);
    }, stagger);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);

  return (
    <span className={cn("inline-flex flex-wrap gap-x-[0.35em] gap-y-1", className)}>
      {list.map((w, i) => (
        <span
          key={i}
          className={cn(
            "inline-block transition-all duration-700",
            i < shown ? "opacity-100 blur-0 translate-y-0" : "opacity-0 blur-md translate-y-1",
            wordClassName,
          )}
        >
          {w}
        </span>
      ))}
    </span>
  );
};

export default TextGenerateEffect;
