import { forwardRef, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TOKENS, TokenInfo } from "@/lib/chain";
import { useWeb3 } from "@/lib/web3";
import { addCustomToken, fetchOnchainTokenMeta, loadCustomTokens, removeCustomToken } from "@/lib/tokens";
import { getTokenBalance, fmt } from "@/lib/dex";
import { isAddress } from "ethers";
import { ChevronDown, Search, Loader2, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props { value: TokenInfo; onChange: (t: TokenInfo) => void; exclude?: string; }

const TokenSelect = forwardRef<HTMLButtonElement, Props>(({ value, onChange, exclude }, ref) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState<TokenInfo[]>(() => loadCustomTokens());
  const { readProvider, account } = useWeb3();
  const [importing, setImporting] = useState<TokenInfo | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [loadingBals, setLoadingBals] = useState(false);

  // Sync with global token registry updates
  useEffect(() => {
    const refresh = () => setCustom(loadCustomTokens());
    window.addEventListener("eagledex:tokens-updated", refresh);
    return () => window.removeEventListener("eagledex:tokens-updated", refresh);
  }, []);

  const all = useMemo(() => [...TOKENS, ...custom].filter(t => t.address !== exclude), [custom, exclude]);

  const list = useMemo(() => {
    const filtered = !q ? all : (() => {
      const s = q.toLowerCase();
      return all.filter(t => t.symbol.toLowerCase().includes(s) || t.name.toLowerCase().includes(s) || t.address.toLowerCase().includes(s));
    })();
    // Sort by balance desc (tokens with balance first)
    return [...filtered].sort((a, b) => {
      const ba = Number(balances[a.address] ?? 0);
      const bb = Number(balances[b.address] ?? 0);
      return bb - ba;
    });
  }, [q, all, balances]);

  // Fetch balances for all listed tokens when dialog opens / account changes
  useEffect(() => {
    if (!open || !account) { return; }
    let cancelled = false;
    setLoadingBals(true);
    (async () => {
      const entries = await Promise.all(
        all.map(async (t) => {
          try {
            const bal = await getTokenBalance(readProvider, t, account);
            return [t.address, fmt(bal as bigint, t.decimals, 4)] as const;
          } catch {
            return [t.address, "0"] as const;
          }
        })
      );
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const [k, v] of entries) map[k] = v;
      setBalances(map);
      setLoadingBals(false);
    })();
    return () => { cancelled = true; };
  }, [open, account, all, readProvider]);

  // When user pastes a valid address that we don't know, fetch metadata on-chain
  useEffect(() => {
    setImporting(null); setFetchErr(null);
    if (!isAddress(q)) return;
    if ([...TOKENS, ...custom].some(t => t.address.toLowerCase() === q.toLowerCase())) return;
    setFetching(true);
    fetchOnchainTokenMeta(readProvider, q)
      .then(meta => {
        if (!meta) { setFetchErr("Not a valid ERC-20 contract"); return; }
        setImporting({ ...meta, logo: "" });
      })
      .catch(() => setFetchErr("Failed to read token contract"))
      .finally(() => setFetching(false));
  }, [q, custom, readProvider]);

  const confirmImport = () => {
    if (!importing) return;
    const final: TokenInfo = { ...importing, logo: logoUrl.trim() || importing.logo };
    addCustomToken(final);
    setCustom(loadCustomTokens());
    onChange(final); setOpen(false); setQ(""); setLogoUrl(""); setImporting(null);
    toast.success(`${final.symbol} imported`, { description: "Token saved to your local list." });
  };

  const removeOne = (addr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeCustomToken(addr);
    setCustom(loadCustomTokens());
    toast.success("Token removed");
  };

  return (
    <>
      <button ref={ref} onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/70 transition-all border border-border">
        {value.logo ? <img src={value.logo} alt={value.symbol} className="w-6 h-6 rounded-full object-cover" onError={(e) => ((e.currentTarget.style.display = "none"))}/>
                    : <div className="w-6 h-6 rounded-full bg-primary/20 grid place-items-center text-[10px] font-bold">{value.symbol[0]}</div>}
        <span className="font-semibold">{value.symbol}</span>
        <ChevronDown className="w-4 h-4 opacity-60" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="form-surface max-w-md !rounded-2xl">
          <DialogHeader>
            <DialogTitle>Select a token</DialogTitle>
            <DialogDescription className="text-xs">Search by name, symbol, or paste a contract address to import.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name or paste 0x address" value={q} onChange={e => setQ(e.target.value)} className="pl-9 form-field" />
            {fetching && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />}
          </div>

          {fetchErr && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
              <AlertTriangle className="w-3.5 h-3.5" /> {fetchErr}
            </div>
          )}

          {importing && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-3 animate-fade-in">
              <div className="flex items-center gap-3">
                {logoUrl ? <img src={logoUrl} alt="" className="w-10 h-10 rounded-full object-cover bg-secondary" onError={(e) => ((e.currentTarget.style.display = "none"))}/>
                  : <div className="w-10 h-10 rounded-full bg-primary/20 grid place-items-center font-bold">{importing.symbol[0]}</div>}
                <div className="text-left flex-1 min-w-0">
                  <div className="font-semibold">{importing.symbol} <span className="text-xs font-normal text-muted-foreground">· {importing.decimals} decimals</span></div>
                  <div className="text-xs text-muted-foreground truncate">{importing.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono truncate">{importing.address}</div>
                </div>
              </div>
              <Input placeholder="Logo URL (optional, e.g. https://…/logo.png)" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="text-xs bg-card" />
              <div className="flex items-start gap-2 text-[11px] text-yellow-300/90 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>Anyone can create a token. Verify the contract address before trading. All on-chain actions (swap, liquidity) will work with this token.</span>
              </div>
              <Button onClick={confirmImport} className="w-full btn-primary-grad text-primary-foreground rounded-xl">
                Import {importing.symbol}
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between px-1 pt-1 text-[11px] text-muted-foreground">
            <span>Token</span>
            <span className="flex items-center gap-1">
              {loadingBals && <Loader2 className="w-3 h-3 animate-spin" />}
              Balance
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto -mx-2 px-2 space-y-1">
            {list.map(t => {
              const isCustom = custom.some(c => c.address.toLowerCase() === t.address.toLowerCase());
              const bal = balances[t.address];
              const hasBal = bal && Number(bal) > 0;
              return (
                <div key={t.address}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-primary/10 transition group cursor-pointer"
                  onClick={() => { onChange(t); setOpen(false); setQ(""); }}>
                  {t.logo ? <img src={t.logo} alt={t.symbol} className="w-8 h-8 rounded-full object-cover bg-secondary" onError={(e) => ((e.currentTarget.style.display = "none"))}/>
                          : <div className="w-8 h-8 rounded-full bg-primary/20 grid place-items-center font-bold">{t.symbol[0]}</div>}
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-semibold flex items-center gap-1.5">
                      {t.symbol}
                      {isCustom && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary">Custom</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{t.name}</div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    {account ? (
                      <span className={`text-sm font-semibold tabular-nums ${hasBal ? "text-foreground" : "text-muted-foreground/60"}`}>
                        {bal ?? (loadingBals ? "…" : "0")}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                    {isCustom && (
                      <button onClick={(e) => removeOne(t.address, e)} className="mt-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 text-destructive" aria-label="Remove">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!list.length && !importing && !fetching && (
              <p className="text-center text-sm text-muted-foreground py-8">
                {isAddress(q) ? "Reading token from chain…" : "No tokens found. Paste a contract address to import."}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
TokenSelect.displayName = "TokenSelect";

export default TokenSelect;
