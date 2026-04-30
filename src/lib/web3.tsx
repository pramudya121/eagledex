import { BrowserProvider, JsonRpcProvider, JsonRpcSigner, Contract, formatUnits } from "ethers";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { INTEGRALAYER, CONTRACTS } from "./chain";
import { FACTORY_ABI, ROUTER_ABI } from "./abis";
import { bootIndexer } from "./poolIndex";
import { toast } from "sonner";

export type WalletId = "metamask" | "okx" | "rabby" | "bitget" | "coinbase" | "subwallet" | "rainbow" | "walletconnect";

type EthereumProvider = any;

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
      return null; // not yet wired; UI shows install hint
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
  return getInjected(id) != null;
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
    const eth = walletId ? getInjected(walletId) : (window as any).ethereum;
    if (!eth) return;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: INTEGRALAYER.chainIdHex }] });
    } catch (e: any) {
      if (e.code === 4902 || e.data?.originalError?.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: INTEGRALAYER.chainIdHex,
            chainName: INTEGRALAYER.name,
            nativeCurrency: { name: "IRL", symbol: INTEGRALAYER.symbol, decimals: 18 },
            rpcUrls: [INTEGRALAYER.rpcUrl],
            blockExplorerUrls: [INTEGRALAYER.explorer],
          }],
        });
      } else { throw e; }
    }
  }, [walletId]);

  const connect = useCallback(async (id: WalletId) => {
    const eth = getInjected(id);
    if (!eth) {
      toast.error(`${id} wallet not detected`, { description: "Please install the extension." });
      return;
    }
    try {
      const accs: string[] = await eth.request({ method: "eth_requestAccounts" });
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
      toast.success("Wallet connected", { description: `${accs[0].slice(0,6)}…${accs[0].slice(-4)}` });
    } catch (e: any) {
      toast.error("Connection failed", { description: e?.message ?? String(e) });
    }
  }, [switchToIntegralayer]);

  const disconnect = useCallback(() => {
    setAccount(null); setSigner(null); setProvider(null); setWalletId(null);
    localStorage.removeItem("eagledex:wallet");
  }, []);

  // auto reconnect
  useEffect(() => {
    const saved = localStorage.getItem("eagledex:wallet") as WalletId | null;
    if (saved) connect(saved).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider value={{
      account, chainId, provider, signer, readProvider, factory, router,
      connect, disconnect, switchToIntegralayer, isCorrectChain, nativeBalance, refreshBalance, walletId,
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
