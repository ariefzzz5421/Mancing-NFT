import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchMarketPrices } from "../lib/server/market";

test("market feed joins live ZEC crypto pricing with S&P 500 index points", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("coingecko.com")) {
      assert.match(url, /zcash/);
      return Response.json({
        bitcoin: { usd: 85000, usd_24h_change: 1, last_updated_at: 1000 },
        zcash: { usd: 53.25, usd_24h_change: -2.5, last_updated_at: 1000 },
      });
    }
    assert.match(url, /finance\/chart\/\^GSPC/);
    return Response.json({ chart: { result: [{ meta: {
      regularMarketPrice: 7700,
      previousClose: 7600,
      regularMarketTime: 1000,
    } }] } });
  };
  try {
    const result = await fetchMarketPrices();
    assert.equal(result.assets.find((asset) => asset.symbol === "ZEC")?.priceUsd, 53.25);
    assert.equal(result.assets.find((asset) => asset.symbol === "SP500")?.priceUsd, 7700);
    assert.equal(result.assets.find((asset) => asset.symbol === "SP500")?.source, "yahoo");
    assert.ok((result.assets.find((asset) => asset.symbol === "SP500")?.change24h ?? 0) > 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
