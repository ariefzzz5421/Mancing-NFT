"use client";
import { useEffect, useState } from "react";
import type { Health } from "@/types/market";
import type { MarketPricesResponse } from "@/lib/types";
import { TokenLogo } from "@/components/TokenLogo";
export function MarketStatus() {
  const [health, setHealth] = useState<Health | null>(null),
    [prices, setPrices] = useState<MarketPricesResponse | null>(null),
    [gas, setGas] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      if (document.hidden) return;
      void fetch("/api/health").then((r) => r.json()).then((value: Health) => { if (active) setHealth(value); }).catch(() => {});
      void fetch("/api/market/prices").then((r) => r.json()).then((value: MarketPricesResponse) => { if (active) setPrices(value); }).catch(() => {});
      void fetch("/api/network").then((r) => r.json()).then((value: { gasGwei: string | null }) => { if (active) setGas(value.gasGwei); }).catch(() => {});
    }
    void load();
    const id = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);
  const eth = prices?.assets.find((asset) => asset.symbol === "ETH")?.priceUsd ?? null;
  return (<>
    <div className="major-prices" aria-label="Major crypto prices in USD">
      {(["BTC", "ETH", "HYPE", "SOL", "BNB", "APE"] as const).map((symbol) => {
        const asset = prices?.assets.find((item) => item.symbol === symbol);
        return <div className="major-price" key={symbol} title={asset?.lastUpdated ? `Source: ${asset.source} · updated ${new Date(asset.lastUpdated).toLocaleTimeString()}` : "Price unavailable"}>
          <TokenLogo symbol={symbol} className="major-price__logo" />
          <span>{symbol}</span><strong>{asset?.priceUsd ? `$${asset.priceUsd.toLocaleString("en-US", { maximumFractionDigits: asset.priceUsd < 1 ? 4 : 2 })}` : "—"}</strong>
          {asset?.change24h != null && <small className={asset.change24h >= 0 ? "positive" : "negative"}>{asset.change24h >= 0 ? "+" : ""}{asset.change24h.toFixed(2)}%</small>}
        </div>;
      })}
    </div>
    <div className="market-status">
      <span>
        ETH{" "}
        <b>
          {eth
            ? `$${eth.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
            : "Unavailable"}
        </b>
      </span>
      <span>
        GAS <b>{gas ? `${gas} gwei` : "Unavailable"}</b>
      </span>
      <span
        className={
          health?.state === "Operational" ? "positive" : "status-warning"
        }
      >
        ● OpenSea {health?.state ?? "Checking…"}
      </span>
      <span>
        NETWORK <b>Ethereum</b>
      </span>
      <span className="status-time">
        LAST CHECK{" "}
        <b>
          {health?.updatedAt
            ? new Date(health.updatedAt).toLocaleTimeString()
            : "—"}
        </b>
      </span>
    </div>
  </>);
}
