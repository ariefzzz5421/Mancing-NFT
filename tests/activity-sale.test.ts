import assert from "node:assert/strict";
import test from "node:test";
import { normalizeActivityEvent } from "../lib/activity";

test("current OpenSea sale fields retain the transfer proof needed by Flip Flop", () => {
  const event = normalizeActivityEvent({
    event_type: "sale",
    event_timestamp: 1_700_000_000,
    transaction: `0x${"a".repeat(64)}`,
    order_hash: `0x${"b".repeat(64)}`,
    buyer: `0x${"c".repeat(40)}`,
    seller: `0x${"d".repeat(40)}`,
    nft: { identifier: "1234" },
    payment: { quantity: "13000000000000000", decimals: 18, symbol: "WETH" },
  });

  assert.equal(event.eventType, "sale");
  assert.equal(event.txHash, `0x${"a".repeat(64)}`);
  assert.equal(event.orderHash, `0x${"b".repeat(64)}`);
  assert.equal(event.buyer, `0x${"c".repeat(40)}`);
  assert.equal(event.seller, `0x${"d".repeat(40)}`);
  assert.equal(event.tokenId, "1234");
  assert.equal(event.priceEth, 0.013);
});
