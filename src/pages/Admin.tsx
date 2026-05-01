import { useCallback, useEffect, useMemo, useState } from "react";
import { Contract, formatUnits, parseUnits, isAddress } from "ethers";
import { toast } from "sonner";
import {
  Shield, Loader2, Plus, Edit3, RefreshCw, Settings, AlertTriangle,
  ExternalLink, Zap, X, Pencil,
} from "lucide-react";
import { useWeb3 } from "@/lib/web3";
import { CONTRACTS, explorerAddr, TOKENS, TokenInfo } from "@/lib/chain";
import { FARM_ABI } from "@/lib/abis";
import { getFarm, readAllPools, readTokenMeta, FarmPool } from "@/lib/farm";
import { sendTx } from "@/lib/tx";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Tab = "add" | "edit" | "mass";

const Admin = () => {
  const { account, signer, readProvider } = useWeb3();
  const [owner, setOwner] = useState<string | null>(null);
  const [pools, setPools] = useState<FarmPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("add");

  const farmRead = useMemo(() => getFarm(readProvider), [readProvider]);
  const isOwner = !!(owner && account && owner.toLowerCase() === account.toLowerCase());

  const load = useCallback(async () => {
    try {
      const own = await farmRead.owner().catch(() => null);
      setOwner(own);
      const raws = await readAllPools(farmRead);
      const enriched: FarmPool[] = await Promise.all(raws.map(async (r, pid) => {
        const [s, rew] = await Promise.all([
          readTokenMeta(r.stakingToken, readProvider),
          readTokenMeta(r.rewardToken, readProvider),
        ]);
        return { pid, ...r,
          stakingSymbol: s.symbol, stakingDecimals: s.decimals,
          rewardSymbol: rew.symbol, rewardDecimals: rew.decimals };
      }));
      setPools(enriched);
    } finally { setLoading(false); }
  }, [farmRead, readProvider]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary"/></div>;

  if (!account) {
    return (
      <div className="max-w-xl mx-auto glass rounded-3xl p-10 text-center">
        <Shield className="w-10 h-10 mx-auto text-muted-foreground mb-3"/>
        <h2 className="text-2xl font-extrabold mb-1">Admin Panel</h2>
        <p className="text-sm text-muted-foreground">Connect your wallet to verify ownership.</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="max-w-xl mx-auto glass rounded-3xl p-10 text-center border border-red-500/30 bg-gradient-to-br from-red-500/10 to-transparent">
        <AlertTriangle className="w-10 h-10 mx-auto text-red-400 mb-3"/>
        <h2 className="text-2xl font-extrabold mb-1">Access denied</h2>
        <p className="text-sm text-muted-foreground">Only the contract owner can access this panel.</p>
        <div className="mt-3 text-[11px] font-mono text-muted-foreground">
          Owner: {owner ? <a className="text-primary hover:underline" href={explorerAddr(owner)} target="_blank" rel="noreferrer">{owner.slice(0,8)}…{owner.slice(-6)}</a> : "unknown"}
        </div>
      </div>
    );
  }

  const totalStakedAll = pools.reduce((acc, p) => acc + Number(formatUnits(p.totalStaked, p.stakingDecimals)), 0);

  return (
    <div className="max-w-3xl mx-auto animate-slide-up space-y-5">
      {/* Pool summary header */}
      <div className="glass rounded-3xl p-6 border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-transparent to-violet-600/10">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 grid place-items-center shadow-[0_8px_24px_-8px_hsl(280_85%_60%/0.6)]">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-fuchsia-400 to-orange-300 bg-clip-text text-transparent">Farming Admin</span>
            </h1>
            <p className="text-xs text-muted-foreground">Owner-only controls · {pools.length} pool{pools.length === 1 ? "" : "s"}</p>
          </div>
          <button onClick={load} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-card transition" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatBox label="Pools" value={String(pools.length)} />
          <StatBox label="Total staked" value={totalStakedAll.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <StatBox label="Owner" value={owner ? `${owner.slice(0,6)}…${owner.slice(-4)}` : "—"} mono />
        </div>

        {/* Pool summary grid */}
        {pools.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Pool overview</div>
            <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {pools.map(p => (
                <div key={p.pid} className="rounded-xl border border-border/60 bg-card/50 p-3 hover:border-primary/50 transition">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-gradient-to-r from-fuchsia-500/30 to-violet-600/30 border border-fuchsia-400/40 text-fuchsia-100">#{p.pid}</span>
                    <span className="font-bold text-sm truncate">{p.stakingSymbol} → {p.rewardSymbol}</span>
                    <a href={explorerAddr(p.stakingToken)} target="_blank" rel="noreferrer" className="ml-auto text-muted-foreground hover:text-primary"><ExternalLink className="w-3 h-3"/></a>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                    <div><span className="text-muted-foreground">staked:</span> {Number(formatUnits(p.totalStaked, p.stakingDecimals)).toLocaleString(undefined, { maximumFractionDigits: 3 })}</div>
                    <div><span className="text-muted-foreground">rpb:</span> {Number(formatUnits(p.rewardPerBlock, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs card */}
      <div className="glass rounded-3xl p-6 border border-primary/30 shadow-[0_30px_80px_-30px_hsl(var(--primary)/0.5)]">
        <div className="grid grid-cols-3 gap-2 mb-5">
          <TabBtn active={tab === "add"} onClick={() => setTab("add")} icon={<Plus className="w-4 h-4"/>} label="Add Pool" gradient />
          <TabBtn active={tab === "edit"} onClick={() => setTab("edit")} icon={<Pencil className="w-4 h-4"/>} label="Edit Pool" />
          <TabBtn active={tab === "mass"} onClick={() => setTab("mass")} icon={<Zap className="w-4 h-4"/>} label="Mass Update" />
        </div>

        {tab === "add" && <AddPoolTab signer={signer} onChanged={load} />}
        {tab === "edit" && <EditPoolTab signer={signer} pools={pools} onChanged={load} />}
        {tab === "mass" && <MassUpdateTab signer={signer} pools={pools} onChanged={load} />}
      </div>

      {/* Danger zone */}
      <TransferOwnershipCard signer={signer} onChanged={load} />
    </div>
  );
};

const StatBox = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="rounded-xl border border-border/60 bg-card/40 p-2.5">
    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">{label}</div>
    <div className={`text-sm font-extrabold mt-0.5 truncate ${mono ? "font-mono" : ""}`}>{value}</div>
  </div>
);

const TabBtn = ({ active, onClick, icon, label, gradient }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; gradient?: boolean }) => (
  <button
    onClick={onClick}
    className={`h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition border ${
      active
        ? gradient
          ? "bg-gradient-to-r from-fuchsia-500/30 to-violet-600/30 border-fuchsia-400/50 text-fuchsia-200"
          : "bg-card border-primary/50 text-foreground"
        : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
    }`}
  >
    {icon} <span className="hidden sm:inline">{label}</span><span className="sm:hidden">{label.split(" ")[0]}</span>
  </button>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2">{children}</div>
);

const TokenChips = ({ onPick }: { onPick: (t: TokenInfo) => void }) => (
  <div className="flex flex-wrap gap-1.5 mt-2">
    {TOKENS.filter(t => !t.isNative).map(t => (
      <button
        key={t.address}
        type="button"
        onClick={() => onPick(t)}
        className="px-2.5 py-1 rounded-full bg-card border border-border hover:border-primary text-[11px] font-semibold transition"
      >
        {t.symbol}
      </button>
    ))}
  </div>
);

/* ============== ADD POOL TAB ============== */
const AddPoolTab = ({ signer, onChanged }: any) => {
  const [staking, setStaking] = useState("");
  const [reward, setReward] = useState("");
  const [rpb, setRpb] = useState("0.01");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const validate = () => {
    if (!signer) { toast.error("Connect wallet"); return false; }
    if (!isAddress(staking)) { toast.error("Invalid staking token address"); return false; }
    if (!isAddress(reward)) { toast.error("Invalid reward token address"); return false; }
    try {
      const v = parseUnits(rpb || "0", 18);
      if (v <= 0n) { toast.error("rewardPerBlock must be > 0"); return false; }
    } catch { toast.error("Invalid rewardPerBlock"); return false; }
    return true;
  };

  const submit = async () => {
    setBusy(true);
    try {
      const rpbWei = parseUnits(rpb, 18);
      const c = new Contract(CONTRACTS.FARM, FARM_ABI, signer);
      await sendTx("Add farm pool", () => c.addPool(staking, reward, rpbWei));
      setStaking(""); setReward(""); setRpb("0.01");
      setConfirm(false);
      onChanged();
    } catch {} finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Staking token address</FieldLabel>
        <Input value={staking} onChange={e => setStaking(e.target.value)} placeholder="0x…" className="font-mono text-xs h-11 bg-card/60" />
        <TokenChips onPick={t => setStaking(t.address)} />
      </div>

      <div>
        <FieldLabel>Reward token address</FieldLabel>
        <Input value={reward} onChange={e => setReward(e.target.value)} placeholder="0x…" className="font-mono text-xs h-11 bg-card/60" />
        <TokenChips onPick={t => setReward(t.address)} />
      </div>

      <div>
        <FieldLabel>Reward per block (in reward-token units)</FieldLabel>
        <Input value={rpb} onChange={e => setRpb(e.target.value)} placeholder="0.01" className="font-mono text-xs h-11 bg-card/60" />
      </div>

      <button
        onClick={() => { if (validate()) setConfirm(true); }}
        disabled={busy}
        className="w-full h-12 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_10px_30px_-10px_hsl(280_85%_60%/0.6)]"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>} Add Pool
      </button>

      <ConfirmDialog
        open={confirm}
        title="Create new farm pool?"
        description="This action is on-chain and cannot be undone."
        confirmLabel="Yes, create pool"
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={submit}
        details={
          <>
            <div><span className="text-muted-foreground">Staking:</span> <span className="break-all">{staking}</span></div>
            <div><span className="text-muted-foreground">Reward:</span> <span className="break-all">{reward}</span></div>
            <div><span className="text-muted-foreground">Reward / block:</span> {rpb}</div>
          </>
        }
      />
    </div>
  );
};

/* ============== EDIT POOL TAB ============== */
const EditPoolTab = ({ signer, pools, onChanged }: { signer: any; pools: FarmPool[]; onChanged: () => void }) => {
  const [pid, setPid] = useState<number | null>(pools[0]?.pid ?? null);
  const selected = pools.find(p => p.pid === pid) ?? null;
  const [rpb, setRpb] = useState(selected ? formatUnits(selected.rewardPerBlock, 18) : "");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (selected) setRpb(formatUnits(selected.rewardPerBlock, 18));
  }, [selected]);

  if (!pools.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No pools yet. Create one in the Add Pool tab.</p>;
  }

  const ask = () => {
    if (!signer) return toast.error("Connect wallet");
    if (pid == null) return toast.error("Select a pool");
    try { parseUnits(rpb || "0", 18); } catch { return toast.error("Invalid value"); }
    setConfirm(true);
  };

  const update = async () => {
    if (pid == null) return;
    setBusy(true);
    try {
      const v = parseUnits(rpb || "0", 18);
      const c = new Contract(CONTRACTS.FARM, FARM_ABI, signer);
      await sendTx(`Update pool #${pid} reward`, () => c.updateRewardPerBlock(pid, v));
      setConfirm(false);
      onChanged();
    } catch {} finally { setBusy(false); }
  };

  const sync = async () => {
    if (!signer || pid == null) return;
    setBusy(true);
    try {
      const c = new Contract(CONTRACTS.FARM, FARM_ABI, signer);
      await sendTx(`Sync pool #${pid}`, () => c.updatePool(pid));
      onChanged();
    } catch {} finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Select pool</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {pools.map(p => (
            <button
              key={p.pid}
              onClick={() => setPid(p.pid)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                pid === p.pid
                  ? "bg-gradient-to-r from-fuchsia-500/30 to-violet-600/30 border-fuchsia-400/60 text-fuchsia-100"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              #{p.pid} {p.stakingSymbol}→{p.rewardSymbol}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <>
          <div className="rounded-xl border border-border/60 bg-card/40 p-3 text-xs space-y-1 font-mono">
            <div><span className="text-muted-foreground">Staking:</span> <a className="text-primary hover:underline break-all" href={explorerAddr(selected.stakingToken)} target="_blank" rel="noreferrer">{selected.stakingToken}</a></div>
            <div><span className="text-muted-foreground">Reward:</span> <a className="text-primary hover:underline break-all" href={explorerAddr(selected.rewardToken)} target="_blank" rel="noreferrer">{selected.rewardToken}</a></div>
            <div><span className="text-muted-foreground">Total staked:</span> {Number(formatUnits(selected.totalStaked, selected.stakingDecimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })} {selected.stakingSymbol}</div>
          </div>

          <div>
            <FieldLabel>Reward per block</FieldLabel>
            <Input value={rpb} onChange={e => setRpb(e.target.value)} className="font-mono text-xs h-11 bg-card/60" />
          </div>

          <div className="flex gap-2">
            <button onClick={ask} disabled={busy}
              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Edit3 className="w-4 h-4"/>} Update Rate
            </button>
            <button onClick={sync} disabled={busy}
              className="h-12 px-5 rounded-xl bg-card border border-border hover:border-primary text-xs font-semibold disabled:opacity-50">
              Sync
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirm}
        title={`Update reward rate for pool #${pid}?`}
        description="This changes emissions for all stakers in this pool."
        confirmLabel="Yes, update"
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={update}
        details={
          selected ? (
            <>
              <div><span className="text-muted-foreground">Pool:</span> {selected.stakingSymbol} → {selected.rewardSymbol}</div>
              <div><span className="text-muted-foreground">Current:</span> {formatUnits(selected.rewardPerBlock, 18)}</div>
              <div><span className="text-muted-foreground">New:</span> {rpb}</div>
            </>
          ) : null
        }
      />
    </div>
  );
};

/* ============== MASS UPDATE TAB ============== */
const MassUpdateTab = ({ signer, pools, onChanged }: any) => {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!signer) return;
    setBusy(true);
    try {
      const c = new Contract(CONTRACTS.FARM, FARM_ABI, signer);
      await sendTx("Mass update pools", () => c.massUpdatePools());
      onChanged();
    } catch {} finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-500/15 border border-yellow-500/30 grid place-items-center">
            <Zap className="w-4 h-4 text-yellow-400"/>
          </div>
          <div className="text-xs leading-relaxed">
            <div className="font-bold text-foreground mb-1">massUpdatePools()</div>
            <p className="text-muted-foreground">
              Recomputes <code className="text-primary">accRewardPerShare</code> for all <b>{pools.length}</b> pools in a single transaction. Useful before changing emissions or pausing rewards.
            </p>
          </div>
        </div>
      </div>
      <button onClick={run} disabled={busy || !pools.length}
        className="w-full h-12 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4"/>} Run Mass Update
      </button>
    </div>
  );
};

/* ============== TRANSFER OWNERSHIP ============== */
const TransferOwnershipCard = ({ signer, onChanged }: any) => {
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);

  const ask = () => {
    if (!signer) return toast.error("Connect wallet");
    if (!isAddress(addr)) return toast.error("Invalid address");
    setAck(false);
    setOpen(true);
  };

  const run = async () => {
    if (!ack) return toast.error("Please confirm you understand the risk");
    setBusy(true);
    try {
      const c = new Contract(CONTRACTS.FARM, FARM_ABI, signer);
      await sendTx("Transfer ownership", () => c.transferOwnership(addr));
      setOpen(false);
      onChanged();
    } catch {} finally { setBusy(false); }
  };

  return (
    <div className="glass rounded-2xl p-5 border border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
      <h3 className="font-bold flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-red-400"/> Danger zone — transfer ownership</h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 min-w-[180px]">
          <FieldLabel>New owner address</FieldLabel>
          <Input value={addr} onChange={e => setAddr(e.target.value)} placeholder="0x…" className="font-mono text-xs h-10"/>
        </label>
        <button onClick={ask} disabled={busy}
          className="h-10 px-5 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 font-bold text-xs disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : "Transfer"}
        </button>
      </div>

      <ConfirmDialog
        open={open}
        danger
        title="Transfer contract ownership?"
        description="This is IRREVERSIBLE. You will lose all admin powers over the farm contract."
        confirmLabel="Transfer ownership"
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={run}
        details={
          <>
            <div><span className="text-muted-foreground">New owner:</span> <span className="break-all">{addr}</span></div>
            <label className="flex items-start gap-2 mt-3 cursor-pointer text-foreground font-sans">
              <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="mt-0.5"/>
              <span className="text-xs">I understand this action cannot be undone and I will permanently lose admin access.</span>
            </label>
          </>
        }
      />
    </div>
  );
};

export default Admin;
