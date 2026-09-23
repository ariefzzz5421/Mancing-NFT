"use client";

import { useEffect, useState } from "react";
import type { MarketPricesResponse, MarketSymbol } from "@/lib/types";

let cachedMarketPrices: MarketPricesResponse | null = null;
let marketPricesExpires = 0;
let marketPricesRequest: Promise<MarketPricesResponse> | null = null;
async function getMarketPrices() {
  if (cachedMarketPrices && Date.now() < marketPricesExpires) return cachedMarketPrices;
  if (!marketPricesRequest) marketPricesRequest = fetch("/api/market/prices")
    .then(async (response) => { if (!response.ok) throw Error("Market prices unavailable"); return response.json() as Promise<MarketPricesResponse>; })
    .then((data) => { cachedMarketPrices = data; marketPricesExpires = Date.now() + 55_000; return data; })
    .finally(() => { marketPricesRequest = null; });
  return marketPricesRequest;
}

type LiveEthPrice = {
  lastUpdated: string | null;
  loading: boolean;
  priceUsd: number | null;
  source: string;
};

function readAssetPrice(payload: MarketPricesResponse, symbol: MarketSymbol) {
  return payload.assets.find((asset) => asset.symbol === symbol && asset.priceUsd > 0) ?? null;
}

export function useLiveAssetPrice(
  symbol: MarketSymbol,
  initialPriceUsd: number | null | undefined = null,
) {
  const [price, setPrice] = useState<LiveEthPrice>({
    lastUpdated: null,
    loading: true,
    priceUsd:
      typeof initialPriceUsd === "number" && Number.isFinite(initialPriceUsd) && initialPriceUsd > 0
        ? initialPriceUsd
        : null,
    source: "loading",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadPrice() {
      try {
        if (document.hidden) return;
        const payload = await getMarketPrices();
        const asset = readAssetPrice(payload, symbol);

        if (cancelled) {
          return;
        }

        setPrice((current) => ({
          lastUpdated: asset?.lastUpdated ?? payload.lastUpdated ?? current.lastUpdated,
          loading: false,
          priceUsd: asset?.priceUsd ?? current.priceUsd,
          source: asset?.source ?? payload.source ?? current.source,
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setPrice((current) => ({
          ...current,
          loading: false,
          source: current.priceUsd ? "fallback" : "unavailable",
        }));
      }
    }

    void loadPrice();
    const interval = window.setInterval(loadPrice, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [symbol]);

  return price;
}

export function useLiveEthPrice(initialPriceUsd: number | null | undefined = null) {
  return useLiveAssetPrice("ETH", initialPriceUsd);
}
