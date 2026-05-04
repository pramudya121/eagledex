import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Contract, ZeroAddress, formatUnits } from "ethers";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles, AlertTriangle, Plus, Coins, Settings2, Rocket } from "lucide-react";
import { toast } from "sonner";
import TokenSelect from "@/components/TokenSelect";
import { Input } from "@/components/ui/input";
import { useWeb3 } from "@/lib/web3";
import { NATIVE_TOKEN, TOKENS, TokenInfo, CONTRACTS, explorerAddr } from "@/lib/chain";
import { ERC20_ABI, ROUTER_ABI } from "@/lib/abis";
import { deadlineMin, getTokenBalance, isNative, parse, wrap } from "@/lib/dex";
import { sendTx } from "@/lib/tx";
import { poolIndex } from "@/lib/poolIndex";

type Step = 1 | 2 | 3;

const CreatePool = () => {
  const navigate = useNavigate();
  const { account, signer, readProvider, factory, isCorrectChain } = useWeb3();
  const [step, setStep] = useState<Step>(1);

  const [a, setA] = useState<TokenInfo>(NATIVE_TOKEN);
  const [b, setB] = useState<TokenInfo>(TOKENS.find(t => t.symbol === "EGDX")!);
  const [aAmt, setAAmt] = useState("");
  const [bAmt, setBAmt] = useState("");
  const [balA, setBalA] = useState("0");
  const [balB, setBalB] = useState("0");
  const [pairAddr, setPairAddr] = useState<string>(ZeroAddress);
  const [hasReserves, setHasReserves] = useState(false);
  const [allowA, setAllowA] = useState<bigint>(0n);
  const [allowB, setAllowB] = useState<bigint>(0n);
  const [busy, setBusy] = useState(false);
  const [createdPair, setCreatedPair] = useState<string | null>(null);

  // pair lookup + reserves check
  useEffect(() => { (async () => {
    try {
      const p = await factory.getPair(wrap(a), wrap(b));
      setPairAddr(p);
      if (p !== ZeroAddress) {
        const c = new Contract(p, ["function getReserves() view returns (uint112,uint112,uint32)"], readProvider);
        const [r0, r1] = await c.getReserves();
        setHasReserves(r0 > 0n || r1 > 0n);
      } else setHasReserves(false);
    } catch {}
  })(); }, [a, b, factory, readProvider, busy]);

  // balances
  useEffect(() => { if (!account) return;
    (async () => {
      const [ba, bb] = await Promise.all([
        getTokenBalance(readProvider, a, account),
        getTokenBalance(readProvider, b, account),
      ]);
      setBalA(formatUnits(ba, a.decimals)); setBalB(formatUnits(bb, b.decimals));
    })().catch(() => {});
  }, [account, a, b, readProvider, busy]);

  // allowances
  useEffect(() => {
    if (!account) { setAllowA(0n); setAllowB(0n); return; }
    (async () => {
      const fetchAllow = async (t: TokenInfo): Promise<bigint> => {
        if (isNative(t)) return (1n << 255n);
        const c = new Contract(t.address, ERC20_ABI, readProvider);
        return await c.allowance(account, CONTRACTS.ROUTER);
      };
      const [la, lb] = await Promise.all([fetchAllow(a), fetchAllow(b)]);
      setAllowA(la); setAllowB(lb);
    })().catch(() => {});
  }, [a, b, account, readProvider, busy]);

  const aIn = useMemo(() => parse(aAmt, a.decimals), [aAmt, a.decimals]);
  const bIn = useMemo(() => parse(bAmt, b.decimals), [bAmt, b.decimals]);
  const needApproveA = !isNative(a) && aIn > 0n && allowA < aIn;
  const needApproveB = !isNative(b) && bIn > 0n && allowB < bIn;
  const sameToken = wrap(a).toLowerCase() === wrap(b).toLowerCase();
  const initialPrice = aIn > 0n && bIn > 0n
    ? Number(formatUnits(bIn, b.decimals)) / Number(formatUnits(aIn, a.decimals))
    : 0;

  // sqrt for liquidity sanity
  const sqrtBig = (n: bigint) => { if (n < 2n) return n; let x = n, y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + n / x) / 2n; } return x; };
  const liqOk = aIn > 0n && bIn > 0n && sqrtBig(aIn * bIn) > 1000n;

  // ---- Step 1 validators
  const step1Ok = !sameToken;
  // ---- Step 2 validators
  const balAOk = aIn > 0n && aIn <= parse(balA, a.decimals);
  const balBOk = bIn > 0n && bIn <= parse(balB, b.decimals);
  const step2Ok = step1Ok && balAOk && balBOk && liqOk;

  const onApprove = async (t: TokenInfo) => {
    if (!signer || isNative(t)) return;
    setBusy(true);
    try {
      const erc = new Contract(t.address, ERC20_ABI, signer);
      await sendTx(`Approve ${t.symbol}`, () => erc.approve(CONTRACTS.ROUTER, (1n << 255n)));
    } catch {} finally { setBusy(false); }
  };

  const onDeploy = async () => {
    if (!signer || !account || !isCorrectChain) return toast.error("Connect to Integralayer");
    if (!step2Ok) return toast.error("Check token amounts");
    if (needApproveA || needApproveB) return toast.error("Approve tokens first");

    setBusy(true);
    try {
      const dl = deadlineMin(20);
      const r = new Contract(CONTRACTS.ROUTER, ROUTER_ABI, signer);
      // Initial mint: min == desired (no existing reserves to slip against)
      const aMin = aIn, bMin = bIn;
      if (isNative(a) || isNative(b)) {
        const tokenT = isNative(a) ? b : a;
        const tokenAmt = isNative(a) ? bIn : aIn;
        const tokenMin = isNative(a) ? bMin : aMin;
        const ethAmt = isNative(a) ? aIn : bIn;
        const ethMin = isNative(a) ? aMin : bMin;
        await sendTx("Create pool & add liquidity", () =>
          r.addLiquidityETH(tokenT.address, tokenAmt, tokenMin, ethMin, account, dl, { value: ethAmt }));
      } else {
        await sendTx("Create pool & add liquidity", () =>
          r.addLiquidity(a.address, b.address, aIn, bIn, aMin, bMin, account, dl));
      }
      // Get the freshly deployed pair
      const fresh = await factory.getPair(wrap(a), wrap(b));
      setCreatedPair(fresh);
      if (fresh !== ZeroAddress) poolIndex.refreshPair(fresh);
      poolIndex.refresh();
      toast.success("Pool created!", { description: `${a.symbol}/${b.symbol} is now live.` });
      setStep(3);
    } catch {} finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center justify-center gap-2">
          <Rocket className="w-7 h-7 text-primary" /> Create <span className="text-grad">New Pool</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Deploy a brand-new trading pair on EAGLEDEX</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-xl grid place-items-center font-bold text-sm transition-all ${
              step === n ? "btn-primary-grad text-primary-foreground shadow-[0_8px_20px_-8px_hsl(var(--primary))]"
              : step > n ? "bg-green-500/20 text-green-400 border border-green-500/40"
              : "bg-card border border-border text-muted-foreground"
            }`}>
              {step > n ? <CheckCircle2 className="w-5 h-5"/> : n}
            </div>
            {n < 3 && <div className={`w-12 h-0.5 ${step > n ? "bg-green-500/50" : "bg-border"}`}/>}
          </div>
        ))}
      </div>

      {/* STEP 1 — Pick tokens */}
      {step === 1 && (
        <div className="form-surface p-6 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-primary"/>
            <h2 className="text-lg font-bold">Step 1 · Pick token pair</h2>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl bg-card border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Token A</div>
              <TokenSelect value={a} onChange={setA} exclude={b.address}/>
            </div>
            <div className="flex justify-center -my-1.5"><div className="w-8 h-8 rounded-xl btn-primary-grad grid place-items-center text-primary-foreground"><Plus className="w-4 h-4"/></div></div>
            <div className="rounded-xl bg-card border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Token B</div>
              <TokenSelect value={b} onChange={setB} exclude={a.address}/>
            </div>
          </div>

          {sameToken && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">
              <AlertTriangle className="w-4 h-4"/> Token A and Token B must differ.
            </div>
          )}

          {pairAddr !== ZeroAddress && hasReserves && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-xs">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0"/>
              <div>
                <div className="font-bold">Pool already exists</div>
                <div className="text-yellow-200/80">A {a.symbol}/{b.symbol} pool with liquidity already exists at <span className="font-mono">{pairAddr.slice(0,10)}…{pairAddr.slice(-6)}</span>. Use <Link to="/liquidity" className="underline">Add Liquidity</Link> to deposit into it instead.</div>
              </div>
            </div>
          )}

          {pairAddr !== ZeroAddress && !hasReserves && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs">
              <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0"/>
              <div>Pair contract exists but has no liquidity yet. You'll seed the initial reserves on the next step.</div>
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <Link to="/pools" className="px-4 py-2.5 rounded-xl bg-card border border-border hover:border-primary text-sm font-semibold flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4"/> Cancel
            </Link>
            <button disabled={!step1Ok || (pairAddr !== ZeroAddress && hasReserves)} onClick={() => setStep(2)}
              className="px-5 py-2.5 rounded-xl btn-primary-grad text-primary-foreground font-bold text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
              Next <ArrowRight className="w-4 h-4"/>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — Set initial price */}
      {step === 2 && (
        <div className="form-surface p-6 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <Settings2 className="w-5 h-5 text-primary"/>
            <h2 className="text-lg font-bold">Step 2 · Set initial price & deposit</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            The ratio between Token A and Token B sets the <strong className="text-foreground">starting price</strong>. You're the first LP — pick wisely, arbitrageurs will correct any mispricing.
          </p>

          <AmountField token={a} amount={aAmt} setAmount={setAAmt} bal={balA} label="Amount of Token A"/>
          <AmountField token={b} amount={bAmt} setAmount={setBAmt} bal={balB} label="Amount of Token B"/>

          {initialPrice > 0 && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Initial price</div>
              <div className="font-mono">1 {a.symbol} = <span className="text-primary font-bold">{initialPrice.toLocaleString(undefined,{maximumFractionDigits:8})}</span> {b.symbol}</div>
              <div className="font-mono">1 {b.symbol} = <span className="text-primary font-bold">{(1/initialPrice).toLocaleString(undefined,{maximumFractionDigits:8})}</span> {a.symbol}</div>
            </div>
          )}

          {!liqOk && aIn > 0n && bIn > 0n && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">
              <AlertTriangle className="w-4 h-4"/> Liquidity too small — sqrt(A × B) must exceed 1000 wei (V2 burns 1000 LP on first mint).
            </div>
          )}

          {/* Approvals */}
          {(needApproveA || needApproveB) && step2Ok && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Approvals required</div>
              {needApproveA && (
                <button onClick={() => onApprove(a)} disabled={busy}
                  className="w-full py-2.5 rounded-xl bg-card border border-primary/40 hover:border-primary text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>} Approve {a.symbol}
                </button>
              )}
              {needApproveB && (
                <button onClick={() => onApprove(b)} disabled={busy}
                  className="w-full py-2.5 rounded-xl bg-card border border-primary/40 hover:border-primary text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>} Approve {b.symbol}
                </button>
              )}
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-xl bg-card border border-border hover:border-primary text-sm font-semibold flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4"/> Back
            </button>
            <button onClick={onDeploy} disabled={!step2Ok || needApproveA || needApproveB || busy || !account}
              className="px-5 py-2.5 rounded-xl btn-primary-grad text-primary-foreground font-bold text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin"/> Deploying…</> : <><Rocket className="w-4 h-4"/> Deploy Pool</>}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Success */}
      {step === 3 && (
        <div className="form-surface p-8 text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/20 grid place-items-center">
            <CheckCircle2 className="w-8 h-8 text-green-400"/>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold">Pool live on EAGLEDEX 🎉</h2>
            <p className="text-sm text-muted-foreground mt-1">{a.symbol}/{b.symbol} pair has been deployed and seeded with liquidity.</p>
          </div>
          {createdPair && createdPair !== ZeroAddress && (
            <div className="rounded-xl bg-card border border-border p-3 text-xs space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pair contract</div>
              <a href={explorerAddr(createdPair)} target="_blank" rel="noreferrer"
                className="font-mono text-primary hover:underline break-all">{createdPair}</a>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button onClick={() => navigate("/pools")} className="px-4 py-3 rounded-xl bg-card border border-border hover:border-primary text-sm font-bold">
              View all pools
            </button>
            <button onClick={() => { setStep(1); setAAmt(""); setBAmt(""); setCreatedPair(null); }}
              className="px-4 py-3 rounded-xl btn-primary-grad text-primary-foreground font-bold text-sm">
              Create another
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const AmountField = ({ token, amount, setAmount, bal, label }: {
  token: TokenInfo; amount: string; setAmount: (s: string) => void; bal: string; label: string;
}) => (
  <div className="rounded-xl bg-card border border-border p-3">
    <div className="flex items-center justify-between mb-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <button onClick={() => setAmount(bal)} className="text-[10px] text-primary hover:underline">
        Bal: {Number(bal).toLocaleString(undefined,{maximumFractionDigits:6})} {token.symbol} · MAX
      </button>
    </div>
    <div className="flex items-center gap-2">
      <Input inputMode="decimal" placeholder="0.0" value={amount}
        onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
        className="border-0 bg-transparent text-2xl font-bold tabular-nums focus-visible:ring-0 px-0 h-auto"/>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary border border-border">
        {token.logo && <img src={token.logo} className="w-5 h-5 rounded-full object-cover"/>}
        <span className="font-bold text-sm">{token.symbol}</span>
      </div>
    </div>
  </div>
);

export default CreatePool;
