// Multi-chain registry for EAGLEDEX.
// Add a new chain here and it instantly becomes selectable from the
// network switcher in the header. Active chain is persisted in localStorage
// and applied at module-load via src/lib/chain.ts (page reloads on switch).

import irlLogo from "@/assets/irl-token.jpg";
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

// ---------- Integralayer Testnet ----------
const INTEGRALAYER_NATIVE: TokenInfo = {
  address: "NATIVE", symbol: "IRL", name: "Integralayer", decimals: 18, logo: irlLogo, isNative: true,
};
const INTEGRALAYER_WRAPPED: TokenInfo = {
  address: "0x4Fd3765cde8D1d2BE4EdbaA03940AfC56794c304",
  symbol: "WIRL", name: "Wrapped IRL", decimals: 18, logo: irlLogo,
};

const INTEGRALAYER: ChainConfig = {
  key: "integralayer",
  chainId: 26218,
  chainIdHex: "0x666a",
  name: "Integralayer Testnet",
  shortName: "Integralayer",
  rpcUrl: "https://testnet.integralayer.com/evm",
  explorer: "https://testnet.blockscout.integralayer.com",
  symbol: "IRL",
  decimals: 18,
  contracts: {
    FACTORY:  "0x5687FDA3BdE14d38057699c402606ab470EcA873",
    ROUTER:   "0xd28967D75750f477E450Df81C73f34E2713B86B4",
    WETH:     "0x4Fd3765cde8D1d2BE4EdbaA03940AfC56794c304",
    LIBRARY:  "0x084724341e07F50782E1c3923D9a6Fb7ce993816",
    MULTICALL:"0xEc94943b75359f1ede3d639AD548e56239d754c2",
    FARM:     "0xD15b8348135BB498B5A4a05BBE008596a8BcaEC5",
    FAUCET:   "0xa0475e3d955A507a4ad23d8707575490B4862134",
  },
  nativeToken: INTEGRALAYER_NATIVE,
  wrappedToken: INTEGRALAYER_WRAPPED,
  tokens: [
    INTEGRALAYER_NATIVE,
    INTEGRALAYER_WRAPPED,
    { address: "0xa12C18847c41ECE267155ffAe112b8951AbbcA1C", symbol: "HYPE", name: "Hyperliquid", decimals: 18, logo: cmc(32196) },
    { address: "0xBB3B44EB672650Fb4a1Cf6D9dc5d3b7494F333AB", symbol: "ETH",  name: "Ethereum",    decimals: 18, logo: cmc(1027) },
    { address: "0x5b0AE944A4Ee6241a5A638C440A0dCD42411bD3C", symbol: "BNB",  name: "BNB",         decimals: 18, logo: cmc(1839) },
    { address: "0xF143eCFE3DFEEB4ae188cA4f1c7c7ab0b5F592eb", symbol: "UNI",  name: "Uniswap",     decimals: 18, logo: cmc(7083) },
    { address: "0x1b3D9Cd8C7f2551361d4bd0c80960c3eE7D0683E", symbol: "XRP",  name: "XRP",         decimals: 18, logo: cmc(52) },
    { address: "0xEa71393074fFCB6d132B8a2b6028CAF952af03A5", symbol: "EGDX", name: "EagleDex",    decimals: 18, logo: egdxLogo },
  ],
};

// ---------- ARC Testnet ----------
const ARC_NATIVE: TokenInfo = {
  address: "NATIVE", symbol: "USDC", name: "USD Coin (ARC)", decimals: 18, logo: cmc(3408), isNative: true,
};
const ARC_WRAPPED: TokenInfo = {
  address: "0x017F6C2Bf54c4b41DEDE71CCB2f3392Ec4865d7F",
  symbol: "WUSDC", name: "Wrapped USDC", decimals: 18, logo: cmc(3408),
};

const ARC: ChainConfig = {
  key: "arc",
  chainId: 5042002,
  chainIdHex: "0x4cefd2",
  name: "Arc Testnet",
  shortName: "Arc",
  rpcUrl: "https://rpc.testnet.arc.network",
  explorer: "https://testnet.arcscan.app",
  symbol: "USDC",
  decimals: 18,
  contracts: {
    FACTORY:  "0xCF192Cdaf6965908b9c28B1C2655Cf581582DF8a",
    ROUTER:   "0x939a2e40A100cE59B07164d95Ba3Bf5fec09F8c4",
    WETH:     "0x017F6C2Bf54c4b41DEDE71CCB2f3392Ec4865d7F",
    LIBRARY:  "0x49b94C9024796b5169B12C38Be758d291B21643A",
    MULTICALL:"0x55BeFA8e7fEcC15B651C12D17d7afC52305b007e",
    FARM:     "0x97a7C9CA33D71c561d8a8bc0Bb34c7C61B952bCa",
    FAUCET:   "",
  },
  nativeToken: ARC_NATIVE,
  wrappedToken: ARC_WRAPPED,
  tokens: [
    ARC_NATIVE,
    ARC_WRAPPED,
    { address: "0x69bb0149651A2a7dEDc18e5f9B4BCAFe46734292", symbol: "HYPE", name: "Hyperliquid", decimals: 18, logo: cmc(32196) },
    { address: "0x125502bD83C4F75087F3f53C0fD79087bDF84a31", symbol: "ETH",  name: "Ethereum",    decimals: 18, logo: cmc(1027) },
    { address: "0xDbBA6Ee246BcD0fD852F4e6aC03838f71C530A28", symbol: "BNB",  name: "BNB",         decimals: 18, logo: cmc(1839) },
    { address: "0xB0C78cCd1a546c6ACBc6cE5552E1D2c666Fe4E38", symbol: "UNI",  name: "Uniswap",     decimals: 18, logo: cmc(7083) },
    { address: "0x1780Eb1670fAB9e37Fb0C3799A4216EC34b3e904", symbol: "XRP",  name: "XRP",         decimals: 18, logo: cmc(52) },
    { address: "0xFf4e8AFce6977973d2D2B28455613Ce30048F832", symbol: "EGDX", name: "EagleDex",    decimals: 18, logo: egdxLogo },
  ],
};

export const CHAINS: ChainConfig[] = [INTEGRALAYER, ARC];
export const CHAINS_BY_KEY: Record<string, ChainConfig> = Object.fromEntries(CHAINS.map(c => [c.key, c]));
export const CHAINS_BY_ID: Record<number, ChainConfig> = Object.fromEntries(CHAINS.map(c => [c.chainId, c]));

const ACTIVE_KEY = "eagledex:activeChain";
const DEFAULT_KEY = "integralayer";

export function getActiveChainKey(): string {
  if (typeof localStorage === "undefined") return DEFAULT_KEY;
  const k = localStorage.getItem(ACTIVE_KEY);
  return k && CHAINS_BY_KEY[k] ? k : DEFAULT_KEY;
}

export function getActiveChain(): ChainConfig {
  return CHAINS_BY_KEY[getActiveChainKey()] ?? INTEGRALAYER;
}

/** Persist & reload — many modules read chain config at module-load. */
export function setActiveChain(key: string) {
  if (!CHAINS_BY_KEY[key]) return;
  localStorage.setItem(ACTIVE_KEY, key);
  // Hard reload so cached providers / contracts re-init against the new chain.
  window.location.reload();
}
