import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWeb3 } from "@/lib/web3";
import { TOKENS, NATIVE_TOKEN, TokenInfo, INTEGRALAYER, explorerTx } from "@/lib/chain";
import { ERC20_ABI } from "@/lib/abis";
import { Contract, formatUnits, parseUnits, isAddress, getAddress } from "ethers";
import { Send, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { sendTx } from "@/lib/tx";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pre-selected token (optional). User can still change. */
  initialToken?: TokenInfo;
  onSent?: () => void;
}

const SendTokenDialog = ({ open, onOpenChange, initialToken, onSent }: Props) => {
  const { account, signer, readProvider, nativeBalance, refreshBalance, ensureChain, isCorrectChain, switchNetwork } = useWeb3();
  const [token, setToken] = useState<TokenInfo>(initialToken ?? NATIVE_TOKEN);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<bigint>(0n);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (initialToken) setToken(initialToken); }, [initialToken, open]);

  // Load balance for selected token
  useEffect(() => {
    if (!open || !account) return;
    let alive = true;
    (async () => {
      try {
        if (token.isNative) {
          const b = await readProvider.getBalance(account);
          if (alive) setBalance(b);
        } else {
          const c = new Contract(token.address, ERC20_ABI, readProvider);
          const b: bigint = await c.balanceOf(account);
          if (alive) setBalance(b);
        }
      } catch { if (alive) setBalance(0n); }
    })();
    return () => { alive = false; };
  }, [open, account, token, readProvider]);

  const toErr = useMemo(() => {
    if (!to) return "";
    if (!isAddress(to)) return "Invalid address";
    try {
      if (account && getAddress(to) === getAddress(account)) return "Cannot send to yourself";
    } catch {}
    return "";
  }, [to, account]);

  const amtErr = useMemo(() => {
    if (!amount) return "";
    let parsed: bigint;
    try { parsed = parseUnits(amount, token.decimals); }
    catch { return "Invalid amount"; }
    if (parsed <= 0n) return "Amount must be > 0";
    if (parsed > balance) return "Insufficient balance";
    return "";
  }, [amount, balance, token.decimals]);

  const canSend = !!account && !!signer && !toErr && !amtErr && to && amount && !busy;

  const onMax = () => {
    if (token.isNative) {
      // Reserve a small amount for gas
      const reserve = parseUnits("0.001", 18);
      const usable = balance > reserve ? balance - reserve : 0n;
      setAmount(formatUnits(usable, 18));
    } else {
      setAmount(formatUnits(balance, token.decimals));
    }
  };

  const submit = async () => {
    if (!signer || !account) return;
    setBusy(true);
    try {
      const value = parseUnits(amount, token.decimals);
      const recipient = getAddress(to);
      if (token.isNative) {
        await sendTx(`Send ${amount} ${token.symbol}`, async () => {
          const tx = await signer.sendTransaction({ to: recipient, value });
          return tx as any;
        });
      } else {
        const c = new Contract(token.address, ERC20_ABI, signer);
        await sendTx(`Send ${amount} ${token.symbol}`, async () => c.transfer(recipient, value));
      }
      await refreshBalance();
      onSent?.();
      onOpenChange(false);
      setTo(""); setAmount("");
    } catch (e: any) {
      // sendTx already toasted with details; nothing extra needed.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="w-4 h-4 text-primary"/> Send Token</DialogTitle>
        </DialogHeader>

        {!isCorrectChain && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5"/>
            <div className="flex-1">
              <div className="font-semibold text-destructive">Wrong network</div>
              <div className="text-muted-foreground">Switch to {INTEGRALAYER.name} (chainId {INTEGRALAYER.chainId}).</div>
            </div>
            <Button size="sm" variant="destructive" onClick={() => switchNetwork()}>Switch</Button>
          </div>
        )}

        {/* Token selector */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Token</label>
          <select
            value={token.address}
            onChange={(e) => {
              const t = TOKENS.find(t => t.address === e.target.value) ?? NATIVE_TOKEN;
              setToken(t); setAmount("");
            }}
            className="w-full bg-secondary/40 border border-border rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-primary"
          >
            {TOKENS.map(t => (
              <option key={t.address} value={t.address}>
                {t.symbol} — {t.name}{t.isNative ? " (native)" : ""}
              </option>
            ))}
          </select>
          <div className="text-[11px] text-muted-foreground mt-1 flex justify-between">
            <span>Balance</span>
            <span className="font-mono">{Number(formatUnits(balance, token.decimals)).toLocaleString(undefined,{maximumFractionDigits:6})} {token.symbol}</span>
          </div>
        </div>

        {/* Recipient */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Recipient</label>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            placeholder="0x…"
            className={`font-mono text-sm ${toErr ? "border-destructive" : ""}`}
          />
          {toErr && <p className="text-[11px] text-destructive mt-1">{toErr}</p>}
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
          <div className="relative">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.0"
              inputMode="decimal"
              className={`font-mono pr-16 ${amtErr ? "border-destructive" : ""}`}
            />
            <button onClick={onMax} className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-primary/15 text-primary text-[10px] font-bold uppercase hover:bg-primary/25">Max</button>
          </div>
          {amtErr && <p className="text-[11px] text-destructive mt-1">{amtErr}</p>}
        </div>

        <Button
          onClick={submit}
          disabled={!canSend}
          className="btn-primary-grad text-primary-foreground font-bold rounded-xl w-full"
        >
          {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Sending…</> : <><Send className="w-4 h-4 mr-2"/> Send</>}
        </Button>

        <p className="text-[10px] text-muted-foreground text-center">
          Transactions are signed by your wallet and broadcast to {INTEGRALAYER.name}.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default SendTokenDialog;