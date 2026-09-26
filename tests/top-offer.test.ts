import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEther } from "viem";
import { topOfferPrice } from "../lib/quant/top-offer";

test("top offer rises by one meaningful decimal tick", () => {
  assert.equal(topOfferPrice(parseEther("0.011"), parseEther("0.013"))?.priceEth, "0.0111");
  assert.equal(topOfferPrice(parseEther("0.0002"), parseEther("0.0005"))?.priceEth, "0.0003");
  assert.equal(topOfferPrice(parseEther("0.01325"))?.priceEth, "0.01326");
});

test("top offer refuses to cross the best ask", () => {
  assert.equal(topOfferPrice(parseEther("0.0002"), parseEther("0.0003")), null);
});
