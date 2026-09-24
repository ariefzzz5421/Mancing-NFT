import { test } from "node:test";
import assert from "node:assert/strict";
import { getTerminalHref } from "../lib/collection-navigation";

test("collection navigation always opens the internal terminal", () => {
  assert.equal(getTerminalHref("pudgypenguins", "ethereum"), "/terminal/pudgypenguins");
  assert.equal(getTerminalHref("loopers", "base"), "/terminal/loopers?chain=base");
  assert.equal(getTerminalHref("goat-street", "robinhood"), "/terminal/goat-street?chain=robinhood");
  assert.equal(getTerminalHref("a/b", "ape_chain"), "/terminal/a%2Fb?chain=ape_chain");
});
