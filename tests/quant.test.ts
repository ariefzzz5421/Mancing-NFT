import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  spread,
  edge,
  sweep,
  liquidity,
  wei,
  eth,
} from "../lib/quant/book";
import { normalizeOrder } from "../lib/opensea/normalize";
import type { NormalizedOrder } from "../types/market";
const order = (
  side: "bid" | "ask",
  price: string,
  quantity = 1,
  id = price,
): NormalizedOrder => ({
  orderHash: id,
  side,
  priceWei: wei(price)!.toString(),
  quantity,
  maker: "0x1",
  expiration: 9999999999,
  created: 1,
  scope: "collection",
  protocol: "seaport",
});
test("aggregates identical price levels, preserves exact wei and cumulative quantities", () => {
  const r = aggregate(
    [
      order("ask", "0.013", 2, "a"),
      order("ask", "0.013", 3, "b"),
      order("ask", "0.014"),
    ],
    "ask",
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].quantity, 5);
  assert.equal(r[1].cumulativeQuantity, 6);
  assert.equal(eth(r[1].cumulativeValueWei), "0.079");
});
test("bids sort descending; tick buckets never improve apparent executable price", () => {
  const bid = aggregate(
    [order("bid", "0.01325"), order("bid", "0.014")],
    "bid",
    wei("0.001")!,
  );
  assert.equal(eth(bid[0].priceWei), "0.014");
  assert.equal(eth(bid[1].priceWei), "0.013");
  const ask = aggregate([order("ask", "0.01325")], "ask", wei("0.001")!);
  assert.equal(eth(ask[0].priceWei), "0.014");
  assert.equal(eth(ask[0].valueWei), "0.01325");
});
test("spread uses bid denominator, handles crossed and missing books", () => {
  const s = spread(wei("0.013")!.toString(), wei("0.0145")!.toString())!;
  assert.equal(eth(s.absolute), "0.0015");
  assert.equal(s.bps, 1154);
  assert.equal(spread("0", "2"), null);
  assert.ok(spread("2", "1")!.bps < 0);
});
test("edge subtracts all friction across quantity and gas once", () => {
  const e = edge(
    wei("0.013")!,
    wei("0.0145")!,
    2,
    100,
    500,
    wei("0.0005")!,
    50,
  )!;
  assert.equal(eth(e.capital), "0.026");
  assert.equal(eth(e.net), "0.000615");
  assert.equal(e.roiBps, 236);
  assert.equal(edge(1n, 1n, 0, 0, 0, 0n, 0), null);
  assert.equal(edge(1n, 1n, 1, -1, 0, 0n, 0), null);
});
test("sweep stops below target and reports actual next ask", () => {
  const b = aggregate(
    [order("ask", "0.013", 2), order("ask", "0.014"), order("ask", "0.016")],
    "ask",
  );
  const s = sweep(b, wei("0.015")!, true);
  assert.equal(s.quantity, 3);
  assert.equal(eth(s.capital), "0.04");
  assert.equal(eth(s.next), "0.016");
  assert.equal(liquidity(b, "ask").qty, 4);
  assert.equal(sweep(b, wei("1")!, false).complete, false);
});
test("rejects invalid decimal inputs, preserves 18-digit signing precision", () => {
  assert.equal(wei("1e-3"), null);
  assert.equal(wei("-1"), null);
  assert.equal(eth(wei("0.000000000000000001")), "0.000000000000000001");
});
const raw = {
  chain: "ethereum",
  status: "ACTIVE",
  order_hash: "0xabc",
  remaining_quantity: 1,
  price: { currency: "WETH", decimals: 18, value: "13000000000000000" },
  protocol_data: {
    parameters: {
      startTime: "1",
      endTime: "2000",
      offerer: "0x1",
      offer: [
        {
          itemType: 1,
          token: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          startAmount: "13000000000000000",
          endAmount: "13000000000000000",
        },
      ],
      consideration: [
        {
          itemType: 4,
          startAmount: "1",
          endAmount: "1",
          identifierOrCriteria: "0",
        },
      ],
    },
  },
};
test("normalizer rejects expired, inactive, trait bids, wrong chain and currency", () => {
  assert.ok(normalizeOrder(raw, "bid", 100));
  assert.equal(normalizeOrder(raw, "bid", 2000), null);
  assert.equal(
    normalizeOrder({ ...raw, status: "CANCELLED" }, "bid", 100),
    null,
  );
  assert.equal(normalizeOrder({ ...raw, chain: "base" }, "bid", 100), null);
  assert.equal(
    normalizeOrder(
      { ...raw, criteria: { traits: [{ type: "Hat" }] } },
      "bid",
      100,
    ),
    null,
  );
  assert.equal(
    normalizeOrder(
      { ...raw, price: { ...raw.price, currency: "USDC" } },
      "bid",
      100,
    ),
    null,
  );
});
test("partially filled collection offer divides original total by original NFT quantity", () => {
  const multi = structuredClone(raw);
  multi.remaining_quantity = 2;
  multi.protocol_data.parameters.offer[0].startAmount = "39000000000000000";
  multi.protocol_data.parameters.offer[0].endAmount = "39000000000000000";
  multi.protocol_data.parameters.consideration[0].startAmount = "3";
  multi.protocol_data.parameters.consideration[0].endAmount = "3";
  const n = normalizeOrder(multi, "bid", 100)!;
  assert.equal(n.priceWei, "13000000000000000");
  assert.equal(n.quantity, 2);
  assert.equal(eth(aggregate([n], "bid")[0].valueWei), "0.026");
});
test("nonzero criteria root is not treated as a universally fillable collection bid", () => {
  const n = structuredClone(raw);
  n.protocol_data.parameters.consideration[0].identifierOrCriteria = "1234";
  assert.equal(normalizeOrder(n, "bid", 100), null);
});
test("spoofed WETH symbol cannot admit another ERC20", () => {
  const n = structuredClone(raw);
  n.protocol_data.parameters.offer[0].token =
    "0x0000000000000000000000000000000000000001";
  assert.equal(normalizeOrder(n, "bid", 100), null);
});
