// EAGLEDEX — Integralayer testnet config
export const INTEGRALAYER = {
  chainId: 26218,
  chainIdHex: "0x666a",
  name: "Integralayer Testnet",
  rpcUrl: "https://testnet.integralayer.com/evm",
  explorer: "https://testnet.blockscout.integralayer.com",
  symbol: "IRL",
  decimals: 18,
};

export const CONTRACTS = {
  FACTORY: "0x5687FDA3BdE14d38057699c402606ab470EcA873",
  ROUTER: "0xd28967D75750f477E450Df81C73f34E2713B86B4",
  WETH: "0x4Fd3765cde8D1d2BE4EdbaA03940AfC56794c304", // WIRL
  LIBRARY: "0x084724341e07F50782E1c3923D9a6Fb7ce993816",
  MULTICALL: "0xEc94943b75359f1ede3d639AD548e56239d754c2",
} as const;

export type TokenInfo = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
  isNative?: boolean;
};

// CMC logo CDN
const cmc = (id: number) => `https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png`;

import irlLogo from "@/assets/irl-token.jpg";
import egdxLogo from "@/assets/eagle-logo.png";

export const NATIVE_TOKEN: TokenInfo = {
  address: "NATIVE",
  symbol: "IRL",
  name: "Integralayer",
  decimals: 18,
  logo: irlLogo,
  isNative: true,
};

export const WIRL_TOKEN: TokenInfo = {
  address: CONTRACTS.WETH,
  symbol: "WIRL",
  name: "Wrapped IRL",
  decimals: 18,
  logo: irlLogo,
};

export const TOKENS: TokenInfo[] = [
  NATIVE_TOKEN,
  WIRL_TOKEN,
  { address: "0xa12C18847c41ECE267155ffAe112b8951AbbcA1C", symbol: "HYPE", name: "Hyperliquid", decimals: 18, logo: cmc(32196) },
  { address: "0xBB3B44EB672650Fb4a1Cf6D9dc5d3b7494F333AB", symbol: "ETH",  name: "Ethereum",    decimals: 18, logo: cmc(1027) },
  { address: "0x5b0AE944A4Ee6241a5A638C440A0dCD42411bD3C", symbol: "BNB",  name: "BNB",         decimals: 18, logo: cmc(1839) },
  { address: "0xF143eCFE3DFEEB4ae188cA4f1c7c7ab0b5F592eb", symbol: "UNI",  name: "Uniswap",     decimals: 18, logo: cmc(7083) },
  { address: "0x1b3D9Cd8C7f2551361d4bd0c80960c3eE7D0683E", symbol: "XRP",  name: "XRP",         decimals: 18, logo: cmc(52) },
  { address: "0xEa71393074fFCB6d132B8a2b6028CAF952af03A5", symbol: "EGDX", name: "EagleDex",    decimals: 18, logo: egdxLogo },
];

export const explorerTx = (hash: string) => `${INTEGRALAYER.explorer}/tx/${hash}`;
export const explorerAddr = (a: string) => `${INTEGRALAYER.explorer}/address/${a}`;
