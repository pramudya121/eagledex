import { toast } from "sonner";
import { explorerTx } from "./chain";
import { txStore } from "./txStore";
import { ensureChainGlobal } from "./web3";

export async function sendTx<T extends { hash: string; wait: () => Promise<any> }>(label: string, fn: () => Promise<T>) {
  const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  // Stage 0: ensure correct chain. We do this BEFORE creating any toast so the
  // user sees a single clear error if they're on the wrong network, instead of
  // a confusing "pending → failed" flow.
  try {
    await ensureChainGlobal();
  } catch (e: any) {
    const msg = e?.shortMessage || e?.message || String(e);
    toast.error("Wrong network", { description: msg });
    throw e;
  }
  // Stage 1: awaiting wallet signature
  txStore.add({ id, label, status: "pending" });
  toast.loading(`${label}: confirm in wallet…`, { id });
  try {
    const tx = await fn();
    // Stage 2: pending on-chain
    txStore.update(id, { hash: tx.hash, status: "pending" });
    toast.loading(`${label}: pending on-chain…`, {
      id,
      description: `${tx.hash.slice(0, 10)}…`,
      action: { label: "View", onClick: () => window.open(explorerTx(tx.hash), "_blank") },
    });
    const rc = await tx.wait();
    const ok = rc?.status === 1 || rc?.status === undefined;
    if (!ok) {
      txStore.update(id, { status: "failed", endedAt: Date.now(), blockNumber: rc?.blockNumber, error: "Reverted on-chain" });
      toast.error(`${label} reverted`, { id, description: `Block ${rc?.blockNumber ?? ""}`, action: { label: "Tx", onClick: () => window.open(explorerTx(tx.hash), "_blank") } });
      throw new Error("Transaction reverted");
    }
    // Stage 3: confirmed
    txStore.update(id, { status: "confirmed", endedAt: Date.now(), blockNumber: rc?.blockNumber });
    toast.success(`${label} confirmed`, {
      id,
      description: `Block ${rc?.blockNumber ?? ""}`,
      action: { label: "Tx", onClick: () => window.open(explorerTx(tx.hash), "_blank") },
    });
    return rc;
  } catch (e: any) {
    const msg = e?.shortMessage || e?.reason || e?.message || String(e);
    txStore.update(id, { status: "failed", endedAt: Date.now(), error: msg });
    toast.error(`${label} failed`, { id, description: msg });
    throw e;
  }
}
