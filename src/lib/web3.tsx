import { BrowserProvider, JsonRpcProvider, JsonRpcSigner, Contract, formatUnits } from "ethers";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { INTEGRALAYER, CONTRACTS } from "./chain";
import { FACTORY_ABI, ROUTER_ABI } from "./abis";
import { bootIndexer } from "./poolIndex";
import { toast } from "sonner";

export type WalletId = "metamask" | "okx" | "rabby" | "bitget" | "coinbase" | "subwallet" | "rainbow" | "walletconnect";

type EthereumProvider = any;

// WalletConnect v2 — singleton EIP-1193 provider.
// Requires a real Reown / WalletConnect Cloud projectId via VITE_WC_PROJECT_ID.
// We do NOT bake a public/demo id because it triggers a "Project not found" WS
// error on the relay server (code 3000). When missing we surface a clear toast.
const WC_PROJECT_ID = ((import.meta as any).env?.VITE_WC_PROJECT_ID || "").trim();
export const WC_AVAILABLE = WC_PROJECT_ID.length >= 8;

let _wcProvider: any | null = null;
let _wcInitPromise: Promise<any> | null = null;
async function getWalletConnectProvider(): Promise<any> {
  if (!WC_AVAILABLE) {
    throw new Error(
      "WalletConnect not configured. Set VITE_WC_PROJECT_ID from cloud.reown.com.",
    );
  }
  if (_wcProvider) return _wcProvider;
  if (_wcInitPromise) return _wcInitPromise;
  _wcInitPromise = (async () => {
    const mod = await import("@walletconnect/ethereum-provider");
    const EthereumProvider = (mod as any).EthereumProvider ?? (mod as any).default;
    const p = await EthereumProvider.init({
      projectId: WC_PROJECT_ID,
      chains: [INTEGRALAYER.chainId],
      optionalChains: [INTEGRALAYER.chainId, 1],
      showQrModal: true,
      rpcMap: { [INTEGRALAYER.chainId]: INTEGRALAYER.rpcUrl },
      metadata: {
        name: "EAGLEDEX",
        description: "EAGLEDEX — DEX on Integralayer",
        url: typeof window !== "undefined" ? window.location.origin : "https://eagledex.app",
        icons: [typeof window !== "undefined" ? `${window.location.origin}/favicon.ico` : ""],
      },
    });
    _wcProvider = p;
    return p;
  })();
  return _wcInitPromise;
}

function getInjected(id: WalletId): EthereumProvider | null {
  const w = window as any;
  switch (id) {
    case "metamask": {
      const eth = w.ethereum;
      if (!eth) return null;
      if (eth.providers?.length) {
        return eth.providers.find((p: any) => p.isMetaMask && !p.isRabby && !p.isBitKeep && !p.isOkxWallet) || null;
      }
      return eth.isMetaMask && !eth.isRabby && !eth.isBitKeep && !eth.isOkxWallet ? eth : null;
    }
    case "okx":
      return w.okxwallet || (w.ethereum?.isOkxWallet ? w.ethereum : null);
    case "rabby": {
      const eth = w.ethereum;
      if (eth?.providers?.length) return eth.providers.find((p: any) => p.isRabby) || null;
      return eth?.isRabby ? eth : null;
    }
    case "bitget":
      return w.bitkeep?.ethereum || (w.ethereum?.isBitKeep ? w.ethereum : null);
    case "coinbase": {
      const eth = w.ethereum;
      if (w.coinbaseWalletExtension) return w.coinbaseWalletExtension;
      if (eth?.providers?.length) return eth.providers.find((p: any) => p.isCoinbaseWallet) || null;
      return eth?.isCoinbaseWallet ? eth : null;
    }
    case "subwallet":
      return w.SubWallet || (w.ethereum?.isSubWallet ? w.ethereum : null);
    case "rainbow": {
      const eth = w.ethereum;
      if (eth?.providers?.length) return eth.providers.find((p: any) => p.isRainbow) || null;
      return eth?.isRainbow ? eth : null;
    }
    case "walletconnect":
      // WalletConnect doesn't need an injected provider — it's reachable via QR.
      // Only mark "available" when projectId is configured.
      if (!WC_AVAILABLE) return null;
      return _wcProvider ?? ({ __wc: true } as any);
  }
}

export const WALLETS: { id: WalletId; name: string; popular?: boolean }[] = [
  { id: "metamask",      name: "MetaMask" },
  { id: "rabby",         name: "Rabby Wallet" },
  { id: "okx",           name: "OKX Wallet" },
  { id: "bitget",        name: "Bitget Wallet" },
  { id: "subwallet",     name: "SubWallet" },
  { id: "coinbase",      name: "Coinbase Wallet", popular: true },
  { id: "rainbow",       name: "Rainbow",         popular: true },
  { id: "walletconnect", name: "WalletConnect",   popular: true },
];

export function isWalletInstalled(id: WalletId): boolean {
  if (id === "walletconnect") return WC_AVAILABLE; // requires VITE_WC_PROJECT_ID
  return getInjected(id) != null;
}

// Global hook so non-React modules (e.g. lib/tx.ts) can request a chain check
// before broadcasting a transaction. Registered by Web3Provider on mount.
let _ensureChainGlobal: (() => Promise<void>) | null = null;
export async function ensureChainGlobal(): Promise<void> {
  if (_ensureChainGlobal) return _ensureChainGlobal();
}

// Global balance refresh hook — registered by Web3Provider so non-React modules
// (e.g. lib/tx.ts) can refresh the user's native balance after a successful tx.
let _refreshBalanceGlobal: (() => Promise<void>) | null = null;
export async function refreshBalanceGlobal(): Promise<void> {
  if (_refreshBalanceGlobal) return _refreshBalanceGlobal();
}

interface Web3Ctx {
  account: string | null;
  chainId: number | null;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  readProvider: JsonRpcProvider;
  factory: Contract;
  router: Contract;
  connect: (id: WalletId) => Promise<void>;
  disconnect: () => void;
  switchToIntegralayer: () => Promise<void>;
  isCorrectChain: boolean;
  nativeBalance: string;
  refreshBalance: () => Promise<void>;
  walletId: WalletId | null;
  /** Throws a clear Error if the wallet isn't on Integralayer after attempting an auto-switch. */
  ensureChain: () => Promise<void>;
}

const Ctx = createContext<Web3Ctx | null>(null);

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [walletId, setWalletId] = useState<WalletId | null>(null);
  const [nativeBalance, setNativeBalance] = useState("0");

  const readProvider = useMemo(() => new JsonRpcProvider(INTEGRALAYER.rpcUrl, INTEGRALAYER.chainId), []);
  useEffect(() => { bootIndexer(readProvider); }, [readProvider]);
  const factory = useMemo(() => new Contract(CONTRACTS.FACTORY, FACTORY_ABI, signer ?? readProvider), [signer, readProvider]);
  const router  = useMemo(() => new Contract(CONTRACTS.ROUTER,  ROUTER_ABI,  signer ?? readProvider), [signer, readProvider]);

  const isCorrectChain = chainId === INTEGRALAYER.chainId;

  const refreshBalance = useCallback(async () => {
    if (!account) return;
    const p = provider ?? readProvider;
    try {
      const b = await p.getBalance(account);
      setNativeBalance(formatUnits(b, 18));
    } catch {}
  }, [account, provider, readProvider]);

  useEffect(() => { refreshBalance(); }, [refreshBalance, chainId]);

  const switchToIntegralayer = useCallback(async () => {
    let eth: any = null;
    if (walletId === "walletconnect") {
      eth = _wcProvider;
    } else if (walletId) {
      eth = getInjected(walletId);
    } else {
      eth = (window as any).ethereum;
    }
    if (!eth) return;
    const addParams = [{
      chainId: INTEGRALAYER.chainIdHex,
      chainName: INTEGRALAYER.name,
      nativeCurrency: { name: "IRL", symbol: INTEGRALAYER.symbol, decimals: 18 },
      rpcUrls: [INTEGRALAYER.rpcUrl],
      blockExplorerUrls: [INTEGRALAYER.explorer],
    }];
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: INTEGRALAYER.chainIdHex }] });
    } catch (e: any) {
      const code = e?.code ?? e?.data?.originalError?.code;
      // 4902 = chain not added. Some wallets return -32603 / generic when chain unknown.
      if (code === 4902 || code === -32603 || /Unrecognized chain|not added/i.test(e?.message ?? "")) {
        await eth.request({ method: "wallet_addEthereumChain", params: addParams });
        // After adding, attempt switch again to be sure the wallet is actually on it.
        try {
          await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: INTEGRALAYER.chainIdHex }] });
        } catch {}
      } else { throw e; }
    }
  }, [walletId]);

  const ensureChain = useCallback(async () => {
    if (!provider || !signer) throw new Error("Wallet not connected");
    // Always re-read the live chainId from the provider (state may be stale right after switch)
    let net = await provider.getNetwork();
    if (Number(net.chainId) === INTEGRALAYER.chainId) return;
    try {
      await switchToIntegralayer();
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || String(e);
      throw new Error(
        `Wrong network. Please switch your wallet to ${INTEGRALAYER.name} (chainId ${INTEGRALAYER.chainId}). ${msg}`,
      );
    }
    // Re-check after the switch attempt
    net = await provider.getNetwork();
    if (Number(net.chainId) !== INTEGRALAYER.chainId) {
      throw new Error(
        `Wallet is still on chain ${Number(net.chainId)}. Approve the switch to ${INTEGRALAYER.name} (chainId ${INTEGRALAYER.chainId}) and try again.`,
      );
    }
    setChainId(INTEGRALAYER.chainId);
  }, [provider, signer, switchToIntegralayer]);

  // Expose ensureChain to non-React modules (lib/tx.ts uses it)
  useEffect(() => {
    _ensureChainGlobal = ensureChain;
    return () => { if (_ensureChainGlobal === ensureChain) _ensureChainGlobal = null; };
  }, [ensureChain]);

  // Expose refreshBalance to non-React modules
  useEffect(() => {
    _refreshBalanceGlobal = refreshBalance;
    return () => { if (_refreshBalanceGlobal === refreshBalance) _refreshBalanceGlobal = null; };
  }, [refreshBalance]);

  const connect = useCallback(async (id: WalletId) => {
    let eth: any;
    if (id === "walletconnect") {
      try {
        eth = await getWalletConnectProvider();
        // Triggers QR modal / deep-link if not already connected
        if (!eth.session) {
          await eth.connect();
        } else {
          await eth.enable();
        }
      } catch (e: any) {
        toast.error("WalletConnect failed", { description: e?.message ?? String(e) });
        return;
      }
    } else {
      eth = getInjected(id);
      if (!eth) {
        toast.error(`${id} wallet not detected`, { description: "Please install the extension." });
        return;
      }
    }
    try {
      const accs: string[] = id === "walletconnect"
        ? (eth.accounts && eth.accounts.length ? eth.accounts : await eth.request({ method: "eth_requestAccounts" }))
        : await eth.request({ method: "eth_requestAccounts" });
      const bp = new BrowserProvider(eth, "any");
      const sg = await bp.getSigner();
      const net = await bp.getNetwork();
      setProvider(bp); setSigner(sg);
      setAccount(accs[0]); setChainId(Number(net.chainId)); setWalletId(id);
      localStorage.setItem("eagledex:wallet", id);

      if (Number(net.chainId) !== INTEGRALAYER.chainId) {
        try { await switchToIntegralayer(); } catch {}
      }

      eth.on?.("accountsChanged", (a: string[]) => setAccount(a[0] ?? null));
      eth.on?.("chainChanged", (c: string) => setChainId(parseInt(c, 16)));
      eth.on?.("disconnect", () => {
        setAccount(null); setSigner(null); setProvider(null); setWalletId(null);
        localStorage.removeItem("eagledex:wallet");
      });
      toast.success("Wallet connected", { description: `${accs[0].slice(0,6)}…${accs[0].slice(-4)}` });
    } catch (e: any) {
      toast.error("Connection failed", { description: e?.message ?? String(e) });
    }
  }, [switchToIntegralayer]);

  const disconnect = useCallback(async () => {
    if (walletId === "walletconnect" && _wcProvider) {
      try { await _wcProvider.disconnect(); } catch {}
    }
    setAccount(null); setSigner(null); setProvider(null); setWalletId(null);
    localStorage.removeItem("eagledex:wallet");
  }, [walletId]);

  // auto reconnect
  useEffect(() => {
    const saved = localStorage.getItem("eagledex:wallet") as WalletId | null;
    if (saved) connect(saved).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider value={{
      account, chainId, provider, signer, readProvider, factory, router,
      connect, disconnect, switchToIntegralayer, isCorrectChain, nativeBalance, refreshBalance, walletId, ensureChain,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWeb3() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWeb3 must be inside Web3Provider");
  return c;
}
