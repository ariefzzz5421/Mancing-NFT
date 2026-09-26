import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMarketBookGroups, normalizeMarketBookOrder } from "../lib/opensea/read-only-book";

const now = 1_800_000_000;

test("Robinhood USDG listings retain six-decimal quote and aggregate at price levels", () => {
  const raw = (id: string) => ({ chain: "robinhood", status: "ACTIVE", remaining_quantity: 1, order_hash: id, price: { current: { currency: "USDG", decimals: 6, value: "780000" } }, protocol_data: { parameters: { startTime: "1", endTime: "2000000000", offer: [{ itemType: 2, startAmount: "1", endAmount: "1", identifierOrCriteria: id }] } } });
  const a = normalizeMarketBookOrder(raw("1"), "ask", "robinhood", now);
  const b = normalizeMarketBookOrder(raw("2"), "ask", "robinhood", now);
  assert.ok(a && b);
  const group = buildMarketBookGroups([a, b])[0];
  assert.equal(group.currency, "USDG");
  assert.equal(group.decimals, 6);
  assert.equal(group.asks[0].quantity, 2);
  assert.equal(group.asks[0].valueUnits, "1560000");
});

test("Solana token-specific offers are labeled as non-collection bids", () => {
  const offer = normalizeMarketBookOrder({ chain: "solana", status: "ACTIVE", remaining_quantity: 1, svm_order: { id: "sol-offer" }, asset: { identifier: "123" }, price: { currency: "USDC", decimals: 6, value: "2000000" } }, "bid", "solana", now);
  assert.ok(offer);
  const group = buildMarketBookGroups([offer])[0];
  assert.equal(group.bidScope, "token");
  assert.equal(group.bids[0].priceUnits, "2000000");
});
