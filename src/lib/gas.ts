// Gas / fee estimation + pre-flight static call helpers.
// Wraps a contract call so we can surface revert reasons + cost estimates
// to the user BEFORE they sign anything in their wallet.
import { Contract, JsonRpcSigner, formatUnits, parseUnits } from "ethers";

export interface GasEstimate {
  ok: boolean;
  gasLimit?: bigint;          // raw estimate
  gasLimitWithBuffer?: bigint; // +20% safety buffer
  feeWei?: bigint;             // gasLimitWithBuffer * effectiveGasPrice
  feeEth?: string;             // human, native token
  gasPriceGwei?: string;
  revertReason?: string;       // populated if call would fail
  warning?: string;            // soft warning (e.g. very high gas)
}

/** Decode a typical ethers v6 error into something user-readable. */
export function decodeRevert(e: any): string {
  return (
    e?.shortMessage ||
    e?.info?.error?.message ||
    e?.error?.message ||
    e?.reason ||
    e?.data?.message ||
    e?.message ||
    String(e)
  );
}

/**
 * Pre-flight a contract call:
 *  1. staticCall — proves the tx will succeed at the current state (catches revert reasons).
 *  2. estimateGas — exact gas the node would charge.
 *  3. getFeeData — current network gas price.
 * Returns a GasEstimate the UI can show before the user signs.
 */
export async function estimateContractCall(
  signer: JsonRpcSigner,
  contract: Contract,
  method: string,
  args: any[],
  overrides: { value?: bigint } = {},
): Promise<GasEstimate> {
  // 1. staticCall — surfaces revert reason without sending a tx
  try {
    await contract[method].staticCall(...args, overrides);
  } catch (e: any) {
    return { ok: false, revertReason: decodeRevert(e) };
  }
  // 2. estimate gas
  let gasLimit: bigint;
  try {
    gasLimit = await contract[method].estimateGas(...args, overrides);
  } catch (e: any) {
    return { ok: false, revertReason: decodeRevert(e) };
  }
  const gasLimitWithBuffer = (gasLimit * 120n) / 100n; // +20%
  // 3. fee data
  try {
    const fee = await signer.provider!.getFeeData();
    const gp = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
    const feeWei = gasLimitWithBuffer * gp;
    const feeEth = formatUnits(feeWei, 18);
    const gasPriceGwei = gp ? formatUnits(gp, 9) : "0";
    let warning: string | undefined;
    if (gasLimit > 800_000n) warning = "High gas usage — complex tx. Make sure you have enough native balance.";
    return { ok: true, gasLimit, gasLimitWithBuffer, feeWei, feeEth, gasPriceGwei, warning };
  } catch {
    return { ok: true, gasLimit, gasLimitWithBuffer };
  }
}

/**
 * Estimate when we don't yet have a full Contract object — useful for raw transactions
 * (kept here for symmetry; currently the app builds via Contract instances).
 */
export function formatFee(fee?: bigint): string {
  if (fee == null) return "—";
  const eth = Number(formatUnits(fee, 18));
  if (eth === 0) return "0";
  if (eth < 0.0001) return `${(eth * 1e6).toFixed(2)} µ`;
  if (eth < 0.01) return eth.toFixed(6);
  return eth.toFixed(5);
}

// Re-exported for convenience
export { parseUnits };