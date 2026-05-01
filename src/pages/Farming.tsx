import { useCallback, useEffect, useMemo, useState } from "react";
import { Contract, formatUnits, parseUnits } from "ethers";
import { toast } from "sonner";
import {
  Sprout, Loader2, RefreshCw, TrendingUp, Coins, Zap, Lock, Unlock,
  AlertTriangle, ShieldCheck, Settings, ExternalLink, Wallet, Search, Gift,
} from "lucide-react";
import { useWeb3 } from "@/lib/web3";
import { CONTRACTS, explorerAddr } from "@/lib/chain";
import { ERC20_ABI, FARM_ABI } from "@/lib/abis";
import { getFarm, readAllPools, readTokenMeta, FarmPool, computePendingLocal } from "@/lib/farm";
import { subscribeFarmEvents, refetchPoolForUser } from "@/lib/farmEvents";
import { sendTx } from "@/lib/tx";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { FarmHistory } from "@/components/FarmHistory";
import { validateAmount } from "@/lib/validate";

const Farming = () => {
  const { isReady, account, signer, readProvider } = useWeb3();
  const [pools, setPools] = useState<FarmPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"all" | "staked">("all");
  const [activePid, setActivePid] = useState<number | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const isOwner = !!(owner && account && owner.toLowerCase() === account.toLowerCase());

  const farmRead = useMemo(() => getFarm(readProvider), [readProvider]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const own = await farmRead.owner().catch(() => null);
      if (own) setOwner(own);
      const raws = await readAllPools(farmRead);
      const enriched: FarmPool[] = await Promise.all(raws.map(async (r, pid) => {
        const [s, rew, rewardReserve] = await Promise.all([
          readTokenMeta(r.stakingToken, readProvider),
          readTokenMeta(r.rewardToken, readProvider),
          new Contract(r.rewardToken, ERC20_ABI, readProvider).balanceOf(CONTRACTS.FARM).catch(() => 0n),
        ]);
        let pending: bigint | undefined;
        let userStaked: bigint | undefined;
        let userRewardDebt: bigint | undefined;
        let userAllowance: bigint | undefined;
        let userBalance: bigint | undefined;
        if (account) {
          try {
            const [pend, ui, allow, bal] = await Promise.all([
              farmRead.pendingReward(pid, account),
              farmRead.userInfo(pid, account),
              new Contract(r.stakingToken, ERC20_ABI, readProvider).allowance(account, CONTRACTS.FARM),
              new Contract(r.stakingToken, ERC20_ABI, readProvider).balanceOf(account),
            ]);
            pending = pend;
            userStaked = ui.amount ?? ui[0];
            userRewardDebt = ui.rewardDebt ?? ui[1];
            userAllowance = allow; userBalance = bal;
          } catch {}
        }
        return {
          pid, ...r,
          stakingSymbol: s.symbol, stakingDecimals: s.decimals,
          rewardSymbol: rew.symbol, rewardDecimals: rew.decimals,
          rewardReserve,
          pending, userStaked, userRewardDebt, userAllowance, userBalance,
        };
      }));
      setPools(enriched);
    } catch (e: any) {
      toast.error("Failed to load farms", { description: e?.message ?? String(e) });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [farmRead, readProvider, account]);

  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => { load(); }, [load]);
  // Slow safety-net polling
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);
  // Real-time refresh via on-chain events. We do a targeted per-pool refetch
  // when the connected user's address is involved (cheap), and a soft full
  // refresh for any other user's activity (so totals stay accurate).
  useEffect(() => {
    const off = subscribeFarmEvents(readProvider, async (kind, pid, evUser) => {
      const isMine = !!(account && evUser.toLowerCase() === account.toLowerCase());
      if (isMine) {
        try {
          const slim = await refetchPoolForUser(readProvider, pid, account!);
          setPools(prev => prev.map(p => p.pid === pid ? {
            ...p,
            accRewardPerShare: slim.accRewardPerShare,
            lastRewardBlock:   slim.lastRewardBlock,
            rewardPerBlock:    slim.rewardPerBlock,
            totalStaked:       slim.totalStaked,
            userStaked:        slim.userStaked,
            userRewardDebt:    slim.userRewardDebt,
            pending:           slim.pending,
          } : p));
        } catch { load(); }
        setHistoryKey(k => k + 1);
        // After Withdraw/EmergencyWithdraw the staking-token balance & allowance
        // changed in the user's wallet — kick a full reload to refresh those.
        if (kind === "Withdraw" || kind === "EmergencyWithdraw" || kind === "Deposit") {
          load();
        }
      } else {
        // Someone else moved liquidity in this pool: totalStaked changed → soft reload.
        load();
      }
    });
    return off;
  }, [readProvider, load, account]);

  // Live block ticker — drives a smooth pendingReward counter on each card.
  const [currentBlock, setCurrentBlock] = useState<bigint>(0n);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const b = await readProvider.getBlockNumber();
        if (!cancelled) setCurrentBlock(BigInt(b));
      } catch {}
    };
    tick();
    const t = setInterval(tick, 4_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [readProvider]);

  // Search by symbol or address
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    let list = pools;
    if (tab === "staked") list = list.filter(p => (p.userStaked ?? 0n) > 0n || (p.pending ?? 0n) > 0n);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(p =>
        p.stakingSymbol.toLowerCase().includes(q) ||
        p.rewardSymbol.toLowerCase().includes(q) ||
        p.stakingToken.toLowerCase().includes(q) ||
        p.rewardToken.toLowerCase().includes(q),
      );
    }
    return list;
  }, [pools, tab, query]);

  const totalStakedAcrossPools = pools.reduce((a, p) => a + Number(formatUnits(p.totalStaked, p.stakingDecimals)), 0);
  const myActivePools = pools.filter(p => (p.userStaked ?? 0n) > 0n).length;
  const myPendingTotal = pools.reduce((a, p) => a + Number(formatUnits(p.pending ?? 0n, p.rewardDecimals)), 0);

  const harvestablePids = pools.filter(p => (p.pending ?? 0n) > 0n).map(p => p.pid);
  const [harvestingAll, setHarvestingAll] = useState(false);
  const harvestAll = async () => {
    if (!signer || !harvestablePids.length) return;
    setHarvestingAll(true);
    try {
      const c = new Contract(CONTRACTS.FARM, FARM_ABI, signer);
      for (const pid of harvestablePids) {
        try {
          await sendTx(`Harvest pool #${pid}`, () => c.deposit(pid, 0n));
        } catch { /* keep going to next pool */ }
      }
      load();
      setHistoryKey(k => k + 1);
    } finally { setHarvestingAll(false); }
  };

  if (!isReady) {
    return <FarmingFallback />;
  }

  return (
    <div className="max-w-7xl mx-auto animate-slide-up space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 via-card/60 to-transparent p-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/30 blur-[100px] animate-pulse" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-purple-500/20 blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
        </div>
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-[11px] font-bold uppercase tracking-wider text-primary mb-3">
              <Sprout className="w-3.5 h-3.5" /> EagleFarm · Yield
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              <span className="text-grad">Farm. Earn. Repeat.</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              Stake LP or single tokens to earn rewards every block. Powered by an audited
              MasterChef-style contract on Integralayer Testnet.
            </p>
            <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
              <span className="font-mono">Farm:</span>
              <a href={explorerAddr(CONTRACTS.FARM)} target="_blank" rel="noreferrer"
                 className="font-mono text-primary hover:underline flex items-center gap-1">
                {CONTRACTS.FARM.slice(0, 8)}…{CONTRACTS.FARM.slice(-6)} <ExternalLink className="w-3 h-3"/>
              </a>
            </div>
          </div>
          {/* 3D-ish floating coin badge */}
          <div className="relative shrink-0 hidden md:block" style={{ perspective: "1000px" }}>
            <div
              className="w-32 h-32 rounded-full btn-primary-grad grid place-items-center shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.7)]"
              style={{ transform: "rotateX(15deg) rotateY(-15deg)", transformStyle: "preserve-3d" }}
            >
              <div className="absolute inset-2 rounded-full border border-white/20" />
              <Sprout className="w-14 h-14 text-primary-foreground drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]" />
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-3 rounded-full bg-primary/40 blur-md" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 relative">
          <HeroStat icon={Coins} label="Active Pools" value={String(pools.length)} />
          <HeroStat icon={Lock}  label="Total Staked" value={totalStakedAcrossPools.toLocaleString(undefined,{maximumFractionDigits:2})} />
          <HeroStat icon={Wallet} label="My Positions" value={String(myActivePools)} />
          <HeroStat icon={Zap} label="Pending Rewards" value={myPendingTotal.toLocaleString(undefined,{maximumFractionDigits:4})} accent />
        </div>
      </div>

      {/* Toolbar */}
      <div className="glass rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 text-xs">
          {(["all","staked"] as const).map(k => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-lg font-semibold capitalize ${tab===k ? "btn-primary-grad text-primary-foreground" : "bg-card border border-border hover:border-primary/40"}`}>
              {k === "all" ? "All Farms" : "My Stakes"}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"/>
          <Input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search symbol or 0x…"
            className="h-9 pl-9 text-xs bg-card border-border"/>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {harvestablePids.length > 0 && (
            <button onClick={harvestAll} disabled={harvestingAll}
              className="px-3 py-2 rounded-lg btn-primary-grad text-primary-foreground text-xs font-bold flex items-center gap-1.5 disabled:opacity-60">
              {harvestingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Gift className="w-3.5 h-3.5"/>}
              Harvest all ({harvestablePids.length})
            </button>
          )}
          <button onClick={load} disabled={refreshing}
            className="px-3 py-2 rounded-lg bg-card border border-border hover:border-primary text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}/> Refresh
          </button>
          {isOwner && (
            <Link to="/admin"
              className="px-3 py-2 rounded-lg btn-primary-grad text-primary-foreground text-xs font-bold flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5"/> Admin
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary"/></div>
      ) : !visible.length ? (
        <div className="rounded-3xl p-10 text-center bg-gradient-to-br from-primary/15 via-card to-transparent border border-primary/20">
          <div className="w-16 h-16 mx-auto rounded-2xl btn-primary-grad grid place-items-center mb-4">
            <Sprout className="w-7 h-7 text-primary-foreground"/>
          </div>
          <h3 className="text-2xl font-extrabold tracking-tight mb-1">
            {query ? "No matches" : tab === "staked" ? "No active stakes yet" : "No farms yet"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {query
              ? "Try a different symbol or address."
              : tab === "staked"
                ? "Stake into a pool to start earning rewards every block."
                : "The contract owner hasn't added any pools yet. Check back soon."}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map(p => (
            <FarmCard key={p.pid} pool={p} currentBlock={currentBlock}
              onAction={() => setActivePid(p.pid)} onChanged={load} />
          ))}
        </div>
      )}

      <FarmHistory pools={pools} refreshKey={historyKey} />

      {activePid !== null && (
        <FarmActionDialog
          pool={pools.find(p => p.pid === activePid)!}
          onClose={() => setActivePid(null)}
          onChanged={() => { load(); setHistoryKey(k => k + 1); }}
        />
      )}
    </div>
  );
};

const FarmingFallback = () => (
  <div className="max-w-7xl mx-auto animate-slide-up space-y-6">
    <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 via-card/60 to-transparent p-8 min-h-[320px] grid place-items-center text-center">
      <div className="absolute inset-0 pointer-events-none bg-primary/5" />
      <div className="relative max-w-md">
        <div className="w-16 h-16 mx-auto rounded-2xl btn-primary-grad grid place-items-center mb-4">
          <Loader2 className="w-7 h-7 text-primary-foreground animate-spin" />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-grad">Loading Farming</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Menyiapkan provider RPC dan status wallet agar data pool bisa dimuat dengan aman.
        </p>
      </div>
    </div>
  </div>
);

const HeroStat = ({ icon: Icon, label, value, accent }: any) => (
  <div className={`rounded-xl p-3 backdrop-blur-md border ${accent ? "bg-primary/15 border-primary/40" : "bg-card/60 border-border/60"}`}>
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <Icon className={`w-3.5 h-3.5 ${accent ? "text-primary" : "text-muted-foreground"}`}/>
    </div>
    <div className={`font-extrabold text-lg ${accent ? "text-grad" : ""}`}>{value}</div>
  </div>
);

const FarmCard = ({ pool, currentBlock, onAction, onChanged }: {
  pool: FarmPool; currentBlock: bigint; onAction: () => void; onChanged: () => void;
}) => {
  const { account, signer } = useWeb3();
  const total = Number(formatUnits(pool.totalStaked, pool.stakingDecimals));
  const rpb = Number(formatUnits(pool.rewardPerBlock, pool.rewardDecimals));
  const myStake = Number(formatUnits(pool.userStaked ?? 0n, pool.stakingDecimals));

  // Live ticker: recompute pending locally as new blocks come in.
  const livePendingWei = useMemo(
    () => (currentBlock > 0n ? computePendingLocal(pool, currentBlock) : (pool.pending ?? 0n)),
    [pool, currentBlock],
  );
  const pending = Number(formatUnits(livePendingWei, pool.rewardDecimals));

  // Reward liquidity: how much reward token the contract can pay out right now.
  const reserve = Number(formatUnits(pool.rewardReserve ?? 0n, pool.rewardDecimals));
  const lowReserve = (pool.rewardReserve ?? 0n) > 0n
    ? livePendingWei > (pool.rewardReserve ?? 0n)
    : (pool.rewardReserve === 0n);

  // rough APR using ~2s blocks → ~15.7M blocks/year. Treats 1 stake = 1 reward unit.
  const BLOCKS_PER_YEAR = 15_768_000;
  const apr = total > 0 ? (rpb * BLOCKS_PER_YEAR / total) * 100 : 0;

  const harvest = async () => {
    if (!signer) return toast.error("Connect wallet");
    if (lowReserve) {
      toast.error("Insufficient reward liquidity", {
        description: `Farm contract holds only ${reserve} ${pool.rewardSymbol}. Ask admin to top up.`,
      });
      return;
    }
    const c = new Contract(CONTRACTS.FARM, FARM_ABI, signer);
    await sendTx(`Harvest ${pool.rewardSymbol}`, () => c.deposit(pool.pid, 0n));
    onChanged();
  };

  return (
    <div className="group relative glass rounded-2xl p-5 transition-all hover:-translate-y-1 hover:border-primary/60 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/10 blur-3xl group-hover:bg-primary/20 transition-colors" />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl btn-primary-grad grid place-items-center shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.6)]"
              style={{ transform: "rotateY(-15deg)", transformStyle: "preserve-3d" }}
            >
              <Sprout className="w-6 h-6 text-primary-foreground"/>
            </div>
            <div>
              <div className="font-extrabold text-lg leading-none flex items-center gap-2">
                {pool.stakingSymbol}
                <span className="text-[10px] font-mono text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">#{pool.pid}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Stake → earn {pool.rewardSymbol}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">APR</div>
            <div className="font-extrabold text-grad text-lg">{Number.isFinite(apr) ? apr.toFixed(1) : "0.0"}%</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl bg-secondary/40 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3"/> Total Staked</div>
            <div className="font-bold text-sm font-mono">{total.toLocaleString(undefined,{maximumFractionDigits:4})}</div>
          </div>
          <div className="rounded-xl bg-secondary/40 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3"/> Rwd / Block</div>
            <div className="font-bold text-sm font-mono">{rpb.toLocaleString(undefined,{maximumFractionDigits:6})}</div>
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Your stake</span>
            <span className="font-mono font-bold">{myStake.toLocaleString(undefined,{maximumFractionDigits:6})} {pool.stakingSymbol}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-muted-foreground">Pending</span>
            <span className="font-mono font-bold text-grad tabular-nums">
              {pending.toLocaleString(undefined,{maximumFractionDigits:8})} {pool.rewardSymbol}
            </span>
          </div>
          <div className="flex justify-between text-[10px] mt-1 text-muted-foreground">
            <span>Reward reserve</span>
            <span className={`font-mono ${lowReserve ? "text-red-400" : ""}`}>
              {reserve.toLocaleString(undefined,{maximumFractionDigits:4})} {pool.rewardSymbol}
            </span>
          </div>
        </div>

        {lowReserve && pool.userStaked && pool.userStaked > 0n && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 mb-2 flex items-center gap-1.5 text-[11px] text-red-300">
            <AlertTriangle className="w-3 h-3 shrink-0"/>
            Low reward liquidity — harvest may revert.
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onAction}
            disabled={!account}
            className="py-2.5 rounded-xl btn-primary-grad text-primary-foreground font-bold text-xs disabled:opacity-50">
            {myStake > 0 ? "Manage" : "Stake"}
          </button>
          <button onClick={harvest}
            disabled={!account || livePendingWei <= 0n}
            title={`Harvest only pool #${pool.pid} (${pool.stakingSymbol} → ${pool.rewardSymbol})`}
            className="py-2.5 rounded-xl bg-card border border-border hover:border-primary text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Gift className="w-3.5 h-3.5"/> Harvest #{pool.pid}
          </button>
        </div>

        <a href={explorerAddr(pool.stakingToken)} target="_blank" rel="noreferrer"
           className="block text-[10px] text-muted-foreground hover:text-primary mt-2 font-mono truncate">
          stake: {pool.stakingToken}
        </a>
      </div>
    </div>
  );
};

const FarmActionDialog = ({ pool, onClose, onChanged }: { pool: FarmPool; onClose: () => void; onChanged: () => void }) => {
  const { signer, account } = useWeb3();
  const [mode, setMode] = useState<"stake" | "unstake">("stake");
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);

  const myStake = pool.userStaked ?? 0n;
  const myBalance = pool.userBalance ?? 0n;
  const allow = pool.userAllowance ?? 0n;

  const max = mode === "stake" ? myBalance : myStake;
  const maxLabel = mode === "stake" ? `${pool.stakingSymbol} balance` : `staked ${pool.stakingSymbol}`;

  // Strict validation: decimals, positivity, max, NaN/Infinity, scientific notation.
  const validation = useMemo(
    () => validateAmount(amt, pool.stakingDecimals, { symbol: maxLabel, max }),
    [amt, pool.stakingDecimals, maxLabel, max],
  );
  const parsed = validation.value ?? 0n;
  const inputError = amt.trim() !== "" && !validation.ok ? validation.error : undefined;

  const needApprove = mode === "stake" && parsed > 0n && allow < parsed;

  const submit = async () => {
    if (!signer || !account) return;
    if (!validation.ok) return toast.error(validation.error ?? "Invalid amount");
    setBusy(true);
    try {
      const c = new Contract(CONTRACTS.FARM, FARM_ABI, signer);
      if (mode === "stake") {
        if (needApprove) {
          const erc = new Contract(pool.stakingToken, ERC20_ABI, signer);
          await sendTx(`Approve ${pool.stakingSymbol}`, () => erc.approve(CONTRACTS.FARM, (1n << 255n)));
        }
        await sendTx(`Stake ${pool.stakingSymbol}`, () => c.deposit(pool.pid, parsed));
      } else {
        await sendTx(`Unstake ${pool.stakingSymbol}`, () => c.withdraw(pool.pid, parsed));
      }
      onChanged();
      onClose();
    } catch {} finally { setBusy(false); }
  };
  const emergency = async () => {
    if (!signer) return;
    if (!confirm("Emergency withdraw forfeits pending rewards. Continue?")) return;
    setBusy(true);
    try {
      const c = new Contract(CONTRACTS.FARM, FARM_ABI, signer);
      await sendTx(`Emergency withdraw ${pool.stakingSymbol}`, () => c.emergencyWithdraw(pool.pid));
      onChanged();
      onClose();
    } catch {} finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="glass rounded-3xl p-6 w-full max-w-md border border-primary/30" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl btn-primary-grad grid place-items-center"><Sprout className="w-5 h-5 text-primary-foreground"/></div>
          <div>
            <div className="font-extrabold text-lg">{pool.stakingSymbol} Farm</div>
            <div className="text-[11px] text-muted-foreground">Earn {pool.rewardSymbol}</div>
          </div>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-secondary/40 mb-4">
          {(["stake","unstake"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`py-2 rounded-lg text-xs font-bold capitalize ${mode===m ? "btn-primary-grad text-primary-foreground" : "text-muted-foreground"}`}>
              {m === "stake" ? <span className="flex items-center justify-center gap-1"><Lock className="w-3.5 h-3.5"/> Stake</span> : <span className="flex items-center justify-center gap-1"><Unlock className="w-3.5 h-3.5"/> Unstake</span>}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-3 mb-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] text-muted-foreground">{mode === "stake" ? "Wallet balance" : "Your stake"}</span>
            <button onClick={() => setAmt(formatUnits(max, pool.stakingDecimals))}
              className="text-[11px] font-mono text-primary hover:underline">
              MAX: {Number(formatUnits(max, pool.stakingDecimals)).toLocaleString(undefined,{maximumFractionDigits:6})}
            </button>
          </div>
          <Input value={amt}
            inputMode="decimal"
            onChange={e => setAmt(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0.0"
            className={`text-2xl h-14 font-bold bg-transparent border-0 focus-visible:ring-0 px-0 ${inputError ? "text-red-400" : ""}`} />
          <div className="text-[11px] text-muted-foreground">{pool.stakingSymbol}</div>
        </div>

        {inputError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 mb-3 flex items-start gap-2 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>
            <span>{inputError}</span>
          </div>
        )}

        {needApprove && !inputError && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-2.5 mb-3 flex items-start gap-2 text-xs">
            <ShieldCheck className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5"/>
            <span>One-time approval will be requested before staking.</span>
          </div>
        )}

        <button onClick={submit} disabled={busy || !validation.ok}
          className="w-full h-12 rounded-xl btn-primary-grad text-primary-foreground font-bold disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : (needApprove ? `Approve & ${mode}` : (mode === "stake" ? "Stake" : "Unstake"))}
        </button>

        {mode === "unstake" && myStake > 0n && (
          <button onClick={emergency} disabled={busy}
            className="w-full mt-2 h-10 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
            <AlertTriangle className="w-3.5 h-3.5"/> Emergency withdraw (forfeits rewards)
          </button>
        )}
      </div>
    </div>
  );
};

export default Farming;