// Chain registry for EAGLEDEX.
// Currently deployed on SVPChain Testnet. Add another entry here and it
// instantly becomes selectable from the network switcher in the header.
// Active chain is persisted in localStorage and applied at module-load via
// src/lib/chain.ts (page reloads on switch).

import svpLogo from "@/assets/irl-token.jpg";
import egdxLogo from "@/assets/eagle-logo.png";

const cmc = (id: number) => `https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png`;

export type TokenInfo = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
  isNative?: boolean;
};

export type ChainConfig = {
  key: string;            // stable id used for localStorage
  chainId: number;
  chainIdHex: string;
  name: string;
  shortName: string;
  rpcUrl: string;
  explorer: string;
  symbol: string;         // native symbol
  decimals: number;       // native decimals
  contracts: {
    FACTORY: string;
    ROUTER: string;
    WETH: string;         // wrapped native
    LIBRARY: string;
    MULTICALL: string;
    FARM: string;
    FAUCET: string;       // optional, "" if none
  };
  nativeToken: TokenInfo;
  wrappedToken: TokenInfo;
  tokens: TokenInfo[];    // includes native + wrapped + erc20s
};

// ---------- SVPChain Testnet ----------
const SVP_NATIVE: TokenInfo = {
  address: "NATIVE", symbol: "SVP", name: "SVPChain", decimals: 18, logo: svpLogo, isNative: true,
};
const SVP_WRAPPED: TokenInfo = {
  address: "0x771a0a63D8198b7dbea4a16910ff68AB38006531",
  symbol: "WSVP", name: "Wrapped SVP", decimals: 18, logo: svpLogo,
};

const SVPCHAIN: ChainConfig = {
  key: "svpchain",
  chainId: 2517,
  chainIdHex: "0x9d5",
  name: "SVPChain Testnet",
  shortName: "SVPChain",
  rpcUrl: "https://svp-dataseed1-testnet.svpchain.org",
  explorer: "https://explorer.svpchain.com",
  symbol: "SVP",
  decimals: 18,
  contracts: {
    FACTORY:  "0x70af1341F5D5c60F913F6a21C669586C38592510",
    ROUTER:   "0x68F2458954032952d2ddd5D8Ee1d671e6E93Ae6C",
    WETH:     "0x771a0a63D8198b7dbea4a16910ff68AB38006531",
    LIBRARY:  "0x2Bf9ae7D36f6D057fC84d7f3165E9EB870f2e2e7",
    MULTICALL:"0xd0665e76B669af1F9EC4b4d83746b20aa81FbdCD",
    FARM:     "0x0cE4856A198484a1157D6ec19BD1bC2D97211176",
    FAUCET:   "0x0cE4856A198484a1157D6ec19BD1bC2D97211176",
  },
  nativeToken: SVP_NATIVE,
  wrappedToken: SVP_WRAPPED,
  tokens: [
    SVP_NATIVE,
    SVP_WRAPPED,
    { address: "0xA6E7648E5e16b8d6187180489b0CbC48E2140E48", symbol: "HYPE", name: "Hyperliquid", decimals: 18, logo: cmc(32196) },
    { address: "0x1b3D9Cd8C7f2551361d4bd0c80960c3eE7D0683E", symbol: "ETH",  name: "Ethereum",    decimals: 18, logo: cmc(1027) },
    { address: "0x5FE8080b3eA5207425Cc59aB219Cf0024523D7E5", symbol: "BNB",  name: "BNB",         decimals: 18, logo: cmc(1839) },
    { address: "0x69fF4F880E03aA02cA551F4F98A183A8c09fF940", symbol: "UNI",  name: "Uniswap",     decimals: 18, logo: cmc(7083) },
    { address: "0x6d950f88E6939808c0dEAe5b28Db3de4E3731f0C", symbol: "XRP",  name: "XRP",         decimals: 18, logo: cmc(52) },
    { address: "0xfD290E1e7DAc27EcaaA4A93fbB66cD0f00b2e073", symbol: "EGDX", name: "EagleDex",    decimals: 18, logo: egdxLogo },
  ],
};

export const CHAINS: ChainConfig[] = [SVPCHAIN];
export const CHAINS_BY_KEY: Record<string, ChainConfig> = Object.fromEntries(CHAINS.map(c => [c.key, c]));
export const CHAINS_BY_ID: Record<number, ChainConfig> = Object.fromEntries(CHAINS.map(c => [c.chainId, c]));

const ACTIVE_KEY = "eagledex:activeChain";
const DEFAULT_KEY = "svpchain";

export function getActiveChainKey(): string {
  if (typeof localStorage === "undefined") return DEFAULT_KEY;
  const k = localStorage.getItem(ACTIVE_KEY);
  return k && CHAINS_BY_KEY[k] ? k : DEFAULT_KEY;
}

export function getActiveChain(): ChainConfig {
  return CHAINS_BY_KEY[getActiveChainKey()] ?? SVPCHAIN;
}

/** Persist & reload — many modules read chain config at module-load. */
export function setActiveChain(key: string) {
  if (!CHAINS_BY_KEY[key]) return;
  localStorage.setItem(ACTIVE_KEY, key);
  // Hard reload so cached providers / contracts re-init against the new chain.
  window.location.reload();
}
