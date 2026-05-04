import { useEffect, useMemo, useState } from "react";
import TokenSelect from "@/components/TokenSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWeb3 } from "@/lib/web3";
import { NATIVE_TOKEN, TOKENS, CONTRACTS, TokenInfo } from "@/lib/chain";
import { ERC20_ABI, ROUTER_ABI } from "@/lib/abis";
import { Contract, formatUnits } from "ethers";
import { applySlippage, deadlineMin, getTokenBalance, isNative, parse, unwrapIRL, wrap, wrapIRL } from "@/lib/dex";
import { sendTx } from "@/lib/tx";
import { validateAmount, validateSlippageBps, validateDeadlineMinutes } from "@/lib/validate";
import { findBestRoute, impactSeverity, RouteQuote } from "@/lib/router";
import { ArrowDown, Settings, Loader2, Zap, Repeat, AlertTriangle, Route as RouteIcon, Info, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { estimateContractCall, GasEstimate } from "@/lib/gas";
import TxPreflight from "@/components/TxPreflight";
import { NATIVE_TOKEN as NATIVE } from "@/lib/chain";
import { usePersistedPref } from "@/lib/userPrefs";
import FormOrb3D from "@/components/FormOrb3D";

const Swap = () => {
  const { account, signer, readProvider, router, isCorrectChain } = useWeb3();
  const [tokenIn, setTokenIn] = useState<TokenInfo>(NATIVE_TOKEN);
  const [tokenOut, setTokenOut] = useState<TokenInfo>(TOKENS.find(t => t.symbol === "EGDX")!);
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [balIn, setBalIn] = useState("0");
  const [balOut, setBalOut] = useState("0");
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slippage, setSlippage] = usePersistedPref("slippageBps", 50); // bps = 0.5%
  const [deadlineM, setDeadlineM] = usePersistedPref("deadlineMin", 20); // minutes
  const [showSettings, setShowSettings] = useState(false);
  const [noPair, setNoPair] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteQuote | null>(null);
  const [acceptHighImpact, setAcceptHighImpact] = useState(false);
  const [gasEst, setGasEst] = useState<GasEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const symbolOf = (addr: string) => TOKENS.find(t => t.address.toLowerCase() === addr.toLowerCase())?.symbol ?? addr.slice(0, 6);

  // Detect wrap/unwrap mode (IRL <-> WIRL — same underlying address after wrap())
  const isWrap = isNative(tokenIn) && tokenOut.address.toLowerCase() === CONTRACTS.WETH.toLowerCase();
  const isUnwrap = isNative(tokenOut) && tokenIn.address.toLowerCase() === CONTRACTS.WETH.toLowerCase();
  const isWrapMode = isWrap || isUnwrap;

  // balances
  useEffect(() => {
    if (!account) { setBalIn("0"); setBalOut("0"); return; }
    (async () => {
      const [bi, bo] = await Promise.all([
        getTokenBalance(readProvider, tokenIn, account),
        getTokenBalance(readProvider, tokenOut, account),
      ]);
      setBalIn(formatUnits(bi, tokenIn.decimals));
      setBalOut(formatUnits(bo, tokenOut.decimals));
    })().catch(() => {});
  }, [account, tokenIn, tokenOut, readProvider]);

  // quote — multi-hop best route
  useEffect(() => {
    setNoPair(false); setRoute(null);
    const inAmt = parse(amountIn, tokenIn.decimals);
    if (inAmt === 0n) { setAmountOut(""); return; }
    if (isWrapMode) { setAmountOut(amountIn); return; }
    const inAddr = wrap(tokenIn), outAddr = wrap(tokenOut);
    if (inAddr.toLowerCase() === outAddr.toLowerCase()) { setAmountOut(""); return; }
    let cancelled = false;
    setQuoting(true);
    (async () => {
      try {
        const best = await findBestRoute(router, inAddr, outAddr, inAmt);
        if (cancelled) return;
        if (!best) { setAmountOut(""); setNoPair(true); return; }
        setRoute(best);
        setAmountOut(formatUnits(best.amountOut, tokenOut.decimals));
      } catch {
        if (!cancelled) { setAmountOut(""); setNoPair(true); }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [amountIn, tokenIn, tokenOut, router, isWrapMode]);

  const flip = () => {
    setTokenIn(tokenOut); setTokenOut(tokenIn);
    setAmountIn(amountOut); setAmountOut(amountIn);
  };

  const price = useMemo(() => {
    const a = Number(amountIn), b = Number(amountOut);
    if (!a || !b) return null;
    return b / a;
  }, [amountIn, amountOut]);

  // live validation of amount + settings
  useEffect(() => {
    if (!amountIn) { setValidationError(null); return; }
    const v = validateAmount(amountIn, tokenIn.decimals, { symbol: tokenIn.symbol });
    if (!v.ok) { setValidationError(v.error!); return; }
    const sBal = parse(balIn, tokenIn.decimals);
    if (v.value! > sBal) { setValidationError(`Insufficient ${tokenIn.symbol} balance`); return; }
    const s = validateSlippageBps(slippage);
    if (!s.ok) { setValidationError(s.error!); return; }
    const d = validateDeadlineMinutes(deadlineM);
    if (!d.ok) { setValidationError(d.error!); return; }
    setValidationError(null);
  }, [amountIn, tokenIn, balIn, slippage, deadlineM]);

  // Pre-flight gas estimation — re-runs whenever a meaningful input changes.
  useEffect(() => {
    setGasEst(null);
    if (!signer || !account || !isCorrectChain) return;
    if (validationError) return;
    if (!amountIn || !route || isWrapMode) return;
    let cancelled = false;
    setEstimating(true);
    (async () => {
      try {
        const inAmt = parse(amountIn, tokenIn.decimals);
        if (inAmt === 0n) return;
        // Skip estimate if user must approve first — would always revert.
        if (!isNative(tokenIn)) {
          const erc = new Contract(tokenIn.address, ERC20_ABI, signer);
          const allow: bigint = await erc.allowance(account, CONTRACTS.ROUTER);
          if (allow < inAmt) { setGasEst({ ok: true, warning: "Token approval required first — gas will be re-estimated after approve." } as any); return; }
        }
        const minOut = applySlippage(route.amountOut, slippage);
        const r = new Contract(CONTRACTS.ROUTER, ROUTER_ABI, signer);
        const dl = deadlineMin(deadlineM);
        let est: GasEstimate;
        if (isNative(tokenIn)) {
          est = await estimateContractCall(signer, r, "swapExactETHForTokens", [minOut, route.path, account, dl], { value: inAmt });
        } else if (isNative(tokenOut)) {
          est = await estimateContractCall(signer, r, "swapExactTokensForETH", [inAmt, minOut, route.path, account, dl]);
        } else {
          est = await estimateContractCall(signer, r, "swapExactTokensForTokens", [inAmt, minOut, route.path, account, dl]);
        }
        if (!cancelled) setGasEst(est);
      } catch (e: any) {
        if (!cancelled) setGasEst({ ok: false, revertReason: e?.shortMessage || e?.message || "Estimation failed" });
      } finally {
        if (!cancelled) setEstimating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [signer, account, isCorrectChain, amountIn, route, slippage, deadlineM, tokenIn, tokenOut, validationError, isWrapMode]);

  // Soft warnings — deadline / slippage thresholds vs actual price impact
  const softWarnings = useMemo(() => {
    const ws: string[] = [];
    if (deadlineM <= 2) ws.push(`Deadline only ${deadlineM} min — tx may expire before confirmation in busy blocks. Consider 10–20 min.`);
    if (slippage >= 1000) ws.push(`Slippage tolerance is ${(slippage/100).toFixed(2)}% — very high; bots can sandwich-attack you.`);
    if (route?.priceImpactBps != null && route.priceImpactBps >= slippage) {
      ws.push(`Current price impact (${(route.priceImpactBps/100).toFixed(2)}%) is at or above your slippage tolerance (${(slippage/100).toFixed(2)}%). The tx will likely revert with INSUFFICIENT_OUTPUT_AMOUNT — raise slippage or lower amount.`);
    } else if (route?.priceImpactBps != null && route.priceImpactBps * 2 >= slippage) {
      ws.push(`Price impact (${(route.priceImpactBps/100).toFixed(2)}%) is close to your slippage budget (${(slippage/100).toFixed(2)}%). Consider raising slippage or splitting the trade.`);
    }
    return ws;
  }, [deadlineM, slippage, route]);

  const onSwap = async () => {
    if (!signer || !account) return toast.error("Connect wallet");
    if (!isCorrectChain) return toast.error("Wrong network — please switch to Integralayer");

    // Strict pre-flight validation
    const amt = validateAmount(amountIn, tokenIn.decimals, { symbol: tokenIn.symbol });
    if (!amt.ok) return toast.error(amt.error!);
    const sBal = parse(balIn, tokenIn.decimals);
    if (amt.value! > sBal) return toast.error(`Insufficient ${tokenIn.symbol} balance`);
    const s = validateSlippageBps(slippage);
    if (!s.ok) return toast.error(s.error!);
    const d = validateDeadlineMinutes(deadlineM);
    if (!d.ok) return toast.error(d.error!);

    const inAmt = amt.value!;
    setBusy(true);
    try {
      // WRAP / UNWRAP path — direct WIRL contract, no router
      if (isWrap) {
        await sendTx("Wrap IRL → WIRL", () => wrapIRL(signer, inAmt));
        setAmountIn(""); setAmountOut(""); return;
      }
      if (isUnwrap) {
        await sendTx("Unwrap WIRL → IRL", () => unwrapIRL(signer, inAmt));
        setAmountIn(""); setAmountOut(""); return;
      }

      // Re-quote *just before* sending so minOut reflects the latest reserves —
      // critical for multi-hop where any intermediary reserve change shifts amountOut.
      const inAddr = wrap(tokenIn), outAddr = wrap(tokenOut);
      const fresh = await findBestRoute(router, inAddr, outAddr, inAmt);
      if (!fresh || fresh.amountOut === 0n) return toast.error("No route found — pool may have moved");
      // Apply slippage to the *final* output of the best route — Uniswap V2 router enforces this
      // for the whole path (each hop's output feeds the next), so a single end-of-path bound is sufficient and safe.
      const minOut = applySlippage(fresh.amountOut, slippage);
      if (minOut === 0n) return toast.error("Min received rounds to 0 — increase amount or slippage");
      const deadline = deadlineMin(deadlineM);
      const r = new Contract(CONTRACTS.ROUTER, ROUTER_ABI, signer);
      if (!isNative(tokenIn)) {
        const erc = new Contract(tokenIn.address, ERC20_ABI, signer);
        const allow: bigint = await erc.allowance(account, CONTRACTS.ROUTER);
        if (allow < inAmt) {
          await sendTx(`Approve ${tokenIn.symbol}`, () => erc.approve(CONTRACTS.ROUTER, (1n<<255n)));
        }
      }
      const swapPath = fresh.path;
      const impact = fresh.priceImpactBps ?? 0;
      if (impact >= 1000 && !acceptHighImpact) {
        return toast.error(`Price impact ${(impact/100).toFixed(2)}% is very high — confirm checkbox to proceed`);
      }
      const hopLabel = fresh.hops > 1 ? ` (${fresh.hops} hops)` : "";
      if (isNative(tokenIn)) {
        await sendTx(`Swap ${tokenIn.symbol} → ${tokenOut.symbol}${hopLabel}`,
          () => r.swapExactETHForTokens(minOut, swapPath, account, deadline, { value: inAmt }));
      } else if (isNative(tokenOut)) {
        await sendTx(`Swap ${tokenIn.symbol} → ${tokenOut.symbol}${hopLabel}`,
          () => r.swapExactTokensForETH(inAmt, minOut, swapPath, account, deadline));
      } else {
        await sendTx(`Swap ${tokenIn.symbol} → ${tokenOut.symbol}${hopLabel}`,
          () => r.swapExactTokensForTokens(inAmt, minOut, swapPath, account, deadline));
      }
      setAmountIn(""); setAmountOut(""); setAcceptHighImpact(false);
    } catch {} finally { setBusy(false); }
  };

  const insufficient = Number(amountIn) > Number(balIn);

  return (
    <div className="max-w-md mx-auto animate-slide-up">
      {/* Decorative 3D orb above the form */}
      <div className="relative mb-1">
        <FormOrb3D height={170} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div className="text-center mb-6 -mt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Best on-chain rate
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="text-grad">Swap</span> tokens
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">Multi-hop routing · MEV-aware slippage · 0 hidden fees</p>
      </div>

      {/* Premium gradient ring around the swap surface */}
      <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-br from-primary/60 via-primary/10 to-transparent shadow-[0_30px_80px_-30px_hsl(var(--primary)/0.45)] hover:shadow-[0_40px_100px_-30px_hsl(var(--primary)/0.6)] transition-shadow duration-500">
        <div className="form-surface p-5 relative rounded-[calc(1.5rem-1.5px)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">Trade</span>
            <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/30 text-primary text-[9px] font-bold uppercase tracking-wider">v2 AMM</span>
          </div>
          <button onClick={() => setShowSettings(v => !v)} className="p-2 rounded-lg hover:bg-secondary border border-transparent hover:border-border transition" aria-label="Settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {showSettings && (
          <div className="mb-3 p-3 rounded-xl form-field animate-fade-in space-y-3">
            <div>
              <div className="text-xs font-semibold mb-2">Slippage tolerance (max 50%)</div>
              <div className="flex gap-2 flex-wrap">
                {[10, 50, 100].map(b => (
                  <button key={b} onClick={() => setSlippage(b)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${slippage === b ? "btn-primary-grad text-primary-foreground" : "bg-card border border-border"}`}>
                    {(b/100).toFixed(2)}%
                  </button>
                ))}
                <Input type="number" min={0.01} max={50} step={0.01} value={(slippage/100).toString()}
                  onChange={e => {
                    const n = Number(e.target.value);
                    if (!isFinite(n)) return;
                    setSlippage(Math.max(1, Math.min(5000, Math.round(n*100))));
                  }}
                  className="h-8 w-24 text-xs bg-card" />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold mb-2">Transaction deadline (1–180 minutes)</div>
              <Input type="number" min={1} max={180} step={1} value={deadlineM}
                onChange={e => {
                  const n = Math.round(Number(e.target.value));
                  if (!isFinite(n)) return;
                  setDeadlineM(Math.max(1, Math.min(180, n)));
                }}
                className="h-8 w-24 text-xs bg-card" />
            </div>
          </div>
        )}

        {/* From */}
        <div className="form-field p-4 transition hover:border-primary/40">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">You pay</span>
            <button onClick={() => setAmountIn(balIn)} className="text-xs text-muted-foreground hover:text-primary transition">
              Balance <span className="font-mono font-semibold text-foreground">{Number(balIn).toFixed(4)}</span>
              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/15 text-primary">MAX</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Input type="number" placeholder="0.0" value={amountIn} onChange={e => setAmountIn(e.target.value)}
              className="border-0 bg-transparent text-3xl font-extrabold tracking-tight p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/40" />
            <TokenSelect value={tokenIn} onChange={setTokenIn} exclude={tokenOut.address} />
          </div>
        </div>

        <div className="flex justify-center -my-2.5 relative z-10">
          <button onClick={flip} aria-label="Flip"
            className="w-9 h-9 grid place-items-center rounded-xl bg-card border-2 border-background ring-1 ring-border hover:ring-primary hover:text-primary hover:rotate-180 transition-all duration-300">
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

        {/* To */}
        <div className="form-field p-4 transition hover:border-primary/40">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">You receive <span className="opacity-60 normal-case tracking-normal font-medium">(est.)</span></span>
            <span className="text-xs text-muted-foreground">Balance <span className="font-mono font-semibold text-foreground">{Number(balOut).toFixed(4)}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-3xl font-extrabold tracking-tight flex items-center text-foreground/95">
              {quoting ? <Loader2 className="w-5 h-5 animate-spin opacity-60" /> : (amountOut ? Number(amountOut).toFixed(6) : <span className="opacity-40">0.0</span>)}
            </div>
            <TokenSelect value={tokenOut} onChange={setTokenOut} exclude={tokenIn.address} />
          </div>
        </div>

        {isWrapMode && amountIn && (
          <div className="mt-3 p-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs text-center flex items-center justify-center gap-1.5 animate-fade-in">
            <Repeat className="w-3.5 h-3.5" />
            {isWrap ? "Wrapping IRL → WIRL at 1:1 (no slippage, no fee)" : "Unwrapping WIRL → IRL at 1:1 (no slippage, no fee)"}
          </div>
        )}
        {!isWrapMode && price !== null && (
          <div className="mt-3 rounded-xl form-field-inset p-3 space-y-1.5 text-xs animate-fade-in">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-mono font-semibold">1 {tokenIn.symbol} ≈ {price.toFixed(6)} {tokenOut.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min received <span className="opacity-70">({(slippage/100).toFixed(2)}% slip)</span></span>
              <span className="font-mono font-semibold">{(Number(amountOut) * (1 - slippage/10000)).toFixed(6)} {tokenOut.symbol}</span>
            </div>
            {route && (
              <div className="flex justify-between items-center pt-1 border-t border-border/40">
                <button onClick={() => setShowDetails(v => !v)} className="text-muted-foreground hover:text-primary flex items-center gap-1 transition">
                  <ChevronDown className={`w-3 h-3 transition-transform ${showDetails ? "rotate-180" : ""}`} />
                  {showDetails ? "Hide" : "Show"} details
                </button>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${
                  impactSeverity(route.priceImpactBps) === "danger" ? "bg-destructive/20 text-destructive"
                  : impactSeverity(route.priceImpactBps) === "warn" ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-secondary text-muted-foreground"}`}>
                  Impact {route.priceImpactBps != null ? `${(route.priceImpactBps/100).toFixed(2)}%` : "—"} · {route.hops} hop{route.hops>1?"s":""}
                </span>
              </div>
            )}
          </div>
        )}
        {!isWrapMode && route && showDetails && (() => {
          const sev = impactSeverity(route.priceImpactBps);
          const sevCls = sev === "danger" ? "text-destructive border-destructive/40 bg-destructive/10"
            : sev === "warn" ? "text-yellow-400 border-yellow-500/40 bg-yellow-500/10"
            : "text-muted-foreground border-border bg-card";
          const minOut = Number(amountOut) * (1 - slippage / 10000);
          const diffMin = Number(amountOut) - minOut;
          return (
            <div className="mt-3 rounded-xl form-field-inset p-3 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-primary"/> Price impact details</span>
                <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold font-mono ${sevCls}`}>
                  {route.priceImpactBps != null ? `${(route.priceImpactBps/100).toFixed(2)}%` : "—"}
                </span>
              </div>

              {/* Route path */}
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground flex items-center gap-1"><RouteIcon className="w-3 h-3"/> Route ({route.hops} hop{route.hops>1?"s":""})</span>
                <span className="font-mono text-primary font-semibold">{route.path.map(symbolOf).join(" → ")}</span>
              </div>

              {/* Per-hop before / after / impact / slippage contribution */}
              {route.hopDetails && route.hopDetails.length > 0 && (
                <div className="rounded-lg bg-black border border-border/70 divide-y divide-border/50 overflow-hidden">
                  <div className="grid grid-cols-12 px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                    <div className="col-span-3">Hop</div>
                    <div className="col-span-2 text-right">Before</div>
                    <div className="col-span-2 text-right">After</div>
                    <div className="col-span-2 text-right">Impact</div>
                    <div className="col-span-3 text-right">Slip share</div>
                  </div>
                  {route.hopDetails.map((h, i) => {
                    const hSev = impactSeverity(h.impactBps);
                    const hCls = hSev === "danger" ? "text-destructive" : hSev === "warn" ? "text-yellow-400" : "text-foreground";
                    const drop = h.priceBefore > 0 ? ((h.priceBefore - h.priceAfter) / h.priceBefore) * 100 : 0;
                    const sharePct = h.slippageContribBps / 100;
                    // Per-hop max-loss in output token terms (hop's contribution to slippage tolerance budget)
                    const hopMinOut = Number(formatUnits(h.amountOut, 18)) * (1 - (slippage / 10000) * (h.slippageContribBps / 10000));
                    return (
                      <div key={i} className="grid grid-cols-12 px-2 py-1.5 text-[10px] font-mono items-center hover:bg-primary/5 transition">
                        <div className="col-span-3 text-muted-foreground truncate">
                          {symbolOf(h.tokenIn)}→{symbolOf(h.tokenOut)}
                        </div>
                        <div className="col-span-2 text-right">{h.priceBefore ? h.priceBefore.toPrecision(4) : "—"}</div>
                        <div className="col-span-2 text-right">{h.priceAfter ? h.priceAfter.toPrecision(4) : "—"}</div>
                        <div className={`col-span-2 text-right font-bold ${hCls}`}>
                          {drop > 0 ? `-${drop.toFixed(2)}%` : "0.00%"}
                        </div>
                        <div className="col-span-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="h-1 w-10 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full btn-primary-grad" style={{ width: `${Math.min(100, sharePct)}%` }} />
                            </div>
                            <span className={`font-bold ${sharePct >= 50 ? "text-primary" : "text-muted-foreground"}`}>{sharePct.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* AmountOut vs minOut */}
              <div className="rounded-lg bg-black border border-border/70 p-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected output</span>
                  <span className="font-mono font-semibold">{Number(amountOut).toFixed(6)} {tokenOut.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min received ({(slippage/100).toFixed(2)}% slip)</span>
                  <span className="font-mono font-semibold">{minOut.toFixed(6)} {tokenOut.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max slippage loss</span>
                  <span className="font-mono text-yellow-400">-{diffMin.toFixed(6)} {tokenOut.symbol}</span>
                </div>
              </div>
            </div>
          );
        })()}
        {!isWrapMode && route?.priceImpactBps != null && route.priceImpactBps >= 1000 && (
          <label className="mt-2 flex items-start gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/40 text-destructive text-xs cursor-pointer animate-fade-in">
            <input type="checkbox" checked={acceptHighImpact} onChange={e => setAcceptHighImpact(e.target.checked)}
              className="mt-0.5 accent-[hsl(var(--destructive))]" />
            <span><strong>High price impact ({(route.priceImpactBps/100).toFixed(2)}%).</strong> You may lose a significant portion of your funds. Check the box to confirm you understand.</span>
          </label>
        )}
        {validationError && amountIn && (
          <div className="mt-3 p-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-1.5 animate-fade-in">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {validationError}
          </div>
        )}
        {!isWrapMode && noPair && amountIn && !validationError && (
          <div className="mt-3 p-2 rounded-lg bg-destructive/10 text-destructive text-xs text-center">No liquidity pair found for this route.</div>
        )}

        {!isWrapMode && amountIn && !validationError && !noPair && (
          <TxPreflight
            est={gasEst}
            loading={estimating}
            symbol={NATIVE.symbol}
            warnings={softWarnings}
            className="mt-3"
          />
        )}

        <Button disabled={!account || busy || !amountIn || quoting || !!validationError || (!isWrapMode && noPair) || (!isWrapMode && (route?.priceImpactBps ?? 0) >= 1000 && !acceptHighImpact) || (gasEst?.ok === false)}
          onClick={onSwap}
          className="w-full mt-4 h-14 text-base font-bold rounded-2xl btn-primary-grad text-primary-foreground disabled:opacity-50 shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.6)] hover:shadow-[0_14px_40px_-10px_hsl(var(--primary)/0.8)] transition-shadow">
          {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
            : !account ? "Connect Wallet"
            : insufficient ? `Insufficient ${tokenIn.symbol}`
            : isWrap ? <><Repeat className="w-4 h-4 mr-2" /> Wrap</>
            : isUnwrap ? <><Repeat className="w-4 h-4 mr-2" /> Unwrap</>
            : noPair ? "No route"
            : gasEst?.ok === false ? "Cannot execute (would revert)"
            : (route?.priceImpactBps ?? 0) >= 1000 && !acceptHighImpact ? "Confirm high impact"
            : <><Zap className="w-4 h-4 mr-2" /> Swap</>}
        </Button>
      </div>
      </div>
    </div>
  );
};

export default Swap;
