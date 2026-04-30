// On-chain helpers for EAGLEDEX
import { Contract, JsonRpcProvider, JsonRpcSigner, BrowserProvider, MaxUint256, parseUnits, formatUnits, ZeroAddress } from "ethers";
import { CONTRACTS } from "./chain";
import { ERC20_ABI, PAIR_ABI, WETH_ABI } from "./abis";
import type { TokenInfo } from "./chain";

export const isNative = (t: TokenInfo) => t.isNative === true;
export const wrap = (t: TokenInfo) => (isNative(t) ? CONTRACTS.WETH : t.address);

export async function getTokenBalance(provider: JsonRpcProvider | BrowserProvider, token: TokenInfo, account: string) {
  if (isNative(token)) return await provider.getBalance(account);
  const c = new Contract(token.address, ERC20_ABI, provider);
  return await c.balanceOf(account);
}

export async function getAllowance(provider: JsonRpcProvider | BrowserProvider, token: string, owner: string, spender: string) {
  const c = new Contract(token, ERC20_ABI, provider);
  return await c.allowance(owner, spender);
}

export async function approveIfNeeded(signer: JsonRpcSigner, token: string, spender: string, amount: bigint) {
  const c = new Contract(token, ERC20_ABI, signer);
  const owner = await signer.getAddress();
  const cur: bigint = await c.allowance(owner, spender);
  if (cur >= amount) return null;
  const tx = await c.approve(spender, MaxUint256);
  return tx;
}

export function deadlineMin(min = 20) {
  return Math.floor(Date.now() / 1000) + min * 60;
}

export function applySlippage(amount: bigint, slippageBps: number) {
  // returns minimum out
  return (amount * BigInt(10_000 - slippageBps)) / 10_000n;
}

export async function getPairAddress(factory: Contract, a: string, b: string) {
  return await factory.getPair(a, b) as string;
}

export async function getReserves(provider: JsonRpcProvider | BrowserProvider, pair: string) {
  if (pair === ZeroAddress) return null;
  const c = new Contract(pair, PAIR_ABI, provider);
  const [r0, r1] = await c.getReserves();
  const t0 = await c.token0();
  const t1 = await c.token1();
  return { token0: t0 as string, token1: t1 as string, reserve0: r0 as bigint, reserve1: r1 as bigint };
}

export async function wrapIRL(signer: JsonRpcSigner, amount: bigint) {
  const c = new Contract(CONTRACTS.WETH, WETH_ABI, signer);
  return await c.deposit({ value: amount });
}
export async function unwrapIRL(signer: JsonRpcSigner, amount: bigint) {
  const c = new Contract(CONTRACTS.WETH, WETH_ABI, signer);
  return await c.withdraw(amount);
}

export const fmt = (v: bigint, decimals = 18, max = 6) => {
  const s = formatUnits(v, decimals);
  const n = Number(s);
  if (!isFinite(n)) return s;
  if (n === 0) return "0";
  if (n < 0.000001) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
};
export const parse = (s: string, decimals = 18) => {
  if (!s || isNaN(Number(s))) return 0n;
  try { return parseUnits(s as `${number}`, decimals); } catch { return 0n; }
};
