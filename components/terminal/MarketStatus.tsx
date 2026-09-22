"use client";
import { useEffect, useState } from "react";
import type { Health } from "@/types/market";
export function MarketStatus() {
  const [health, setHealth] = useState<Health | null>(null),
    [eth, setEth] = useState<number | null>(null),
    [gas, setGas] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      if (document.hidden) return;
      const results = await Promise.allSettled([
        fetch("/api/health").then((r) => r.json()),
        fetch("/api/market/prices").then((r) => r.json()),
        fetch("/api/network").then((r) => r.json()),
      ]);
      if (!active) return;
      if (results[0].status === "fulfilled") setHealth(results[0].value);
      if (results[1].status === "fulfilled")
        setEth(
          results[1].value.assets?.find(
            (a: { symbol: string }) => a.symbol === "ETH",
          )?.priceUsd || null,
        );
      if (results[2].status === "fulfilled") setGas(results[2].value.gasGwei);
    }
    void load();
    const id = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);
  return (
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
  );
}
