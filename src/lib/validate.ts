// Strict input validation for swap/liquidity parameters.
// All errors are user-facing strings.
import { z } from "zod";
import { parseUnits } from "ethers";

// Slippage is stored as basis points (100 = 1%).
export const slippageBpsSchema = z.number()
  .int("Slippage must be a whole number of basis points")
  .min(1, "Slippage must be at least 0.01%")
  .max(5000, "Slippage cannot exceed 50%");

// Deadline in minutes.
export const deadlineMinutesSchema = z.number()
  .int("Deadline must be a whole number of minutes")
  .min(1, "Deadline must be at least 1 minute")
  .max(180, "Deadline cannot exceed 180 minutes (3 hours)");

/**
 * Validate a decimal token amount string. Returns either bigint wei or an error.
 * - Rejects empty / non-numeric / negative / NaN / Infinity / scientific notation.
 * - Rejects more decimal places than the token supports.
 * - Rejects zero amounts.
 */
export interface AmountResult {
  ok: boolean;
  value?: bigint;
  error?: string;
}

export function validateAmount(
  raw: string,
  decimals: number,
  opts: { symbol?: string; max?: bigint; allowZero?: boolean } = {},
): AmountResult {
  const symbol = opts.symbol ?? "token";
  if (raw == null || raw.trim() === "") return { ok: false, error: `Enter an amount of ${symbol}` };
  const s = raw.trim();
  // basic shape: optional digits, optional dot, optional digits
  if (!/^\d*\.?\d*$/.test(s) || s === "." || s === "") {
    return { ok: false, error: `${symbol} amount must be a positive decimal number` };
  }
  const [intPart, fracPart = ""] = s.split(".");
  if (intPart.length === 0 && fracPart.length === 0) {
    return { ok: false, error: `Enter an amount of ${symbol}` };
  }
  if (fracPart.length > decimals) {
    return {
      ok: false,
      error: `${symbol} supports only ${decimals} decimal places (you entered ${fracPart.length}).`,
    };
  }
  let value: bigint;
  try {
    value = parseUnits(s as `${number}`, decimals);
  } catch {
    return { ok: false, error: `${symbol} amount is not a valid number` };
  }
  if (!opts.allowZero && value === 0n) {
    return { ok: false, error: `${symbol} amount must be greater than 0` };
  }
  if (opts.max !== undefined && value > opts.max) {
    return { ok: false, error: `Amount exceeds your ${symbol} balance` };
  }
  return { ok: true, value };
}

export function validateSlippageBps(bps: number): { ok: boolean; error?: string } {
  const r = slippageBpsSchema.safeParse(bps);
  return r.success ? { ok: true } : { ok: false, error: r.error.issues[0].message };
}

export function validateDeadlineMinutes(min: number): { ok: boolean; error?: string } {
  const r = deadlineMinutesSchema.safeParse(min);
  return r.success ? { ok: true } : { ok: false, error: r.error.issues[0].message };
}
