import { useCallback, useEffect, useMemo, useState } from "react";
import { Contract, formatUnits, parseUnits, isAddress } from "ethers";
import { toast } from "sonner";
import { Shield, Loader2, Plus, Edit3, RefreshCw, Crown, AlertTriangle, ExternalLink } from "lucide-react";
import { useWeb3 } from "@/lib/web3";
import { CONTRACTS, explorerAddr } from "@/lib/chain";
import { FARM_ABI } from "@/lib/abis";
import { getFarm, readAllPools, readTokenMeta, FarmPool } from "@/lib/farm";
import { sendTx } from "@/lib/tx";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const Admin = () => {
  const { account, signer, readProvider } = useWeb3();
  const [owner, setOwner] = useState<string | null>(null);
  const [pools, setPools] = useState<FarmPool[]>([]);
  const [loading, setLoading] = useState(true);

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
        <p className="text-sm text-muted-foreground">
          Only the contract owner can access this panel.
        </p>
        <div className="mt-3 text-[11px] font-mono text-muted-foreground">
          Owner: {owner ? <a className="text-primary hover:underline" href={explorerAddr(owner)} target="_blank" rel="noreferrer">{owner.slice(0,8)}…{owner.slice(-6)}</a> : "unknown"}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-slide-up space-y-6">
      <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 to-transparent p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl btn-primary-grad grid place-items-center">
            <Crown className="w-6 h-6 text-primary-foreground"/>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight"><span className="text-grad">Farm Admin</span></h1>
            <p className="text-xs text-muted-foreground">Manage pools, rewards & ownership</p>
          </div>
          <button onClick={load} className="ml-auto px-3 py-2 rounded-lg bg-card border border-border hover:border-primary text-xs font-semibold flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5"/> Refresh
          </button>
        </div>
      </div>

      <AddPoolCard signer={signer} onChanged={load} />

      <div className="glass rounded-2xl p-5">
        <h2 className="font-bold mb-3 flex items-center gap-2"><Edit3 className="w-4 h-4 text-primary"/> Existing pools ({pools.length})</h2>
        {!pools.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">No pools added yet.</p>
        ) : (
          <div className="space-y-3">
            {pools.map(p => <PoolAdminRow key={p.pid} pool={p} signer={signer} onChanged={load} />)}
          </div>
        )}
      </div>

      <MassUpdateCard signer={signer} pools={pools} onChanged={load} />
      <TransferOwnershipCard signer={signer} onChanged={load} />
    </div>
  );
};

const AddPoolCard = ({ signer, onChanged }: any) => {
  const [staking, setStaking] = useState("");
  const [reward, setReward] = useState("");
  const [rpb, setRpb] = useState("");
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
      setStaking(""); setReward(""); setRpb("");
      setConfirm(false);
      onChanged();
    } catch {} finally { setBusy(false); }
  };

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-bold mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-primary"/> Add a new pool</h2>
      <div className="grid md:grid-cols-3 gap-3">
        <Field label="Staking token (ERC-20)">
          <Input value={staking} onChange={e => setStaking(e.target.value)} placeholder="0x…" className="font-mono text-xs"/>
        </Field>
        <Field label="Reward token (ERC-20)">
          <Input value={reward} onChange={e => setReward(e.target.value)} placeholder="0x…" className="font-mono text-xs"/>
        </Field>
        <Field label="Reward per block (whole units, 18 decimals assumed)">
          <Input value={rpb} onChange={e => setRpb(e.target.value)} placeholder="0.1" className="font-mono text-xs"/>
        </Field>
      </div>
      <button onClick={() => { if (validate()) setConfirm(true); }} disabled={busy}
        className="mt-4 h-11 px-6 rounded-xl btn-primary-grad text-primary-foreground font-bold disabled:opacity-50 flex items-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>} Create pool
      </button>
      <p className="text-[11px] text-muted-foreground mt-2">
        Note: ensure the farm contract holds enough reward token for distributions.
      </p>

      <ConfirmDialog
        open={confirm}
        title="Create new farm pool?"
        description="This action is on-chain and cannot be undone. Verify the addresses below carefully."
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

const PoolAdminRow = ({ pool, signer, onChanged }: { pool: FarmPool; signer: any; onChanged: () => void }) => {
  const [rpb, setRpb] = useState(formatUnits(pool.rewardPerBlock, 18));
  const [busy, setBusy] = useState(false);
  const [confirmUpd, setConfirmUpd] = useState(false);

  const askUpdate = () => {
    if (!signer) return toast.error("Connect wallet");
    try {
      const v = parseUnits(rpb || "0", 18);
      if (v < 0n) throw new Error();
    } catch { return toast.error("Invalid value"); }
    setConfirmUpd(true);
  };

  const update = async () => {
    setBusy(true);
    try {
      const v = parseUnits(rpb || "0", 18);
      const c = new Contract(CONTRACTS.FARM, FARM_ABI, signer);
      await sendTx(`Update pool #${pool.pid} reward`, () => c.updateRewardPerBlock(pool.pid, v));
      setConfirmUpd(false);
      onChanged();
    } catch {} finally { setBusy(false); }
  };

  const sync = async () => {
    if (!signer) return;
    setBusy(true);
    try {
      const c = new Contract(CONTRACTS.FARM, FARM_ABI, signer);
      await sendTx(`Sync pool #${pool.pid}`, () => c.updatePool(pool.pid));
      onChanged();
    } catch {} finally { setBusy(false); }
  };

  const currentRpb = formatUnits(pool.rewardPerBlock, 18);

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg btn-primary-grad grid place-items-center text-xs font-extrabold text-primary-foreground">#{pool.pid}</div>
        <div className="font-bold">{pool.stakingSymbol} → {pool.rewardSymbol}</div>
        <span className="text-[11px] text-muted-foreground font-mono">
          total: {Number(formatUnits(pool.totalStaked, pool.stakingDecimals)).toLocaleString(undefined,{maximumFractionDigits:4})}
        </span>
        <a href={explorerAddr(pool.stakingToken)} target="_blank" rel="noreferrer"
           className="ml-auto text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1">
          stake <ExternalLink className="w-3 h-3"/>
        </a>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Reward per block">
          <Input value={rpb} onChange={e => setRpb(e.target.value)} className="font-mono text-xs h-9"/>
        </Field>
        <button onClick={askUpdate} disabled={busy}
          className="h-9 px-4 rounded-lg btn-primary-grad text-primary-foreground text-xs font-bold disabled:opacity-50">
          Update
        </button>
        <button onClick={sync} disabled={busy}
          className="h-9 px-4 rounded-lg bg-card border border-border hover:border-primary text-xs font-semibold disabled:opacity-50">
          Sync pool
        </button>
      </div>

      <ConfirmDialog
        open={confirmUpd}
        title={`Update reward rate for pool #${pool.pid}?`}
        description="This changes emissions for all stakers in this pool."
        confirmLabel="Yes, update rate"
        busy={busy}
        onCancel={() => setConfirmUpd(false)}
        onConfirm={update}
        details={
          <>
            <div><span className="text-muted-foreground">Pool:</span> {pool.stakingSymbol} → {pool.rewardSymbol}</div>
            <div><span className="text-muted-foreground">Current:</span> {currentRpb}</div>
            <div><span className="text-muted-foreground">New:</span> {rpb}</div>
          </>
        }
      />
    </div>
  );
};

const MassUpdateCard = ({ signer, pools, onChanged }: any) => {
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
    <div className="glass rounded-2xl p-5 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[200px]">
        <h3 className="font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4 text-primary"/> Mass update all pools</h3>
        <p className="text-xs text-muted-foreground">Recomputes accRewardPerShare for all {pools.length} pools.</p>
      </div>
      <button onClick={run} disabled={busy || !pools.length}
        className="h-11 px-5 rounded-xl btn-primary-grad text-primary-foreground font-bold disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : "Run massUpdatePools()"}
      </button>
    </div>
  );
};

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
        <Field label="New owner address">
          <Input value={addr} onChange={e => setAddr(e.target.value)} placeholder="0x…" className="font-mono text-xs h-10"/>
        </Field>
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

const Field = ({ label, children }: any) => (
  <label className="block flex-1 min-w-[180px]">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
    {children}
  </label>
);

export default Admin;