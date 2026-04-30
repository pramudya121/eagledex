import { useEffect, useMemo, useState } from "react";
import TokenSelect from "@/components/TokenSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWeb3 } from "@/lib/web3";
import { NATIVE_TOKEN, TOKENS, CONTRACTS, TokenInfo } from "@/lib/chain";
import { ERC20_ABI, PAIR_ABI, ROUTER_ABI } from "@/lib/abis";
import { Contract, formatUnits, ZeroAddress } from "ethers";
import { applySlippage, deadlineMin, getTokenBalance, isNative, parse, wrap } from "@/lib/dex";
import { sendTx } from "@/lib/tx";
import { validateAmount, validateSlippageBps, validateDeadlineMinutes } from "@/lib/validate";
import { poolIndex } from "@/lib/poolIndex";
import { Loader2, Plus, Minus, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { estimateContractCall, GasEstimate } from "@/lib/gas";
import TxPreflight from "@/components/TxPreflight";

const Liquidity = () => {
  const { account, signer, readProvider, factory, isCorrectChain } = useWeb3();

  // ADD
  const [a, setA] = useState<TokenInfo>(NATIVE_TOKEN);
  const [b, setB] = useState<TokenInfo>(TOKENS.find(t => t.symbol === "EGDX")!);
  const [aAmt, setAAmt] = useState(""); const [bAmt, setBAmt] = useState("");
  const [balA, setBalA] = useState("0"); const [balB, setBalB] = useState("0");
  const [pairAddr, setPairAddr] = useState<string>(ZeroAddress);
  const [busy, setBusy] = useState(false);
  const [allowA, setAllowA] = useState<bigint>(0n);
  const [allowB, setAllowB] = useState<bigint>(0n);
  const [reserves, setReserves] = useState<{ rA: bigint; rB: bigint; totalSupply: bigint; userLp: bigint } | null>(null);
  const [slippage, setSlippage] = useState(100); // 1% default
  const [deadlineM, setDeadlineM] = useState(20);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [gasEst, setGasEst] = useState<GasEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  // REMOVE
  const [rA, setRA] = useState<TokenInfo>(NATIVE_TOKEN);
  const [rB, setRB] = useState<TokenInfo>(TOKENS.find(t => t.symbol === "EGDX")!);
  const [lpBal, setLpBal] = useState<bigint>(0n);
  const [removePct, setRemovePct] = useState(50);
  const [rPair, setRPair] = useState<string>(ZeroAddress);



  // ---- ADD effects
  useEffect(() => { (async () => {
    const p = await factory.getPair(wrap(a), wrap(b));
    setPairAddr(p);
  })().catch(() => {}); }, [a, b, factory]);

  useEffect(() => { if (!account) return;
    (async () => {
      const [ba, bb] = await Promise.all([
        getTokenBalance(readProvider, a, account),
        getTokenBalance(readProvider, b, account),
      ]);
      setBalA(formatUnits(ba, a.decimals)); setBalB(formatUnits(bb, b.decimals));
    })().catch(() => {});
  }, [account, a, b, readProvider]);

  // fetch allowances + reserves whenever pair/account/tokens change
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

  useEffect(() => {
    if (pairAddr === ZeroAddress) { setReserves(null); return; }
    (async () => {
      try {
        const c = new Contract(pairAddr, PAIR_ABI, readProvider);
        const [r0, r1] = await c.getReserves();
        const t0 = (await c.token0()).toLowerCase();
        const wA = wrap(a).toLowerCase();
        const [rA, rB] = wA === t0 ? [r0, r1] : [r1, r0];
        const ts: bigint = await c.totalSupply();
        const ulp: bigint = account ? await c.balanceOf(account) : 0n;
        setReserves({ rA, rB, totalSupply: ts, userLp: ulp });
      } catch {}
    })();
  }, [pairAddr, a, b, readProvider, account, busy]);

  // auto compute b from a using reserves (constant product x*y=k)
  useEffect(() => {
    if (!reserves || !aAmt) return;
    const { rA, rB } = reserves;
    if (rA === 0n) return;
    const inA = parse(aAmt, a.decimals);
    const out = (inA * rB) / rA;
    setBAmt(formatUnits(out, b.decimals));
  }, [aAmt, reserves, a.decimals, b.decimals]);

  // ---- REMOVE effects
  const [rReserves, setRReserves] = useState<{ rA: bigint; rB: bigint; totalSupply: bigint } | null>(null);
  useEffect(() => { (async () => {
    const p = await factory.getPair(wrap(rA), wrap(rB));
    setRPair(p);
    if (p !== ZeroAddress) {
      const c = new Contract(p, PAIR_ABI, readProvider);
      const [r0, r1] = await c.getReserves();
      const t0 = (await c.token0()).toLowerCase();
      const wA = wrap(rA).toLowerCase();
      const [resA, resB] = wA === t0 ? [r0, r1] : [r1, r0];
      const ts: bigint = await c.totalSupply();
      setRReserves({ rA: resA, rB: resB, totalSupply: ts });
      setLpBal(account ? await c.balanceOf(account) : 0n);
    } else { setRReserves(null); setLpBal(0n); }
  })().catch(() => {}); }, [rA, rB, factory, account, readProvider, busy]);



  const aIn = useMemo(() => parse(aAmt, a.decimals), [aAmt, a.decimals]);
  const bIn = useMemo(() => parse(bAmt, b.decimals), [bAmt, b.decimals]);
  const needApproveA = !isNative(a) && aIn > 0n && allowA < aIn;
  const needApproveB = !isNative(b) && bIn > 0n && allowB < bIn;

  // Initial liquidity = pair doesn't exist yet OR pair exists but has zero reserves.
  // In Uniswap V2, calling addLiquidity on a non-existent pair auto-deploys it via the factory,
  // so users never need a separate "Create Pair" step.
  const isInitialLiquidityMode =
    pairAddr === ZeroAddress ||
    (reserves != null && reserves.totalSupply === 0n);

  // live validation
  useEffect(() => {
    if (!aAmt && !bAmt) { setValidationError(null); return; }
    if (aAmt) {
      const v = validateAmount(aAmt, a.decimals, { symbol: a.symbol });
      if (!v.ok) { setValidationError(v.error!); return; }
      const bal = parse(balA, a.decimals);
      if (v.value! > bal) { setValidationError(`Insufficient ${a.symbol} balance`); return; }
    }
    if (bAmt) {
      const v = validateAmount(bAmt, b.decimals, { symbol: b.symbol });
      if (!v.ok) { setValidationError(v.error!); return; }
      const bal = parse(balB, b.decimals);
      if (v.value! > bal) { setValidationError(`Insufficient ${b.symbol} balance`); return; }
    }
    const s = validateSlippageBps(slippage); if (!s.ok) { setValidationError(s.error!); return; }
    const d = validateDeadlineMinutes(deadlineM); if (!d.ok) { setValidationError(d.error!); return; }
    setValidationError(null);
  }, [aAmt, bAmt, a, b, balA, balB, slippage, deadlineM]);

  // Pre-flight gas estimation for Add Liquidity
  useEffect(() => {
    setGasEst(null);
    if (!signer || !account || !isCorrectChain) return;
    if (validationError || !aAmt || !bAmt) return;
    if (needApproveA || needApproveB) { setGasEst({ ok: true, warning: "Token approval required first — gas will be re-estimated after approve." } as any); return; }
    // pairAddr === ZeroAddress is fine — router will auto-create the pair.
    let cancelled = false;
    setEstimating(true);
    (async () => {
      try {
        const va = validateAmount(aAmt, a.decimals); const vb = validateAmount(bAmt, b.decimals);
        if (!va.ok || !vb.ok) return;
        let aMin: bigint, bMin: bigint;
        if (isInitialLiquidityMode) { aMin = va.value!; bMin = vb.value!; }
        else { aMin = applySlippage(va.value!, slippage); bMin = applySlippage(vb.value!, slippage); }
        const dl = deadlineMin(deadlineM);
        const r = new Contract(CONTRACTS.ROUTER, ROUTER_ABI, signer);
        let est: GasEstimate;
        if (isNative(a) || isNative(b)) {
          const tokenT = isNative(a) ? b : a;
          const tokenAmt = isNative(a) ? vb.value! : va.value!;
          const tokenMin = isNative(a) ? bMin : aMin;
          const ethAmt = isNative(a) ? va.value! : vb.value!;
          const ethMin = isNative(a) ? aMin : bMin;
          est = await estimateContractCall(signer, r, "addLiquidityETH",
            [tokenT.address, tokenAmt, tokenMin, ethMin, account, dl], { value: ethAmt });
        } else {
          est = await estimateContractCall(signer, r, "addLiquidity",
            [a.address, b.address, va.value!, vb.value!, aMin, bMin, account, dl]);
        }
        if (!cancelled) setGasEst(est);
      } catch (e: any) {
        if (!cancelled) setGasEst({ ok: false, revertReason: e?.shortMessage || e?.message || "Estimation failed" });
      } finally { if (!cancelled) setEstimating(false); }
    })();
    return () => { cancelled = true; };
  }, [signer, account, isCorrectChain, aAmt, bAmt, a, b, slippage, deadlineM, needApproveA, needApproveB, pairAddr, validationError, isInitialLiquidityMode]);

  // Soft warnings (deadline / slippage / initial-liquidity dust)
  const softWarnings = useMemo(() => {
    const ws: string[] = [];
    if (deadlineM <= 2) ws.push(`Deadline only ${deadlineM} min — tx may expire before confirmation. Consider 10–20 min.`);
    if (slippage >= 1000 && !isInitialLiquidityMode) ws.push(`Slippage tolerance is ${(slippage/100).toFixed(2)}% — very high.`);
    if (isInitialLiquidityMode && aIn > 0n && bIn > 0n) {
      const product = aIn * bIn;
      // crude check: anything below ~1e6 wei product will burn nearly all LP
      if (product < 1_000_000n) ws.push("Initial amounts are too small — V2 burns 1000 wei of LP on first mint, leaving you nothing.");
    }
    return ws;
  }, [deadlineM, slippage, isInitialLiquidityMode, aIn, bIn]);

  const onApprove = async (t: TokenInfo) => {
    if (!signer || isNative(t)) return;
    setBusy(true);
    try {
      const erc = new Contract(t.address, ERC20_ABI, signer);
      await sendTx(`Approve ${t.symbol}`, () => erc.approve(CONTRACTS.ROUTER, (1n << 255n)));
    } catch {} finally { setBusy(false); }
  };

  const onAdd = async () => {
    if (!signer || !account || !isCorrectChain) return toast.error("Connect to Integralayer");
    const va = validateAmount(aAmt, a.decimals, { symbol: a.symbol, max: parse(balA, a.decimals) });
    if (!va.ok) return toast.error(va.error!);
    const vb = validateAmount(bAmt, b.decimals, { symbol: b.symbol, max: parse(balB, b.decimals) });
    if (!vb.ok) return toast.error(vb.error!);
    const vs = validateSlippageBps(slippage); if (!vs.ok) return toast.error(vs.error!);
    const vd = validateDeadlineMinutes(deadlineM); if (!vd.ok) return toast.error(vd.error!);
    if (needApproveA || needApproveB) return toast.error("Please approve tokens first");

    // Initial liquidity: V2 router accepts amountAMin/amountBMin but for the FIRST mint
    // there are no reserves to compare against, so the router uses the raw desired amounts.
    // Setting min = desired is safe and protects against any pre-mining griefing.
    // Also: V2 burns 1000 wei MIN_LIQUIDITY on first mint, so sqrt(amountA*amountB) MUST exceed 1000.
    let aMin: bigint, bMin: bigint;
    if (isInitialLiquidityMode) {
      // Sanity: liquidity = sqrt(a*b). We need it > 1000 (10^3) wei.
      // Cheap bigint sqrt approximation:
      const product = va.value! * vb.value!;
      const sqrt = (n: bigint) => { if (n < 2n) return n; let x = n, y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + n / x) / 2n; } return x; };
      if (sqrt(product) <= 1000n) {
        return toast.error("Initial liquidity too small — sqrt(amountA × amountB) must exceed 1000 wei (V2 burns 1000 LP on first mint).");
      }
      aMin = va.value!;
      bMin = vb.value!;
    } else {
      aMin = applySlippage(va.value!, slippage);
      bMin = applySlippage(vb.value!, slippage);
    }
    const dl = deadlineMin(deadlineM);
    setBusy(true);
    try {
      const r = new Contract(CONTRACTS.ROUTER, ROUTER_ABI, signer);
      if (isNative(a) || isNative(b)) {
        const tokenT = isNative(a) ? b : a;
        const tokenAmt = isNative(a) ? vb.value! : va.value!;
        const tokenMin = isNative(a) ? bMin : aMin;
        const ethAmt = isNative(a) ? va.value! : vb.value!;
        const ethMin = isNative(a) ? aMin : bMin;
        await sendTx("Add liquidity", () =>
          r.addLiquidityETH(tokenT.address, tokenAmt, tokenMin, ethMin, account, dl, { value: ethAmt }));
      } else {
        await sendTx("Add liquidity", () =>
          r.addLiquidity(a.address, b.address, va.value!, vb.value!, aMin, bMin, account, dl));
      }
      setAAmt(""); setBAmt("");
      // Refresh pair address after first mint (router may have just deployed it),
      // then nudge the pool index.
      try {
        const fresh = await factory.getPair(wrap(a), wrap(b));
        setPairAddr(fresh);
        if (fresh !== ZeroAddress) poolIndex.refreshPair(fresh);
        else poolIndex.refresh();
      } catch { poolIndex.refresh(); }
    } catch {} finally { setBusy(false); }
  };

  const onRemove = async () => {
    if (!signer || !account || !isCorrectChain) return toast.error("Connect to Integralayer");
    if (rPair === ZeroAddress || lpBal === 0n) return toast.error("No LP balance for this pair");
    if (removePct < 1 || removePct > 100) return toast.error("Remove percent must be between 1 and 100");
    const vs = validateSlippageBps(slippage); if (!vs.ok) return toast.error(vs.error!);
    const vd = validateDeadlineMinutes(deadlineM); if (!vd.ok) return toast.error(vd.error!);
    if (!rReserves || rReserves.totalSupply === 0n) return toast.error("Pool reserves not loaded yet");

    const liq = (lpBal * BigInt(removePct)) / 100n;
    // Expected outputs from current reserves, then apply slippage tolerance
    const expA = (liq * rReserves.rA) / rReserves.totalSupply;
    const expB = (liq * rReserves.rB) / rReserves.totalSupply;
    const minA = applySlippage(expA, slippage);
    const minB = applySlippage(expB, slippage);
    const dl = deadlineMin(deadlineM);
    setBusy(true);
    try {
      const pair = new Contract(rPair, PAIR_ABI, signer);
      const allow: bigint = await pair.allowance(account, CONTRACTS.ROUTER);
      if (allow < liq) await sendTx("Approve LP", () => pair.approve(CONTRACTS.ROUTER, (1n<<255n)));
      const r = new Contract(CONTRACTS.ROUTER, ROUTER_ABI, signer);
      if (isNative(rA) || isNative(rB)) {
        const t = isNative(rA) ? rB : rA;
        const tokenMin = isNative(rA) ? minB : minA;
        const ethMin   = isNative(rA) ? minA : minB;
        await sendTx("Remove liquidity", () =>
          r.removeLiquidityETH(t.address, liq, tokenMin, ethMin, account, dl));
      } else {
        await sendTx("Remove liquidity", () =>
          r.removeLiquidity(rA.address, rB.address, liq, minA, minB, account, dl));
      }
      const c = new Contract(rPair, PAIR_ABI, readProvider);
      setLpBal(await c.balanceOf(account));
      poolIndex.refreshPair(rPair);
    } catch {} finally { setBusy(false); }
  };



  return (
    <div className="max-w-xl mx-auto animate-slide-up">
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center justify-center gap-2">
          <Plus className="w-7 h-7 text-primary"/> Manage <span className="text-grad">Liquidity</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Earn fees by providing tokens to pools</p>
      </div>

      <Tabs defaultValue="add" className="w-full">
        <TabsList className="grid grid-cols-2 w-full glass rounded-2xl p-1 h-auto">
          <TabsTrigger value="add" className="rounded-xl data-[state=active]:btn-primary-grad data-[state=active]:text-primary-foreground py-2"><Plus className="w-4 h-4 mr-1.5"/>Add</TabsTrigger>
          <TabsTrigger value="remove" className="rounded-xl data-[state=active]:btn-primary-grad data-[state=active]:text-primary-foreground py-2"><Minus className="w-4 h-4 mr-1.5"/>Remove</TabsTrigger>
        </TabsList>

        <TabsContent value="add" className="mt-4">
          <div className="form-surface p-5 space-y-3">
            <Field token={a} setToken={setA} exclude={b.address} amount={aAmt} setAmount={setAAmt} bal={balA} label="TOKEN A" />
            <div className="flex justify-center -my-1.5 relative z-10">
              <div className="w-8 h-8 rounded-xl btn-primary-grad grid place-items-center text-primary-foreground"><Plus className="w-4 h-4"/></div>
            </div>
            <Field token={b} setToken={setB} exclude={a.address} amount={bAmt} setAmount={setBAmt} bal={balB} label="TOKEN B" />

            {/* Pool information card — per screenshot */}
            <div className="form-field p-4 space-y-2 text-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">POOL INFORMATION</div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                {pairAddr === ZeroAddress
                  ? <span className="text-yellow-400 font-semibold flex items-center gap-1"><Info className="w-3.5 h-3.5"/> New Pair</span>
                  : reserves && reserves.totalSupply === 0n
                    ? <span className="text-yellow-400 font-semibold flex items-center gap-1"><Info className="w-3.5 h-3.5"/> Empty Pool — set initial price</span>
                    : <span className="text-green-400 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> Active Pool</span>}
              </div>
              {reserves && pairAddr !== ZeroAddress && <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {a.logo && <img src={a.logo} className="w-5 h-5 rounded-full object-cover"/>}
                    <span>{a.symbol}</span>
                  </div>
                  <span className="font-mono">{Number(formatUnits(reserves.rA, a.decimals)).toLocaleString(undefined,{maximumFractionDigits:4})}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {b.logo && <img src={b.logo} className="w-5 h-5 rounded-full object-cover"/>}
                    <span>{b.symbol}</span>
                  </div>
                  <span className="font-mono">{Number(formatUnits(reserves.rB, b.decimals)).toLocaleString(undefined,{maximumFractionDigits:4})}</span>
                </div></>}
              <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/40 truncate">
                {pairAddr === ZeroAddress ? "Pair does not exist yet — confirm tx to create it." : `Pair: ${pairAddr}`}
              </div>
            </div>

            {/* AMM info panel — constant product x*y=k */}
            {reserves && pairAddr !== ZeroAddress && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <Info className="w-3.5 h-3.5"/> AMM • Constant Product (x · y = k)
                </div>
                {reserves.rA > 0n && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-mono">1 {a.symbol} = {(Number(formatUnits(reserves.rB, b.decimals))/Number(formatUnits(reserves.rA, a.decimals))).toLocaleString(undefined,{maximumFractionDigits:6})} {b.symbol}</span></div>
                )}
                {reserves.totalSupply > 0n && aIn > 0n && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Your pool share after</span><span className="font-mono text-grad font-bold">{(() => {
                    const newLp = (aIn * reserves.totalSupply) / reserves.rA;
                    const share = Number((reserves.userLp + newLp) * 10000n / (reserves.totalSupply + newLp)) / 100;
                    return share.toFixed(4) + "%";
                  })()}</span></div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 px-1">
              <label className="text-[11px] text-muted-foreground">Slippage (%)</label>
              <Input type="number" min={0.01} max={50} step={0.01} value={(slippage/100).toString()}
                onChange={e => { const n = Number(e.target.value); if (isFinite(n)) setSlippage(Math.max(1, Math.min(5000, Math.round(n*100)))); }}
                className="h-8 w-20 text-xs bg-card" />
              <label className="text-[11px] text-muted-foreground">Deadline (min)</label>
              <Input type="number" min={1} max={180} step={1} value={deadlineM}
                onChange={e => { const n = Math.round(Number(e.target.value)); if (isFinite(n)) setDeadlineM(Math.max(1, Math.min(180, n))); }}
                className="h-8 w-20 text-xs bg-card" />
            </div>

            {validationError && (
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-1.5 animate-fade-in">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {validationError}
              </div>
            )}

            {pairAddr !== ZeroAddress && reserves && reserves.totalSupply === 0n && (
              <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-xs flex items-start gap-2 animate-fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>
                <div>
                  <div className="font-bold mb-0.5">This pool is empty.</div>
                  You will be the <span className="font-semibold">first liquidity provider</span> and you set the price.
                  The ratio of {a.symbol}/{b.symbol} you submit becomes the opening price.
                </div>
              </div>
            )}
            {(needApproveA || needApproveB) && pairAddr !== ZeroAddress && (
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[11px] flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
                <span>ERC-20 tokens must be approved to the router once before they can be added to a pool. Approving does <strong>not</strong> move tokens — it only gives permission.</span>
              </div>
            )}

            {/* Initial price preview (only when pool is empty) */}
            {isInitialLiquidityMode && aIn > 0n && bIn > 0n && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 space-y-1 text-xs animate-fade-in">
                <div className="font-bold text-primary text-[11px] uppercase tracking-wider flex items-center gap-1.5"><Info className="w-3.5 h-3.5"/> Opening price you will set</div>
                <div className="flex justify-between"><span className="text-muted-foreground">1 {a.symbol} =</span><span className="font-mono font-semibold">{(Number(formatUnits(bIn, b.decimals)) / Number(formatUnits(aIn, a.decimals))).toLocaleString(undefined,{maximumFractionDigits:8})} {b.symbol}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">1 {b.symbol} =</span><span className="font-mono font-semibold">{(Number(formatUnits(aIn, a.decimals)) / Number(formatUnits(bIn, b.decimals))).toLocaleString(undefined,{maximumFractionDigits:8})} {a.symbol}</span></div>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">aMin = amountADesired and bMin = amountBDesired (no reserves to enforce a ratio against). Slippage tolerance is not applied to the first mint.</div>
              </div>
            )}

            {/* Pre-flight + soft warnings */}
            {pairAddr !== ZeroAddress && aAmt && bAmt && !validationError && (
              <TxPreflight est={gasEst} loading={estimating} symbol="IRL" warnings={softWarnings} />
            )}

            {pairAddr === ZeroAddress ? (
              <Button disabled={busy || !account} onClick={onCreatePair} className="w-full h-14 rounded-2xl btn-primary-grad text-primary-foreground font-bold">{busy ? <Loader2 className="animate-spin w-4 h-4"/> : "Create Pair"}</Button>
            ) : (needApproveA || needApproveB) ? (
              <div className="grid grid-cols-2 gap-2">
                {needApproveA ? (
                  <Button disabled={busy} onClick={() => onApprove(a)} className="h-14 rounded-2xl btn-primary-grad text-primary-foreground font-bold">{busy ? <Loader2 className="animate-spin w-4 h-4"/> : `Approve ${a.symbol}`}</Button>
                ) : (
                  <Button disabled className="h-14 rounded-2xl bg-secondary text-muted-foreground font-bold"><CheckCircle2 className="w-4 h-4 mr-1.5"/>{a.symbol} Approved</Button>
                )}
                {needApproveB ? (
                  <Button disabled={busy} onClick={() => onApprove(b)} className="h-14 rounded-2xl btn-primary-grad text-primary-foreground font-bold">{busy ? <Loader2 className="animate-spin w-4 h-4"/> : `Approve ${b.symbol}`}</Button>
                ) : (
                  <Button disabled className="h-14 rounded-2xl bg-secondary text-muted-foreground font-bold"><CheckCircle2 className="w-4 h-4 mr-1.5"/>{b.symbol} Approved</Button>
                )}
              </div>
            ) : (
              <Button disabled={busy || !account || !aAmt || !bAmt || !!validationError || gasEst?.ok === false} onClick={onAdd} className="w-full h-14 rounded-2xl btn-primary-grad text-primary-foreground font-bold">
                {busy ? <Loader2 className="animate-spin w-4 h-4"/> : isInitialLiquidityMode ? "Provide Initial Liquidity" : "Add Liquidity"}
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="remove" className="mt-4">
          <div className="form-surface p-5 space-y-4">
            <div className="form-field p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">YOUR LP TOKENS</span>
                <span className="text-2xl font-extrabold text-grad font-mono">{Number(formatUnits(lpBal, 18)).toLocaleString(undefined,{maximumFractionDigits:6})}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex -space-x-1.5">
                  {rA.logo && <img src={rA.logo} className="w-5 h-5 rounded-full border border-card object-cover"/>}
                  {rB.logo && <img src={rB.logo} className="w-5 h-5 rounded-full border border-card object-cover"/>}
                </div>
                <span>{rA.symbol}/{rB.symbol} LP</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Token A</div>
                <TokenSelect value={rA} onChange={setRA} exclude={rB.address} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Token B</div>
                <TokenSelect value={rB} onChange={setRB} exclude={rA.address} />
              </div>
            </div>

            <div className="form-field p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">AMOUNT TO REMOVE</span>
                <button onClick={() => setRemovePct(100)} className="text-xs text-primary font-bold hover:underline">MAX</button>
              </div>
              <div className="text-3xl font-extrabold text-grad mb-3">{removePct}%</div>
              <input type="range" min={1} max={100} value={removePct} onChange={e => setRemovePct(Number(e.target.value))}
                className="w-full accent-[hsl(var(--primary))]" />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[25,50,75,100].map(p => (
                <button key={p} onClick={() => setRemovePct(p)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition ${removePct === p ? "btn-primary-grad text-primary-foreground" : "bg-secondary border border-border hover:border-primary"}`}>
                  {p}%
                </button>
              ))}
            </div>

            {/* Expected outputs preview with slippage tolerance */}
            {rReserves && rReserves.totalSupply > 0n && lpBal > 0n && (() => {
              const liq = (lpBal * BigInt(removePct)) / 100n;
              const outA = (liq * rReserves.rA) / rReserves.totalSupply;
              const outB = (liq * rReserves.rB) / rReserves.totalSupply;
              const minA = applySlippage(outA, slippage);
              const minB = applySlippage(outB, slippage);
              const sharePct = Number((liq * 1_000_000n) / rReserves.totalSupply) / 10_000;
              const fmtA = (v: bigint) => Number(formatUnits(v, rA.decimals)).toLocaleString(undefined,{maximumFractionDigits:6});
              const fmtB = (v: bigint) => Number(formatUnits(v, rB.decimals)).toLocaleString(undefined,{maximumFractionDigits:6});
              return (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5"/> YOU WILL RECEIVE
                    </div>
                    <span className="text-[10px] text-muted-foreground">Slippage <span className="text-foreground font-semibold">{(slippage/100).toFixed(2)}%</span></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {rA.logo && <img src={rA.logo} className="w-6 h-6 rounded-full object-cover"/>}
                      <span className="font-semibold">{rA.symbol}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold">{fmtA(outA)}</div>
                      <div className="text-[10px] text-muted-foreground">min <span className="font-mono">{fmtA(minA)}</span></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {rB.logo && <img src={rB.logo} className="w-6 h-6 rounded-full object-cover"/>}
                      <span className="font-semibold">{rB.symbol}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold">{fmtB(outB)}</div>
                      <div className="text-[10px] text-muted-foreground">min <span className="font-mono">{fmtB(minB)}</span></div>
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
                    <span>Pool share burned</span><span className="font-mono">{sharePct.toFixed(4)}%</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>LP to burn</span><span className="font-mono">{Number(formatUnits(liq, 18)).toLocaleString(undefined,{maximumFractionDigits:6})}</span>
                  </div>
                </div>
              );
            })()}

            {/* Slippage + deadline controls (shared with add) */}
            <div className="flex items-center justify-between gap-2 px-1">
              <label className="text-[11px] text-muted-foreground">Slippage (%)</label>
              <Input type="number" min={0.01} max={50} step={0.01} value={(slippage/100).toString()}
                onChange={e => { const n = Number(e.target.value); if (isFinite(n)) setSlippage(Math.max(1, Math.min(5000, Math.round(n*100)))); }}
                className="h-8 w-20 text-xs bg-card" />
              <label className="text-[11px] text-muted-foreground">Deadline (min)</label>
              <Input type="number" min={1} max={180} step={1} value={deadlineM}
                onChange={e => { const n = Math.round(Number(e.target.value)); if (isFinite(n)) setDeadlineM(Math.max(1, Math.min(180, n))); }}
                className="h-8 w-20 text-xs bg-card" />
            </div>

            {rPair === ZeroAddress && (
              <div className="p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0"/> No pool exists for {rA.symbol}/{rB.symbol}.
              </div>
            )}

            <Button disabled={busy || !account || lpBal === 0n} onClick={onRemove}
              className="w-full h-14 rounded-2xl btn-primary-grad text-primary-foreground font-bold text-base">
              {busy ? <Loader2 className="animate-spin w-4 h-4"/> : lpBal === 0n ? "No LP balance" : `Remove ${removePct}% Liquidity`}
            </Button>
          </div>
        </TabsContent>


      </Tabs>
    </div>
  );
};

const Field = ({ token, setToken, exclude, amount, setAmount, bal, label }: any) => (
  <div className="form-field p-4">
    <div className="flex justify-between text-xs mb-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <button onClick={() => setAmount(bal)} className="text-muted-foreground hover:text-primary">
        Balance: <span className="font-mono font-semibold text-foreground">{Number(bal).toFixed(4)}</span> <span className="text-primary font-bold ml-1">MAX</span>
      </button>
    </div>
    <div className="flex items-center gap-2">
      <Input type="number" placeholder="0.0" value={amount} onChange={e => setAmount(e.target.value)}
        className="border-0 bg-transparent text-2xl font-bold p-0 h-auto focus-visible:ring-0" />
      <TokenSelect value={token} onChange={setToken} exclude={exclude} />
    </div>
  </div>
);

export default Liquidity;
