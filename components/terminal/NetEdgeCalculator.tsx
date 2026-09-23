"use client";
import { useState, useEffect } from "react";
import { edge, eth, wei, spread } from "@/lib/quant/book";
export function NetEdgeCalculator({
  entry,
  exit,
  quantity,
  ethUsd,
}: {
  entry: string;
  exit: string;
  quantity: number;
  ethUsd: number | null;
}) {
  const [fee, setFee] = useState("1");
  const [royalty, setRoyalty] = useState("0");
  const [gas, setGas] = useState("0.0005");
  const [slippage, setSlippage] = useState("0.5");
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("mancing-preferences") ?? "{}");
      if (p.slippage != null)
        queueMicrotask(() => setSlippage(String(p.slippage)));
    } catch {}
  }, []);
  const e = wei(entry),
    x = wei(exit),
    g = wei(gas);
  const valid = [fee, royalty, slippage].every((v) =>
    /^\d+(\.\d{1,2})?$/.test(v),
  );
  const result =
    e != null && x != null && g != null && valid
      ? edge(
          e,
          x,
          quantity,
          Math.round(Number(fee) * 100),
          Math.round(Number(royalty) * 100),
          g,
          Math.round(Number(slippage) * 100),
        )
      : null;
  const gross = e && x ? spread(e.toString(), x.toString()) : null;
  const grossValue = gross && Number.isSafeInteger(quantity) && quantity > 0 ? gross.absolute * BigInt(quantity) : null;
  const usd = (value: bigint | null | undefined) => value != null && ethUsd ? `≈ $${((Number(value) / 1e18) * ethUsd).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "USD —";
  return (
    <section className="t-panel">
      <div className="panel-title">
        <span>NET EDGE</span>
        <span className="estimate-tag">ESTIMATE</span>
      </div>
      <div className="calculator-inputs">
        {[
          ["Marketplace fee %", fee, setFee],
          ["Creator royalty %", royalty, setRoyalty],
          ["Round-trip gas / ETH", gas, setGas],
          ["Slippage %", slippage, setSlippage],
        ].map(([label, value, set]) => (
          <label key={String(label)}>
            {String(label)}
            <input
              inputMode="decimal"
              value={String(value)}
              onChange={(e) => (set as (s: string) => void)(e.target.value)}
            />
          </label>
        ))}
      </div>
      <dl className="metric-list">
        <div>
          <dt>Gross spread before costs</dt>
          <dd>{gross ? `${(gross.bps / 100).toFixed(2)}%` : "—"}<small className="execution-usd">{grossValue === null ? "—" : `${eth(grossValue)} ETH · ${usd(grossValue)}`}</small></dd>
        </div>
        <div>
          <dt>Entry / offer</dt>
          <dd>{entry || "—"} ETH<small className="execution-usd">{usd(e)}</small></dd>
        </div>
        <div>
          <dt>Expected exit / listing</dt>
          <dd>{exit || "—"} ETH<small className="execution-usd">{usd(x)}</small></dd>
        </div>
        <div>
          <dt>Required capital</dt>
          <dd>{eth(result?.capital)} ETH<small className="execution-usd">{usd(result?.capital)}</small></dd>
        </div>
        <div>
          <dt>Estimated net proceeds</dt>
          <dd>{eth(result?.proceeds)} ETH<small className="execution-usd">{usd(result?.proceeds)}</small></dd>
        </div>
      </dl>
      <div className="edge-result">
        <span>ESTIMATED NET EDGE</span>
        <strong
          className={result && result.net >= 0n ? "positive" : "negative"}
        >
          {result ? `${(result.roiBps / 100).toFixed(2)}%` : "—"}
        </strong>
        <span>{eth(result?.net)} ETH <small className="execution-usd">{usd(result?.net)}</small></span>
      </div>
      <p className="t-note">
        Editable cost assumptions, not a fee quote. Includes {quantity} NFT
        {quantity === 1 ? "" : "s"}. A listing price is not an executable exit;
        offer fills and resale are uncertain.
      </p>
    </section>
  );
}
