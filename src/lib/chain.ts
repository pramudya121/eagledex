// EAGLEDEX — chain config (re-exports active chain from chains.ts).
// Switch chains via the network switcher in the header (NetworkSwitcher.tsx),
// which calls setActiveChain() and reloads the page.

import { getActiveChain, type TokenInfo as _TokenInfo } from "./chains";

const ACTIVE = getActiveChain();

export type TokenInfo = _TokenInfo;

export const INTEGRALAYER = {
  // NOTE: name kept for backwards compat — represents the *active* chain.
  chainId: ACTIVE.chainId,
  chainIdHex: ACTIVE.chainIdHex,
  name: ACTIVE.name,
  rpcUrl: ACTIVE.rpcUrl,
  explorer: ACTIVE.explorer,
  symbol: ACTIVE.symbol,
  decimals: ACTIVE.decimals,
};

export const CONTRACTS = ACTIVE.contracts;

export const NATIVE_TOKEN: TokenInfo = ACTIVE.nativeToken;
export const WIRL_TOKEN: TokenInfo = ACTIVE.wrappedToken;
export const TOKENS: TokenInfo[] = ACTIVE.tokens;

export const explorerTx = (hash: string) => `${ACTIVE.explorer}/tx/${hash}`;
export const explorerAddr = (a: string) => `${ACTIVE.explorer}/address/${a}`;

// Re-export multi-chain helpers for components that need them directly.
export { CHAINS, CHAINS_BY_KEY, CHAINS_BY_ID, getActiveChain, getActiveChainKey, setActiveChain } from "./chains";
export type { ChainConfig } from "./chains";
