import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Swap as SwapEvent, Mint as MintEvent, Burn as BurnEvent, Sync as SyncEvent } from "../generated/templates/Pair/Pair";
import { Pair, Swap, Mint, Burn, DayData } from "../generated/schema";

const TEN = BigDecimal.fromString("10");

function pow10(d: i32): BigDecimal {
  let r = BigDecimal.fromString("1");
  for (let i = 0; i < d; i++) r = r.times(TEN);
  return r;
}

function toDec(v: BigInt, d: i32): BigDecimal {
  return v.toBigDecimal().div(pow10(d));
}

export function handleSync(e: SyncEvent): void {
  let p = Pair.load(e.address.toHexString());
  if (p == null) return;
  p.reserve0 = toDec(BigInt.fromI32(e.params.reserve0.toI32()), 18);
  p.reserve1 = toDec(BigInt.fromI32(e.params.reserve1.toI32()), 18);
  p.save();
}

export function handleSwap(e: SwapEvent): void {
  let p = Pair.load(e.address.toHexString());
  if (p == null) return;
  let id = e.transaction.hash.toHexString() + "-" + e.logIndex.toString();
  let s = new Swap(id);
  s.pair = p.id;
  s.sender = e.params.sender;
  s.to = e.params.to;
  s.amount0In = toDec(e.params.amount0In, 18);
  s.amount1In = toDec(e.params.amount1In, 18);
  s.amount0Out = toDec(e.params.amount0Out, 18);
  s.amount1Out = toDec(e.params.amount1Out, 18);
  s.blockNumber = e.block.number;
  s.timestamp = e.block.timestamp;
  s.transactionHash = e.transaction.hash;
  s.save();
  p.volumeToken0 = p.volumeToken0.plus(s.amount0In).plus(s.amount0Out);
  p.volumeToken1 = p.volumeToken1.plus(s.amount1In).plus(s.amount1Out);
  p.swapCount = p.swapCount.plus(BigInt.fromI32(1));
  p.save();

  // Daily aggregation
  let day = e.block.timestamp.toI32() / 86400;
  let did = p.id + "-" + day.toString();
  let dd = DayData.load(did);
  if (dd == null) {
    dd = new DayData(did);
    dd.pair = p.id; dd.date = day;
    dd.volumeToken0 = BigDecimal.zero();
    dd.volumeToken1 = BigDecimal.zero();
    dd.swapCount = BigInt.zero();
  }
  dd.volumeToken0 = dd.volumeToken0.plus(s.amount0In).plus(s.amount0Out);
  dd.volumeToken1 = dd.volumeToken1.plus(s.amount1In).plus(s.amount1Out);
  dd.swapCount = dd.swapCount.plus(BigInt.fromI32(1));
  dd.save();
}

export function handleMint(e: MintEvent): void {
  let p = Pair.load(e.address.toHexString());
  if (p == null) return;
  let id = e.transaction.hash.toHexString() + "-" + e.logIndex.toString();
  let m = new Mint(id);
  m.pair = p.id; m.sender = e.params.sender;
  m.amount0 = toDec(e.params.amount0, 18);
  m.amount1 = toDec(e.params.amount1, 18);
  m.blockNumber = e.block.number; m.timestamp = e.block.timestamp;
  m.transactionHash = e.transaction.hash;
  m.save();
}

export function handleBurn(e: BurnEvent): void {
  let p = Pair.load(e.address.toHexString());
  if (p == null) return;
  let id = e.transaction.hash.toHexString() + "-" + e.logIndex.toString();
  let b = new Burn(id);
  b.pair = p.id; b.sender = e.params.sender; b.to = e.params.to;
  b.amount0 = toDec(e.params.amount0, 18);
  b.amount1 = toDec(e.params.amount1, 18);
  b.blockNumber = e.block.number; b.timestamp = e.block.timestamp;
  b.transactionHash = e.transaction.hash;
  b.save();
}
