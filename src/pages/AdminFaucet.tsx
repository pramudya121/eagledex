import { useCallback, useEffect, useMemo, useState } from "react";
import { Contract, formatUnits, parseUnits, isAddress } from "ethers";
import { toast } from "sonner";
import {
  Shield, Loader2, AlertTriangle, RefreshCw, Droplet, Clock, ExternalLink,
  Coins, Send, Hash, CheckCircle2, Copy,
} from "lucide-react";
import { useWeb3 } from "@/lib/web3";
import { CONTRACTS, explorerAddr, TOKENS, NATIVE_TOKEN } from "@/lib/chain";
import { FAUCET_ABI, ERC20_ABI } from "@/lib/abis";
import { getFaucet, readFaucetTokens, FaucetTokenInfo } from "@/lib/faucet";
import { sendTx } from "@/lib/tx";
import { Input } from "@/components/ui/input";

const ZERO = "0x0000000000000000000000000000000000000000";
const MAX_SLOTS = 16;

// EAGLEDEX tokens that should populate the faucet (skip the native coin — faucet only handles ERC20).
const FAUCETABLE = TOKENS.filter(t => !t.isNative);

const tokenLogoFor = (address: string): string | null => {
  const a = address.toLowerCase();
  if (a === CONTRACTS.WETH.toLowerCase()) return NATIVE_TOKEN.logo;
  const t = TOKENS.find(x => x.address.toLowerCase() === a);
  return t?.logo ?? null;
};

const TokenLogo = ({ address, symbol, size = 36 }: { address: string; symbol: string; size?: number }) => {
  const src = tokenLogoFor(address);
  if (src) {
    return <img src={src} alt={symbol} width={size} height={size} style={{ width: size, height: size }} className="rounded-full ring-2 ring-cyan-400/30 bg-card object-cover" />;
  }
  return (
    <div style={{ width: size, height: size }} className="rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 grid place-items-center text-white font-extrabold text-xs ring-2 ring-cyan-400/30">
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
};

const AdminFaucet = () => {
  const { account, signer, readProvider } = useWeb3();
  if (!CONTRACTS.FAUCET) {
    return (
      <div className="max-w-xl mx-auto mt-16 glass rounded-2xl p-8 text-center">
        <Shield className="w-10 h-10 mx-auto text-primary mb-3" />
        <h1 className="text-xl font-extrabold mb-2">Admin Faucet not deployed on this network</h1>
        <p className="text-sm text-muted-foreground">Switch to a chain that has a faucet contract.</p>
      </div>
    );
  }
  const [owner, setOwner] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<bigint>(0n);
  const [tokens, setTokens] = useState<FaucetTokenInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const faucetRead = useMemo(() => getFaucet(readProvider), [readProvider]);
  const isOwner = !!(owner && account && owner.toLowerCase() === account.toLowerCase());

  const load = useCallback(async () => {
    try {
      const [own, cd, list] = await Promise.all([
        faucetRead.owner().catch(() => null),
        faucetRead.cooldown().catch(() => 0n),
        readFaucetTokens(faucetRead, readProvider, account, MAX_SLOTS),
      ]);
      setOwner(own); setCooldown(cd); setTokens(list);
    } finally { setLoading(false); }
  }, [faucetRead, readProvider, account]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;

  if (!account) return (
    <div className="max-w-xl mx-auto glass rounded-3xl p-10 text-center">
      <Shield className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
      <h2 className="text-2xl font-extrabold mb-1">Faucet Admin</h2>
      <p className="text-sm text-muted-foreground">Connect your wallet to verify ownership.</p>
    </div>
  );

  if (!isOwner) return (
    <div className="max-w-xl mx-auto glass rounded-3xl p-10 text-center border border-red-500/30 bg-gradient-to-br from-red-500/10 to-transparent">
      <AlertTriangle className="w-10 h-10 mx-auto text-red-400 mb-3" />
      <h2 className="text-2xl font-extrabold mb-1">Access denied</h2>
      <p className="text-sm text-muted-foreground">Only the contract owner can access this panel.</p>
      <div className="mt-3 text-[11px] font-mono text-muted-foreground">
        Owner: {owner ? <a className="text-cyan-300 hover:underline" href={explorerAddr(owner)} target="_blank" rel="noreferrer">{owner.slice(0, 8)}…{owner.slice(-6)}</a> : "unknown"}
      </div>
    </div>
  );

  const configured = tokens.filter(t => t.address && t.address !== ZERO).length;

  // Determine which suggested EAGLEDEX tokens are not yet configured.
  const configuredAddrs = new Set(tokens.map(t => t.address.toLowerCase()));
  const missingSuggestions = FAUCETABLE.filter(t => !configuredAddrs.has(t.address.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto animate-slide-up space-y-5 pb-10">
      {/* Hero */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 grid place-items-center shadow-[0_8px_24px_-8px_hsl(195_90%_55%/0.6)]">
            <Droplet className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">Token Faucet</span>
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">Claim free test tokens to use across EAGLEDEX on {INTEGRALAYER.name}.</p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Cooldown" value={prettyCooldown(cooldown)} />
        <Stat label="Tokens" value={String(configured)} />
        <Stat label="Owner" value={owner ? `${owner.slice(0, 6)}…${owner.slice(-4)}` : "—"} mono />
        <Stat label="You" value={`${account.slice(0, 6)}…${account.slice(-4)}`} mono />
      </div>

      {/* Setup helper */}
      <div className="glass rounded-2xl p-4 border border-cyan-400/20">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <div className="font-bold text-sm">Faucet Setup Status</div>
            <div className="text-xs text-muted-foreground">{configured}/{FAUCETABLE.length} tokens configured.</div>
          </div>
          <button onClick={load} className="h-8 px-3 rounded-lg border border-border bg-card/50 text-xs font-bold inline-flex items-center gap-1.5 hover:border-cyan-400/60">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        {missingSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground self-center">Quick add:</span>
            {missingSuggestions.map(t => (
              <QuickAddPill key={t.address} token={t} nextSlot={tokens.length} signer={signer} onChanged={load} />
            ))}
          </div>
        )}
      </div>

      {/* Cooldown */}
      <CooldownBar current={cooldown} signer={signer} onChanged={load} />

      {/* Per-token settings */}
      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-bold px-1">Per-token settings</div>
        {tokens.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
            No tokens configured yet. Use Quick add above or <em>Set token slot</em> below.
          </div>
        ) : (
          tokens.map(t => (
            <TokenRow key={t.index} token={t} signer={signer} account={account} onChanged={load} />
          ))
        )}

        {/* Empty next-slot row to set a brand new token */}
        {tokens.length < MAX_SLOTS && (
          <SetTokenRow nextIndex={tokens.length} signer={signer} onChanged={load} />
        )}
      </div>
    </div>
  );
};

const prettyCooldown = (s: bigint) => {
  const n = Number(s);
  if (!n) return "0s";
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${n}s`;
};

const Stat = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="rounded-xl border border-cyan-400/25 bg-card/40 p-3">
    <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-bold">{label}</div>
    <div className={`text-base font-extrabold mt-1 truncate ${mono ? "font-mono" : ""}`}>{value}</div>
  </div>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1.5">{children}</div>
);

/* ============== Cooldown ============== */
const CooldownBar = ({ current, signer, onChanged }: { current: bigint; signer: any; onChanged: () => void }) => {
  const [secs, setSecs] = useState(String(Number(current)));
  const [busy, setBusy] = useState(false);
  useEffect(() => setSecs(String(Number(current))), [current]);

  const submit = async () => {
    if (!signer) return toast.error("Connect wallet");
    setBusy(true);
    try {
      const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
      await sendTx(`Set cooldown ${secs}s`, () => c.setCooldown(BigInt(secs || "0")));
      onChanged();
    } catch {} finally { setBusy(false); }
  };

  return (
    <div className="glass rounded-2xl p-4 border border-cyan-400/20">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-4 h-4 text-cyan-300" />
        <div className="font-bold text-sm">Global Cooldown</div>
      </div>
      <div className="flex gap-2">
        <Input value={secs} onChange={e => setSecs(e.target.value.replace(/[^\d]/g, ""))} className="font-mono h-10 bg-card/60" placeholder="seconds" />
        <button onClick={submit} disabled={busy} className="h-10 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white font-bold text-sm disabled:opacity-50 inline-flex items-center gap-1.5">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Set
        </button>
      </div>
      <div className="text-[10px] text-muted-foreground mt-1.5">Time users must wait between claims of the same token.</div>
    </div>
  );
};

/* ============== Quick add pill ============== */
const QuickAddPill = ({ token, nextSlot, signer, onChanged }: any) => {
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!signer) return toast.error("Connect wallet");
    setBusy(true);
    try {
      const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
      await sendTx(`Add ${token.symbol} as #${nextSlot}`, () => c.setToken(nextSlot, token.address));
      onChanged();
    } catch {} finally { setBusy(false); }
  };
  return (
    <button onClick={submit} disabled={busy} className="px-2.5 py-1 rounded-full bg-card border border-cyan-400/30 hover:border-cyan-400 text-xs font-bold inline-flex items-center gap-1.5 transition disabled:opacity-50">
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <img src={token.logo} alt="" className="w-4 h-4 rounded-full" />}
      + {token.symbol}
    </button>
  );
};

/* ============== Set new token (empty row) ============== */
const SetTokenRow = ({ nextIndex, signer, onChanged }: any) => {
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!signer) return toast.error("Connect wallet");
    if (!isAddress(addr)) return toast.error("Invalid address");
    setBusy(true);
    try {
      const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
      await sendTx(`Set token slot #${nextIndex}`, () => c.setToken(nextIndex, addr));
      setAddr(""); onChanged();
    } catch {} finally { setBusy(false); }
  };
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/20 p-4">
      <FieldLabel>Add new token at slot #{nextIndex}</FieldLabel>
      <div className="flex gap-2">
        <Input value={addr} onChange={e => setAddr(e.target.value)} placeholder="0x… token address" className="font-mono text-xs h-10 bg-card/60" />
        <button onClick={submit} disabled={busy} className="h-10 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white font-bold text-sm disabled:opacity-50 inline-flex items-center gap-1.5">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Hash className="w-3.5 h-3.5" />} Set
        </button>
      </div>
    </div>
  );
};

/* ============== Per-token row ============== */
const TokenRow = ({ token, signer, account, onChanged }: { token: FaucetTokenInfo; signer: any; account: string; onChanged: () => void }) => {
  const [addr, setAddr] = useState(token.address);
  const [amt, setAmt] = useState(formatUnits(token.claimAmount, token.decimals));
  const [maxC, setMaxC] = useState(String(token.maxClaims));
  const [refill, setRefill] = useState("");
  const [wAmt, setWAmt] = useState("");
  const [wTo, setWTo] = useState("");
  const [user, setUser] = useState("");
  const [userCount, setUserCount] = useState("0");

  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setAddr(token.address);
    setAmt(formatUnits(token.claimAmount, token.decimals));
    setMaxC(String(token.maxClaims));
  }, [token.address, token.claimAmount, token.decimals, token.maxClaims]);

  const need = (b: any) => {
    if (!signer) { toast.error("Connect wallet"); return false; }
    return true;
  };
  const run = async (key: string, label: string, fn: () => Promise<any>) => {
    setBusy(key);
    try { await sendTx(label, fn); onChanged(); }
    catch {} finally { setBusy(null); }
  };

  const setTokenAddr = () => {
    if (!need(addr)) return;
    if (!isAddress(addr)) return toast.error("Invalid address");
    const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
    return run("addr", `Set token #${token.index}`, () => c.setToken(token.index, addr));
  };
  const setAmount = () => {
    if (!need(amt)) return;
    const v = parseUnits(amt || "0", token.decimals);
    const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
    return run("amt", `Set claimAmount #${token.index}`, () => c.setClaimAmount(token.index, v));
  };
  const setMax = () => {
    if (!need(maxC)) return;
    const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
    return run("max", `Set maxClaims #${token.index}`, () => c.setMaxClaims(token.index, BigInt(maxC || "0")));
  };
  const doRefill = async () => {
    if (!need(refill)) return;
    const v = parseUnits(refill || "0", token.decimals);
    if (v === 0n) return toast.error("Enter an amount");
    setBusy("refill");
    try {
      const erc = new Contract(token.address, ERC20_ABI, signer);
      const allowance: bigint = await erc.allowance(account, CONTRACTS.FAUCET);
      if (allowance < v) await sendTx(`Approve ${token.symbol}`, () => erc.approve(CONTRACTS.FAUCET, v));
      const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
      await sendTx(`Refill #${token.index}`, () => c.refill(token.index, v));
      setRefill(""); onChanged();
    } catch {} finally { setBusy(null); }
  };
  const doWithdraw = () => {
    if (!need(wAmt)) return;
    if (!isAddress(wTo)) return toast.error("Invalid recipient");
    const v = parseUnits(wAmt || "0", token.decimals);
    const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
    return run("withdraw", `Admin withdraw ${token.symbol}`, () => c.adminWithdraw(token.index, v, wTo));
  };
  const doSetUser = () => {
    if (!isAddress(user)) return toast.error("Invalid user");
    const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
    return run("user", `Set user count for ${user.slice(0, 8)}…`, () => c.setUserClaimCount(user, token.index, BigInt(userCount || "0")));
  };

  const reservoir = Number(formatUnits(token.faucetBalance, token.decimals));

  return (
    <div className="glass rounded-2xl p-4 border border-cyan-400/20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <TokenLogo address={token.address} symbol={token.symbol} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-extrabold">{token.symbol}</span>
            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">slot #{token.index}</span>
          </div>
          <a href={explorerAddr(token.address)} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-muted-foreground hover:text-cyan-300 inline-flex items-center gap-1">
            {token.address.slice(0, 10)}…{token.address.slice(-8)} <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Pool</div>
          <div className="font-mono font-extrabold">{reservoir.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {/* Token address */}
        <div>
          <FieldLabel>Token address</FieldLabel>
          <div className="flex gap-2">
            <Input value={addr} onChange={e => setAddr(e.target.value)} className="font-mono text-xs h-9 bg-card/60" />
            <ActionBtn busy={busy === "addr"} onClick={setTokenAddr} color="violet">Set</ActionBtn>
          </div>
        </div>
        {/* Claim amount */}
        <div>
          <FieldLabel>Claim amount (per claim)</FieldLabel>
          <div className="flex gap-2">
            <Input value={amt} onChange={e => setAmt(e.target.value)} className="font-mono text-xs h-9 bg-card/60" />
            <ActionBtn busy={busy === "amt"} onClick={setAmount} color="amber">Set</ActionBtn>
          </div>
        </div>
        {/* Max claims */}
        <div>
          <FieldLabel>Max claims per user (0 = unlimited)</FieldLabel>
          <div className="flex gap-2">
            <Input value={maxC} onChange={e => setMaxC(e.target.value.replace(/[^\d]/g, ""))} className="font-mono text-xs h-9 bg-card/60" />
            <ActionBtn busy={busy === "max"} onClick={setMax} color="violet">Set</ActionBtn>
          </div>
        </div>
        {/* Refill */}
        <div>
          <FieldLabel>Deposit liquidity</FieldLabel>
          <div className="flex gap-2 items-center">
            <Input value={refill} onChange={e => setRefill(e.target.value)} placeholder={`Reserv. is ${reservoir.toFixed(2)} ${token.symbol}`} className="font-mono text-xs h-9 bg-card/60" />
            <button type="button" onClick={async () => {
              try {
                const erc = new Contract(token.address, ERC20_ABI, signer);
                const bal: bigint = await erc.balanceOf(account);
                setRefill(formatUnits(bal, token.decimals));
              } catch {}
            }} className="h-9 px-2 rounded-lg border border-border bg-card/50 text-[10px] font-bold hover:border-cyan-400/60">Max</button>
            <ActionBtn busy={busy === "refill"} onClick={doRefill} color="emerald"><Coins className="w-3 h-3" /> Refill</ActionBtn>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Auto-checks balance, approves & transfers tokens into the faucet pool.</div>
        </div>
        {/* Withdraw */}
        <div className="md:col-span-2">
          <FieldLabel>Admin withdraw</FieldLabel>
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <Input value={wTo} onChange={e => setWTo(e.target.value)} placeholder="Recipient 0x…" className="font-mono text-xs h-9 bg-card/60" />
            <div className="flex gap-2">
              <Input value={wAmt} onChange={e => setWAmt(e.target.value)} placeholder={`Max ${reservoir.toFixed(2)}`} className="font-mono text-xs h-9 bg-card/60 sm:w-44" />
              <ActionBtn busy={busy === "withdraw"} onClick={doWithdraw} color="rose"><Send className="w-3 h-3" /> Withdraw</ActionBtn>
            </div>
          </div>
        </div>
        {/* User reset */}
        <div className="md:col-span-2">
          <FieldLabel>Reset user claim count</FieldLabel>
          <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
            <Input value={user} onChange={e => setUser(e.target.value)} placeholder="User 0x…" className="font-mono text-xs h-9 bg-card/60" />
            <Input value={userCount} onChange={e => setUserCount(e.target.value.replace(/[^\d]/g, ""))} className="font-mono text-xs h-9 bg-card/60 sm:w-28" />
            <ActionBtn busy={busy === "user"} onClick={doSetUser} color="violet">Reset to {userCount}</ActionBtn>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Set this user's claim counter back to 0 for this token (lets them claim again after hitting max).</div>
        </div>
      </div>
    </div>
  );
};

const ActionBtn = ({ busy, onClick, children, color = "violet" }: any) => {
  const grad: Record<string, string> = {
    violet: "from-violet-500 to-fuchsia-600",
    amber: "from-amber-500 to-orange-600",
    emerald: "from-emerald-500 to-cyan-600",
    rose: "from-rose-500 to-red-600",
  };
  return (
    <button onClick={onClick} disabled={busy} className={`h-9 px-3 rounded-lg bg-gradient-to-r ${grad[color]} text-white font-bold text-xs disabled:opacity-50 inline-flex items-center gap-1`}>
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : children}
    </button>
  );
};

export default AdminFaucet;
