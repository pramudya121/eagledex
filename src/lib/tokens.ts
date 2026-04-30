// Custom token registry — persisted in localStorage, shared across all pages.
import { Contract, JsonRpcProvider, isAddress } from "ethers";
import { TOKENS, TokenInfo } from "./chain";
import { ERC20_ABI } from "./abis";

const KEY = "eagledex:customTokens";

export function loadCustomTokens(): TokenInfo[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function saveCustomTokens(list: TokenInfo[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("eagledex:tokens-updated"));
}

export function addCustomToken(t: TokenInfo) {
  const list = loadCustomTokens();
  if (list.some(x => x.address.toLowerCase() === t.address.toLowerCase())) return list;
  const next = [...list, t];
  saveCustomTokens(next);
  return next;
}

export function removeCustomToken(address: string) {
  const next = loadCustomTokens().filter(t => t.address.toLowerCase() !== address.toLowerCase());
  saveCustomTokens(next);
  return next;
}

export function getAllTokens(): TokenInfo[] {
  return [...TOKENS, ...loadCustomTokens()];
}

export async function fetchOnchainTokenMeta(provider: JsonRpcProvider, address: string): Promise<Omit<TokenInfo, "logo"> | null> {
  if (!isAddress(address)) return null;
  try {
    const c = new Contract(address, ERC20_ABI, provider);
    const [sym, name, dec] = await Promise.all([c.symbol(), c.name(), c.decimals()]);
    return { address, symbol: String(sym), name: String(name), decimals: Number(dec) };
  } catch { return null; }
}
