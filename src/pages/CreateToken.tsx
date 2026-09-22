import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { formatEther } from "ethers";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, Loader2, Rocket } from "lucide-react";
import Seo from "@/components/Seo";
import { useWeb3 } from "@/lib/web3";
import { sendTx } from "@/lib/tx";
import { INTEGRALAYER as CHAIN } from "@/lib/chain";
import {
  getLaunchFactory, launchpadEnabled, readCreationFee, saveLaunchToken, uploadLogo, NATIVE_SYMBOL,
} from "@/lib/launchpad";

const CreateToken = () => {
  const { account, signer, readProvider, connect } = useWeb3();
  const nav = useNavigate();
  const [fee, setFee] = useState<bigint>(0n);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", symbol: "", description: "", website: "", twitter: "", telegram: "" });
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => { readCreationFee(readProvider as never).then(setFee).catch(() => {}); }, [readProvider]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }));

  const pickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo too large", { description: "Max 2 MB." }); return; }
    setLogo(file);
    setPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    if (!account || !signer) { connect(); return; }
    const name = f.name.trim(), symbol = f.symbol.trim().toUpperCase();
    if (name.length < 2) { toast.error("Name is required"); return; }
    if (symbol.length < 2 || symbol.length > 12) { toast.error("Symbol must be 2–12 characters"); return; }
    setBusy(true);
    try {
      const factory = getLaunchFactory(signer as never);
      const rc = await sendTx(`Launch ${symbol}`, () => factory.createToken(name, symbol, { value: fee }));

      // Pull token + curve from the TokenLaunched event.
      let token = "", curve = "";
      for (const log of (rc as unknown as { logs?: { topics: string[]; data: string }[] })?.logs ?? []) {
        try {
          const parsed = factory.interface.parseLog(log as never);
          if (parsed?.name === "TokenLaunched") { token = parsed.args[0] as string; curve = parsed.args[1] as string; break; }
        } catch { /* not our event */ }
      }
      if (!token) {
        toast.success("Token launched", { description: "Opening the Launchpad — your token appears once indexed." });
        nav("/launchpad"); return;
      }

      let logo_path: string | null = null;
      if (logo) { try { logo_path = await uploadLogo(logo, symbol); } catch { toast.error("Logo upload failed", { description: "Token launched without a logo." }); } }

      try {
        await saveLaunchToken({
          token_address: token.toLowerCase(), curve_address: curve || null, creator: account.toLowerCase(),
          name, symbol, description: f.description.trim() || null, logo_path,
          website: f.website.trim() || null, twitter: f.twitter.trim() || null, telegram: f.telegram.trim() || null,
          tx_hash: (rc as unknown as { hash?: string })?.hash,
        });
      } catch { /* on-chain launch already succeeded */ }

      toast.success(`${symbol} is live!`);
      nav(`/launchpad/${token}`);
    } catch (e: unknown) {
      const msg = (e as { shortMessage?: string; message?: string })?.shortMessage
        ?? (e as { message?: string })?.message ?? "Transaction failed";
      if (!/reverted|rejected|Wrong network/i.test(msg)) toast.error("Launch failed", { description: msg });
    } finally { setBusy(false); }
  };

  if (!launchpadEnabled()) {
    return <div className="max-w-xl mx-auto glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
      No launchpad contracts configured for {CHAIN.name}.
    </div>;
  }

  return (
    <div className="max-w-2xl mx-auto animate-slide-up neon-scope">
      <Seo title="Create a token — EAGLEDEX Launchpad"
        description={`Launch your own bonding-curve token on ${CHAIN.name} in a single transaction.`}
        path="/launchpad/create" />
      <Link to="/launchpad" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Launchpad
      </Link>

      <div className="glass rounded-3xl p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl btn-primary-grad grid place-items-center">
            <Rocket className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">Create Token</h1>
            <p className="text-xs text-muted-foreground">
              Creation fee: <b>{formatEther(fee)} {NATIVE_SYMBOL}</b> · liquidity starts on the bonding curve
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="w-20 h-20 rounded-2xl border border-dashed border-border grid place-items-center cursor-pointer hover:border-primary/60 overflow-hidden shrink-0">
            {preview
              ? <img src={preview} alt="Token logo preview" className="w-full h-full object-cover" />
              : <ImagePlus className="w-6 h-6 text-muted-foreground" />}
            <input type="file" accept="image/*" className="hidden" onChange={pickLogo} />
          </label>
          <div className="text-xs text-muted-foreground">Square logo, PNG or JPG, max 2 MB. Optional but strongly recommended.</div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Token name *" value={f.name} onChange={set("name")} placeholder="Eagle Doge" />
          <Field label="Symbol *" value={f.symbol} onChange={set("symbol")} placeholder="EDOGE" />
        </div>
        <div>
          <div className="text-xs font-bold mb-1.5">Description</div>
          <textarea value={f.description} onChange={set("description")} rows={3} maxLength={400}
            placeholder="What is your token about?"
            className="w-full rounded-2xl bg-card border border-border p-3 text-sm outline-none focus:border-primary/60" />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Website" value={f.website} onChange={set("website")} placeholder="https://" />
          <Field label="Twitter / X" value={f.twitter} onChange={set("twitter")} placeholder="https://x.com/…" />
          <Field label="Telegram" value={f.telegram} onChange={set("telegram")} placeholder="https://t.me/…" />
        </div>

        <button onClick={submit} disabled={busy}
          className="w-full h-13 py-3.5 rounded-2xl btn-primary-grad text-primary-foreground font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Launching…</>
                : account ? <><Rocket className="w-4 h-4" /> Launch token</> : "Connect wallet"}
        </button>
        <p className="text-[11px] text-muted-foreground text-center">
          Token and its bonding curve are deployed on-chain by the Launchpad factory. Metadata is stored off-chain and can't change the contract.
        </p>
      </div>
    </div>
  );
};

const Field = ({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <label className="block">
    <div className="text-xs font-bold mb-1.5">{label}</div>
    <input {...rest} className="w-full h-11 px-3 rounded-2xl bg-card border border-border text-sm outline-none focus:border-primary/60" />
  </label>
);

export default CreateToken;
