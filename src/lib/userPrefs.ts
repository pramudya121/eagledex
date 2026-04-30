import { useEffect, useState } from "react";

/**
 * Persisted user preferences (slippage tolerance, deadline minutes).
 * Stored in localStorage so traders don't have to re-tune every reload.
 * Values are validated and clamped to safe ranges on read.
 */
const KEY = "eagledex.prefs.v1";

export interface UserPrefs {
  slippageBps: number;   // 1..5000 (0.01% .. 50%)
  deadlineMin: number;   // 1..180
}

const DEFAULTS: UserPrefs = { slippageBps: 50, deadlineMin: 20 };

const clamp = (n: number, min: number, max: number) =>
  !Number.isFinite(n) ? min : Math.max(min, Math.min(max, Math.round(n)));

export function loadPrefs(): UserPrefs {
  if (typeof localStorage === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw);
    return {
      slippageBps: clamp(p.slippageBps ?? DEFAULTS.slippageBps, 1, 5000),
      deadlineMin: clamp(p.deadlineMin ?? DEFAULTS.deadlineMin, 1, 180),
    };
  } catch { return DEFAULTS; }
}

export function savePrefs(p: Partial<UserPrefs>) {
  if (typeof localStorage === "undefined") return;
  try {
    const cur = loadPrefs();
    const next: UserPrefs = { ...cur, ...p };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

/** React hook — returns [value, setter] that auto-persists to localStorage. */
export function usePersistedPref<K extends keyof UserPrefs>(
  key: K,
  fallback: UserPrefs[K],
): [UserPrefs[K], (v: UserPrefs[K]) => void] {
  const [v, setV] = useState<UserPrefs[K]>(() => {
    const p = loadPrefs();
    return (p[key] ?? fallback) as UserPrefs[K];
  });
  useEffect(() => { savePrefs({ [key]: v } as Partial<UserPrefs>); }, [key, v]);
  return [v, setV];
}