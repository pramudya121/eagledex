# EAGLEDEX Subgraph (optional, for The Graph hosted/decentralized)

This folder is **siap-deploy** untuk The Graph kalau Integralayer testnet
nanti didukung sebagai network. Sementara ini, indexer utama EAGLEDEX
sudah pakai **Lovable Cloud (Postgres + edge function)** yang langsung jalan
tanpa deploy subgraph — lihat `supabase/functions/indexer/`.

## Files
- `subgraph.yaml` — manifest dengan Factory + Pair templates
- `schema.graphql` — entitas Pair / Swap / Mint / Burn / DayData
- `mappings/factory.ts` — handler PairCreated
- `mappings/pair.ts` — handler Swap / Mint / Burn / Sync
- `abis/` — copy ABI Factory.json, Pair.json, ERC20.json dari `src/lib/abis.ts`

## Deploy (kalau The Graph sudah support Integralayer)

```bash
npm i -g @graphprotocol/graph-cli
cd subgraph
graph codegen
graph build
graph deploy --studio eagledex
```

Update `network` di `subgraph.yaml` sesuai slug yang Studio assign untuk
chain Integralayer (chainId 26218). Saat ini The Graph **belum** support
Integralayer secara native, jadi opsi paling cepat: deploy ke
**self-hosted graph-node** + Integralayer RPC.

## Frontend integration

Setelah subgraph deployed, ganti `cloudIndex` query di `src/lib/cloudIndex.ts`
dengan GraphQL fetch ke endpoint subgraph kamu. Schema GraphQL persis
match dengan tabel Cloud, jadi switch-over nya minimal.
