import assert from "node:assert/strict";
import test from "node:test";
import { canAdvanceFlip } from "../lib/flip-flop/state";

test("Flip Flop requires review, confirmed inventory, and signed listing stages", () => {
  assert.equal(canAdvanceFlip("IDLE", "OFFER_PREPARED"), true);
  assert.equal(canAdvanceFlip("OFFER_ACTIVE", "FILLED"), true);
  assert.equal(canAdvanceFlip("FILLED", "INVENTORY"), true);
  assert.equal(canAdvanceFlip("INVENTORY", "LIST_ACTIVE"), false);
  assert.equal(canAdvanceFlip("LIST_PREPARED", "LIST_ACTIVE"), true);
  assert.equal(canAdvanceFlip("LIST_ACTIVE", "SOLD"), true);
  assert.equal(canAdvanceFlip("OFFER_ACTIVE", "SOLD"), false);
  assert.equal(canAdvanceFlip("CANCELLED", "INVENTORY"), false);
});
