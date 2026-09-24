"use client";

import { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { TokenLogo } from "@/components/TokenLogo";
import { formatNumber } from "@/lib/format";
import type { MarketAssetPrice, MarketPricesResponse } from "@/lib/types";

function AnimatedNumber({ value, isIndex = false }: { value: number; isIndex?: boolean }) {
  const [displayValue, setDisplayValue] = useState(value);
  const displayRef = useRef(value);

  useEffect(() => {
    const startValue = displayRef.current;
    const delta = value - startValue;
    const duration = 1200;
    const startedAt = performance.now();
    let frame = 0;

    function tick(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const nextValue = startValue + delta * progress;
      displayRef.current = nextValue;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span>{isIndex ? "" : "$"}{formatNumber(displayValue, 2)}{isIndex ? " pts" : ""}</span>;
}

function PricePill({ asset }: { asset: MarketAssetPrice }) {
  const positive = (asset.change24h ?? 0) >= 0;
  const hasPrice = asset.priceUsd > 0;

  return (
    <div className="market-quote">
      <TokenLogo className="h-5 w-5" symbol={asset.symbol} />
      <span className="font-semibold text-slate-100">{asset.symbol === "SP500" ? "S&P 500" : asset.symbol}</span>
      <span className="font-mono text-cyan-100 tabular-nums">
        {hasPrice ? <AnimatedNumber value={asset.priceUsd} isIndex={asset.symbol === "SP500"} /> : "Unavailable"}
      </span>
      {hasPrice && asset.change24h !== null ? (
        <span className={`font-mono text-xs ${positive ? "text-emerald-300" : "text-red-300"}`}>
          {positive ? "+" : ""}
          {formatNumber(asset.change24h, 2)}%
        </span>
      ) : null}
    </div>
  );
}

export function MarketTicker() {
  const [prices, setPrices] = useState<MarketPricesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPrices() {
      try {
        const response = await fetch("/api/market/prices");
        const payload = (await response.json()) as MarketPricesResponse;

        if (!cancelled) {
          setPrices(payload);
        }
      } catch {
        if (!cancelled) {
          setPrices(null);
        }
      }
    }

    void loadPrices();
    const interval = window.setInterval(loadPrices, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const assets = prices?.assets ?? [];
  const tickerLabel = assets.length
    ? assets.map((asset) => asset.symbol).join("/")
    : "BTC/ETH/APE/HYPE/BNB/SOL/ZEC/S&P 500";

  return (
    <div className="market-strip">
      <div className="market-strip__inner">
        <div className="market-strip__label">
          <Activity size={14} aria-hidden="true" />
          Market
        </div>
        <div
          aria-label={`Running prices for ${tickerLabel}`}
          className="market-strip__tape"
        >
          <div className="price-tape-track flex w-max gap-6 hover:[animation-play-state:paused]">
            {assets.length > 0 ? (
              assets.map((asset) => <PricePill asset={asset} key={asset.symbol} />)
            ) : (
              <div className="market-strip__loading">
                Loading BTC/ETH/APE/HYPE/BNB/SOL/ZEC/S&P 500 prices...
              </div>
            )}
          </div>
        </div>
        {prices ? (
          <span className="market-strip__source">
            source: {prices.source}
          </span>
        ) : null}
      </div>
    </div>
  );
}
