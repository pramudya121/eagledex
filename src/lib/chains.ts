// Chain registry for QuantaX.
// Currently deployed on QMS Testnet. Add another entry here and it
// instantly becomes selectable from the network switcher in the header.
// Active chain is persisted in localStorage and applied at module-load via
// src/lib/chain.ts (page reloads on switch).

import qmsLogo from "@/assets/qms-token.png";
import qtxLogo from "@/assets/qtx-token.png";

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
    // Launchpad suite (optional per chain — "" disables the launchpad UI)
    LAUNCHPAD_FACTORY: string;
    FEE_MANAGER: string;
    ANTIBOT: string;
    REFERRAL: string;
    LP_LOCKER: string;
  };
  nativeToken: TokenInfo;
  wrappedToken: TokenInfo;
  tokens: TokenInfo[];    // includes native + wrapped + erc20s
};

// ---------- QMS Testnet ----------
const QMS_NATIVE: TokenInfo = {
  address: "NATIVE", symbol: "QMS", name: "QMS", decimals: 18, logo: qmsLogo, isNative: true,
};
const QMS_WRAPPED: TokenInfo = {
  address: "0x9AA510295aC664A3d5A3182a3eFe959DE2B12c34",
  symbol: "WQMS", name: "Wrapped QMS", decimals: 18, logo: qmsLogo,
};

const QMS_CHAIN: ChainConfig = {
  key: "qms",
  chainId: 19480,
  chainIdHex: "0x4c18",
  name: "QMS Testnet",
  shortName: "QMS",
  rpcUrl: "https://rpc.testnet.qms.finance",
  explorer: "https://testnet.qmsscan.io",
  symbol: "QMS",
  decimals: 18,
  contracts: {
    FACTORY:  "0x97C305119f5D98aFd11bCD19a1ba8c27d68F3546",
    ROUTER:   "0x3A153e8BcDe02F4Cf6C5eeECD9c83bC0296FFbD3",
    WETH:     "0x9AA510295aC664A3d5A3182a3eFe959DE2B12c34",
    LIBRARY:  "0x03D2D542100fa926de135a08B609c8538E45F6ee",
    MULTICALL:"0x8705875084c72C0cDC01c1Ac36A807808c8E5850",
    FARM:     "0xA5A90E43Df65AD62E45Edc526A1FD147cdDea6c8",
    // NOTE: no faucet contract deployed on QMS Testnet yet — the faucet
    // pages stay in "unavailable" mode until a real faucet is provided.
    FAUCET:   "",
    // Launchpad suite not deployed on QMS Testnet yet.
    LAUNCHPAD_FACTORY: "",
    FEE_MANAGER:       "",
    ANTIBOT:           "",
    REFERRAL:          "",
    LP_LOCKER:         "",
  },
  nativeToken: QMS_NATIVE,
  wrappedToken: QMS_WRAPPED,
  tokens: [
    QMS_NATIVE,
    QMS_WRAPPED,
    { address: "0x7b277d0387ccDFC395Eae0EFe2321765afAb37c8", symbol: "BNB",  name: "BNB",        decimals: 18, logo: cmc(1839) },
    { address: "0x0177E73214265D1d6f29a273155803Af5Bf47cFa", symbol: "ETH",  name: "Ethereum",   decimals: 18, logo: cmc(1027) },
    { address: "0x05466944d61662225ad19916725975230bb5b2B7", symbol: "MON",  name: "MON",        decimals: 18, logo: "" },
    { address: "0x1C9FAFD0A5803d51EB2BEb9D54304cAe574734CF", symbol: "HYPE", name: "Hyperliquid",decimals: 18, logo: cmc(32196) },
    { address: "0x66E5cbb0325Ab93B42c16592Be91456cc195E427", symbol: "QTX",  name: "QuantaX",    decimals: 18, logo: qtxLogo },
  ],
};

export const CHAINS: ChainConfig[] = [QMS_CHAIN];
export const CHAINS_BY_KEY: Record<string, ChainConfig> = Object.fromEntries(CHAINS.map(c => [c.key, c]));
export const CHAINS_BY_ID: Record<number, ChainConfig> = Object.fromEntries(CHAINS.map(c => [c.chainId, c]));

const ACTIVE_KEY = "eagledex:activeChain";
const DEFAULT_KEY = "qms";

export function getActiveChainKey(): string {
  if (typeof localStorage === "undefined") return DEFAULT_KEY;
  const k = localStorage.getItem(ACTIVE_KEY);
  return k && CHAINS_BY_KEY[k] ? k : DEFAULT_KEY;
}

export function getActiveChain(): ChainConfig {
  return CHAINS_BY_KEY[getActiveChainKey()] ?? QMS_CHAIN;
}

/** Persist & reload — many modules read chain config at module-load. */
export function setActiveChain(key: string) {
  if (!CHAINS_BY_KEY[key]) return;
  localStorage.setItem(ACTIVE_KEY, key);
  // Hard reload so cached providers / contracts re-init against the new chain.
  window.location.reload();
}
