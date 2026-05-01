import { useCallback, useEffect, useMemo, useState } from "react";
import { Contract, formatUnits, parseUnits, isAddress } from "ethers";
import { toast } from "sonner";
import {
  Shield, Loader2, AlertTriangle, RefreshCw, Droplet, Settings, Plus, Edit3,
  Send, Clock, ExternalLink, Hash, User, Coins,
} from "lucide-react";
import { useWeb3 } from "@/lib/web3";
import { CONTRACTS, explorerAddr } from "@/lib/chain";
import { FAUCET_ABI, ERC20_ABI } from "@/lib/abis";
import { getFaucet, readFaucetTokens, FaucetTokenInfo } from "@/lib/faucet";
import { sendTx } from "@/lib/tx";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Tab = "tokens" | "limits" | "refill" | "withdraw" | "users" | "cooldown";

const AdminFaucet = () => {
  const { account, signer, readProvider } = useWeb3();
  const [owner, setOwner] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<bigint>(0n);
  const [tokens, setTokens] = useState<FaucetTokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("tokens");

  const faucetRead = useMemo(() => getFaucet(readProvider), [readProvider]);
  const isOwner = !!(owner && account && owner.toLowerCase() === account.toLowerCase());

  const load = useCallback(async () => {
    try {
      const [own, cd, list] = await Promise.all([
        faucetRead.owner().catch(() => null),
        faucetRead.cooldown().catch(() => 0n),
        readFaucetTokens(faucetRead, readProvider, account),
      ]);
      setOwner(own); setCooldown(cd); setTokens(list);
    } finally { setLoading(false); }
  }, [faucetRead, readProvider, account]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-400"/></div>;

  if (!account) return (
    <div className="max-w-xl mx-auto glass rounded-3xl p-10 text-center">
      <Shield className="w-10 h-10 mx-auto text-muted-foreground mb-3"/>
      <h2 className="text-2xl font-extrabold mb-1">Faucet Admin</h2>
      <p className="text-sm text-muted-foreground">Connect your wallet to verify ownership.</p>
    </div>
  );

  if (!isOwner) return (
    <div className="max-w-xl mx-auto glass rounded-3xl p-10 text-center border border-red-500/30 bg-gradient-to-br from-red-500/10 to-transparent">
      <AlertTriangle className="w-10 h-10 mx-auto text-red-400 mb-3"/>
      <h2 className="text-2xl font-extrabold mb-1">Access denied</h2>
      <p className="text-sm text-muted-foreground">Only the contract owner can access this panel.</p>
      <div className="mt-3 text-[11px] font-mono text-muted-foreground">
        Owner: {owner ? <a className="text-cyan-300 hover:underline" href={explorerAddr(owner)} target="_blank" rel="noreferrer">{owner.slice(0,8)}…{owner.slice(-6)}</a> : "unknown"}
      </div>
    </div>
  );

  const totalReservoir = tokens.reduce((a, t) => a + Number(formatUnits(t.faucetBalance, t.decimals)), 0);

  return (
    <div className="max-w-4xl mx-auto animate-slide-up space-y-5">
      {/* Header */}
      <div className="glass rounded-3xl p-6 border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 via-transparent to-fuchsia-500/10">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 grid place-items-center shadow-[0_8px_24px_-8px_hsl(195_90%_55%/0.6)]">
            <Droplet className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">Faucet Admin</span>
            </h1>
            <p className="text-xs text-muted-foreground">Owner controls · {tokens.length} token slot{tokens.length === 1 ? "" : "s"} · cooldown {Number(cooldown)}s</p>
          </div>
          <button onClick={load} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-card transition" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat label="Token slots" value={String(tokens.length)} />
          <Stat label="Total reservoir" value={totalReservoir.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <Stat label="Cooldown" value={`${Number(cooldown)}s`} />
        </div>

        {/* Token overview */}
        {tokens.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
            {tokens.map(t => (
              <div key={t.index} className="rounded-xl border border-border/60 bg-card/50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-gradient-to-r from-cyan-500/30 to-fuchsia-500/30 border border-cyan-400/40 text-cyan-100">#{t.index}</span>
                  <span className="font-bold text-sm truncate">{t.symbol}</span>
                  <a href={explorerAddr(t.address)} target="_blank" rel="noreferrer" className="ml-auto text-muted-foreground hover:text-cyan-300"><ExternalLink className="w-3 h-3"/></a>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                  <div><span className="text-muted-foreground">amt:</span> {Number(formatUnits(t.claimAmount, t.decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  <div><span className="text-muted-foreground">max:</span> {String(t.maxClaims)}</div>
                  <div><span className="text-muted-foreground">bal:</span> {Number(formatUnits(t.faucetBalance, t.decimals)).toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="glass rounded-3xl p-6 border border-cyan-400/30">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
          <TabBtn active={tab === "tokens"} onClick={() => setTab("tokens")} icon={<Plus className="w-4 h-4"/>} label="Token" />
          <TabBtn active={tab === "limits"} onClick={() => setTab("limits")} icon={<Edit3 className="w-4 h-4"/>} label="Limits" />
          <TabBtn active={tab === "refill"} onClick={() => setTab("refill")} icon={<Coins className="w-4 h-4"/>} label="Refill" />
          <TabBtn active={tab === "withdraw"} onClick={() => setTab("withdraw")} icon={<Send className="w-4 h-4"/>} label="Withdraw" />
          <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={<User className="w-4 h-4"/>} label="Users" />
          <TabBtn active={tab === "cooldown"} onClick={() => setTab("cooldown")} icon={<Clock className="w-4 h-4"/>} label="CD" />
        </div>

        {tab === "tokens" && <SetTokenTab signer={signer} onChanged={load} />}
        {tab === "limits" && <LimitsTab signer={signer} tokens={tokens} onChanged={load} />}
        {tab === "refill" && <RefillTab signer={signer} tokens={tokens} onChanged={load} account={account} />}
        {tab === "withdraw" && <WithdrawTab signer={signer} tokens={tokens} onChanged={load} />}
        {tab === "users" && <UsersTab signer={signer} tokens={tokens} onChanged={load} />}
        {tab === "cooldown" && <CooldownTab signer={signer} current={cooldown} onChanged={load} />}
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border/60 bg-card/40 p-2.5">
    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">{label}</div>
    <div className="text-sm font-extrabold mt-0.5 truncate">{value}</div>
  </div>
);

const TabBtn = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button onClick={onClick} className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border ${
    active ? "bg-gradient-to-r from-cyan-500/30 to-fuchsia-500/30 border-cyan-400/50 text-cyan-100" : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground"
  }`}>{icon}<span className="hidden sm:inline">{label}</span></button>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2">{children}</div>
);

const PoolPicker = ({ tokens, value, onChange }: { tokens: FaucetTokenInfo[]; value: number | null; onChange: (i: number) => void }) => (
  <div className="flex flex-wrap gap-1.5">
    {tokens.map(t => (
      <button key={t.index} onClick={() => onChange(t.index)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
        value === t.index ? "bg-gradient-to-r from-cyan-500/30 to-fuchsia-500/30 border-cyan-400/60 text-cyan-100" : "bg-card border-border text-muted-foreground hover:text-foreground"
      }`}>#{t.index} {t.symbol}</button>
    ))}
  </div>
);

/* ========== SET TOKEN ========== */
const SetTokenTab = ({ signer, onChanged }: any) => {
  const [idx, setIdx] = useState("0");
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
      await sendTx(`Set token #${idx}`, () => c.setToken(Number(idx), addr));
      setAddr(""); setConfirm(false); onChanged();
    } catch {} finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Token index (uint8)</FieldLabel>
        <Input value={idx} onChange={e => setIdx(e.target.value)} placeholder="0" className="font-mono h-11 bg-card/60" />
      </div>
      <div>
        <FieldLabel>Token address</FieldLabel>
        <Input value={addr} onChange={e => setAddr(e.target.value)} placeholder="0x…" className="font-mono text-xs h-11 bg-card/60" />
      </div>
      <button
        onClick={() => {
          if (!signer) return toast.error("Connect wallet");
          if (!isAddress(addr)) return toast.error("Invalid address");
          setConfirm(true);
        }}
        disabled={busy}
        className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>} Set Token Slot
      </button>
      <ConfirmDialog open={confirm} title={`Set token slot #${idx}?`} description="Adds or replaces the token at this index." confirmLabel="Set" busy={busy} onCancel={() => setConfirm(false)} onConfirm={submit}
        details={<><div><span className="text-muted-foreground">Index:</span> {idx}</div><div><span className="text-muted-foreground">Address:</span> <span className="break-all">{addr}</span></div></>}/>
    </div>
  );
};

/* ========== LIMITS (claimAmount + maxClaims) ========== */
const LimitsTab = ({ signer, tokens, onChanged }: any) => {
  const [pid, setPid] = useState<number | null>(tokens[0]?.index ?? null);
  const sel = tokens.find((t: FaucetTokenInfo) => t.index === pid) ?? null;
  const [amt, setAmt] = useState("");
  const [maxC, setMaxC] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (sel) { setAmt(formatUnits(sel.claimAmount, sel.decimals)); setMaxC(String(sel.maxClaims)); } }, [sel]);

  const updateAmount = async () => {
    if (!sel) return; setBusy(true);
    try {
      const v = parseUnits(amt || "0", sel.decimals);
      const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
      await sendTx(`Set claimAmount #${sel.index}`, () => c.setClaimAmount(sel.index, v));
      onChanged();
    } catch {} finally { setBusy(false); }
  };
  const updateMax = async () => {
    if (!sel) return; setBusy(true);
    try {
      const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
      await sendTx(`Set maxClaims #${sel.index}`, () => c.setMaxClaims(sel.index, BigInt(maxC || "0")));
      onChanged();
    } catch {} finally { setBusy(false); }
  };

  if (!tokens.length) return <p className="text-sm text-muted-foreground text-center py-8">No tokens configured. Add one in the Token tab.</p>;
  return (
    <div className="space-y-4">
      <div><FieldLabel>Select token</FieldLabel><PoolPicker tokens={tokens} value={pid} onChange={setPid} /></div>
      {sel && (
        <>
          <div className="rounded-xl border border-border/60 bg-card/40 p-3 text-xs font-mono space-y-1">
            <div><span className="text-muted-foreground">Token:</span> {sel.symbol} ({sel.decimals} dec)</div>
            <div><span className="text-muted-foreground">Current amount:</span> {formatUnits(sel.claimAmount, sel.decimals)}</div>
            <div><span className="text-muted-foreground">Current max claims:</span> {String(sel.maxClaims)} {sel.maxClaims === 0n && "(unlimited)"}</div>
          </div>
          <div>
            <FieldLabel>Claim amount per call</FieldLabel>
            <div className="flex gap-2">
              <Input value={amt} onChange={e => setAmt(e.target.value)} className="font-mono text-xs h-11 bg-card/60" />
              <button onClick={updateAmount} disabled={busy} className="h-11 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white font-bold text-sm disabled:opacity-50">Save</button>
            </div>
          </div>
          <div>
            <FieldLabel>Max claims per user (0 = unlimited)</FieldLabel>
            <div className="flex gap-2">
              <Input value={maxC} onChange={e => setMaxC(e.target.value)} className="font-mono text-xs h-11 bg-card/60" />
              <button onClick={updateMax} disabled={busy} className="h-11 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white font-bold text-sm disabled:opacity-50">Save</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ========== REFILL ========== */
const RefillTab = ({ signer, tokens, onChanged, account }: any) => {
  const [pid, setPid] = useState<number | null>(tokens[0]?.index ?? null);
  const sel = tokens.find((t: FaucetTokenInfo) => t.index === pid) ?? null;
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);

  const refill = async () => {
    if (!sel) return; setBusy(true);
    try {
      const v = parseUnits(amt || "0", sel.decimals);
      const erc = new Contract(sel.address, ERC20_ABI, signer);
      const allowance: bigint = await erc.allowance(account, CONTRACTS.FAUCET);
      if (allowance < v) {
        await sendTx(`Approve ${sel.symbol}`, () => erc.approve(CONTRACTS.FAUCET, v));
      }
      const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
      await sendTx(`Refill #${sel.index}`, () => c.refill(sel.index, v));
      setAmt(""); onChanged();
    } catch {} finally { setBusy(false); }
  };

  if (!tokens.length) return <p className="text-sm text-muted-foreground text-center py-8">No tokens configured.</p>;
  return (
    <div className="space-y-4">
      <div><FieldLabel>Select token</FieldLabel><PoolPicker tokens={tokens} value={pid} onChange={setPid}/></div>
      {sel && (
        <>
          <div className="rounded-xl border border-border/60 bg-card/40 p-3 text-xs font-mono">
            <div><span className="text-muted-foreground">Faucet balance:</span> {formatUnits(sel.faucetBalance, sel.decimals)} {sel.symbol}</div>
          </div>
          <div>
            <FieldLabel>Amount to refill</FieldLabel>
            <Input value={amt} onChange={e => setAmt(e.target.value)} className="font-mono text-xs h-11 bg-card/60" placeholder="0.0" />
          </div>
          <button onClick={refill} disabled={busy} className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Coins className="w-4 h-4"/>} Approve & Refill
          </button>
        </>
      )}
    </div>
  );
};

/* ========== WITHDRAW ========== */
const WithdrawTab = ({ signer, tokens, onChanged }: any) => {
  const [pid, setPid] = useState<number | null>(tokens[0]?.index ?? null);
  const sel = tokens.find((t: FaucetTokenInfo) => t.index === pid) ?? null;
  const [amt, setAmt] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const submit = async () => {
    if (!sel) return; setBusy(true);
    try {
      const v = parseUnits(amt || "0", sel.decimals);
      const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
      await sendTx(`Admin withdraw ${sel.symbol}`, () => c.adminWithdraw(sel.index, v, to));
      setAmt(""); setConfirm(false); onChanged();
    } catch {} finally { setBusy(false); }
  };

  if (!tokens.length) return <p className="text-sm text-muted-foreground text-center py-8">No tokens configured.</p>;
  return (
    <div className="space-y-4">
      <div><FieldLabel>Select token</FieldLabel><PoolPicker tokens={tokens} value={pid} onChange={setPid}/></div>
      {sel && (
        <>
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5"/>
              <span className="text-muted-foreground">Pulls tokens out of the faucet contract. Make sure recipient is correct.</span>
            </div>
          </div>
          <div><FieldLabel>Amount</FieldLabel><Input value={amt} onChange={e => setAmt(e.target.value)} className="font-mono text-xs h-11 bg-card/60" /></div>
          <div><FieldLabel>Recipient address</FieldLabel><Input value={to} onChange={e => setTo(e.target.value)} placeholder="0x…" className="font-mono text-xs h-11 bg-card/60" /></div>
          <button onClick={() => {
            if (!signer) return toast.error("Connect wallet");
            if (!isAddress(to)) return toast.error("Invalid recipient");
            setConfirm(true);
          }} disabled={busy} className="w-full h-12 rounded-xl bg-gradient-to-r from-yellow-500 to-red-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>} Withdraw
          </button>
          <ConfirmDialog open={confirm} title={`Withdraw ${sel.symbol}?`} description="This sends tokens out of the faucet." confirmLabel="Withdraw" busy={busy} onCancel={() => setConfirm(false)} onConfirm={submit}
            details={<><div><span className="text-muted-foreground">Amount:</span> {amt} {sel.symbol}</div><div><span className="text-muted-foreground">To:</span> <span className="break-all">{to}</span></div></>}/>
        </>
      )}
    </div>
  );
};

/* ========== USERS (setUserClaimCount) ========== */
const UsersTab = ({ signer, tokens, onChanged }: any) => {
  const [pid, setPid] = useState<number | null>(tokens[0]?.index ?? null);
  const [user, setUser] = useState("");
  const [count, setCount] = useState("0");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pid == null) return;
    if (!isAddress(user)) return toast.error("Invalid user address");
    setBusy(true);
    try {
      const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
      await sendTx(`Set claim count for ${user.slice(0,8)}…`, () => c.setUserClaimCount(user, pid, BigInt(count || "0")));
      onChanged();
    } catch {} finally { setBusy(false); }
  };

  if (!tokens.length) return <p className="text-sm text-muted-foreground text-center py-8">No tokens configured.</p>;
  return (
    <div className="space-y-4">
      <div><FieldLabel>Select token</FieldLabel><PoolPicker tokens={tokens} value={pid} onChange={setPid}/></div>
      <div><FieldLabel>User address</FieldLabel><Input value={user} onChange={e => setUser(e.target.value)} placeholder="0x…" className="font-mono text-xs h-11 bg-card/60" /></div>
      <div><FieldLabel>New claim count</FieldLabel><Input value={count} onChange={e => setCount(e.target.value)} className="font-mono text-xs h-11 bg-card/60" /></div>
      <button onClick={submit} disabled={busy || !signer} className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Hash className="w-4 h-4"/>} Update Count
      </button>
    </div>
  );
};

/* ========== COOLDOWN ========== */
const CooldownTab = ({ signer, current, onChanged }: any) => {
  const [secs, setSecs] = useState(String(Number(current)));
  const [busy, setBusy] = useState(false);
  useEffect(() => setSecs(String(Number(current))), [current]);

  const submit = async () => {
    setBusy(true);
    try {
      const c = new Contract(CONTRACTS.FAUCET, FAUCET_ABI, signer);
      await sendTx(`Set cooldown ${secs}s`, () => c.setCooldown(BigInt(secs || "0")));
      onChanged();
    } catch {} finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card/40 p-3 text-xs font-mono">
        <span className="text-muted-foreground">Current global cooldown:</span> {Number(current)}s
      </div>
      <div><FieldLabel>New cooldown (seconds)</FieldLabel><Input value={secs} onChange={e => setSecs(e.target.value)} className="font-mono text-xs h-11 bg-card/60" /></div>
      <button onClick={submit} disabled={busy || !signer} className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Clock className="w-4 h-4"/>} Save Cooldown
      </button>
    </div>
  );
};

export default AdminFaucet;
