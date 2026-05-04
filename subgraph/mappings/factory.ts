import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { PairCreated } from "../generated/Factory/Factory";
import { Pair, Token } from "../generated/schema";
import { Pair as PairTemplate } from "../generated/templates";
import { ERC20 } from "../generated/Factory/ERC20";

function loadOrCreateToken(addr: Address): Token {
  let id = addr.toHexString();
  let t = Token.load(id);
  if (t == null) {
    t = new Token(id);
    let c = ERC20.bind(addr);
    let sym = c.try_symbol();
    let nm = c.try_name();
    let dec = c.try_decimals();
    let sup = c.try_totalSupply();
    t.symbol = sym.reverted ? "?" : sym.value;
    t.name = nm.reverted ? "?" : nm.value;
    t.decimals = dec.reverted ? BigInt.fromI32(18) : BigInt.fromI32(dec.value);
    t.totalSupply = sup.reverted ? BigInt.zero() : sup.value;
    t.save();
  }
  return t as Token;
}

export function handlePairCreated(event: PairCreated): void {
  let t0 = loadOrCreateToken(event.params.token0);
  let t1 = loadOrCreateToken(event.params.token1);
  let id = event.params.pair.toHexString();
  let p = new Pair(id);
  p.token0 = t0.id;
  p.token1 = t1.id;
  p.reserve0 = BigDecimal.zero();
  p.reserve1 = BigDecimal.zero();
  p.totalSupply = BigDecimal.zero();
  p.volumeToken0 = BigDecimal.zero();
  p.volumeToken1 = BigDecimal.zero();
  p.swapCount = BigInt.zero();
  p.createdAtBlock = event.block.number;
  p.createdAtTimestamp = event.block.timestamp;
  p.save();
  PairTemplate.create(event.params.pair);
}
