// Global transaction store — history of all on-chain actions with status.
import { useEffect, useState } from "react";
import { explorerTx } from "./chain";

export type TxStatus = "pending" | "confirmed" | "failed";

export interface TxRecord {
  id: string;
  label: string;
  hash?: string;
  status: TxStatus;
  startedAt: number;
  endedAt?: number;
  blockNumber?: number;
  error?: string;
}

const KEY = "eagledex:txHistory";
const MAX = 50;

let listeners: Array<(list: TxRecord[]) => void> = [];

function load(): TxRecord[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function save(list: TxRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  listeners.forEach(fn => fn(list));
}

export const txStore = {
  list: () => load(),
  add(rec: Omit<TxRecord, "startedAt"> & { startedAt?: number }): TxRecord {
    const r: TxRecord = { startedAt: Date.now(), ...rec };
    save([r, ...load()]);
    return r;
  },
  update(id: string, patch: Partial<TxRecord>) {
    save(load().map(t => t.id === id ? { ...t, ...patch } : t));
  },
  clear() { save([]); },
  subscribe(fn: (list: TxRecord[]) => void) {
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
  },
};

export function useTxHistory() {
  const [list, setList] = useState<TxRecord[]>(() => txStore.list());
  useEffect(() => txStore.subscribe(setList), []);
  return list;
}

export const txExplorer = (hash?: string) => hash ? explorerTx(hash) : "#";
