import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCollectionLeaderboard, normalizeCollectionSearch } from "../lib/discovery";

test("search keeps unverified chains unknown until metadata confirms them", () => {
  const results = normalizeCollectionSearch({ results: [{ type: "collection", collection: { collection: "sample", name: "Sample" } }] });
  assert.equal(results[0].chain, "unknown");
  assert.equal(results[0].analyzable, false);
});

test("batch metadata identifies a supported chain and preserves supplied supply", () => {
  const results = normalizeCollectionLeaderboard({ collections: [{ collection: "sample", name: "Sample", contracts: [{ chain: "ape_chain" }], total_supply: 8888 }] });
  assert.equal(results[0].chain, "ape_chain");
  assert.equal(results[0].analyzable, true);
  assert.equal(results[0].supply, 8888);
});
