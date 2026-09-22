"use client";
import { useState } from "react";
import type { Book } from "@/types/market";
import { sweep, wei, eth, liquidity } from "@/lib/quant/book";
export function SweepCalculator({ book }: { book: Book | null }) {
  const [target, setTarget] = useState("");
  const t = wei(target);
  const s =
    book && !book.errors.length && t
      ? sweep(book.asks, t, book.complete)
      : null;
  return (
    <section className="t-panel">
      <div className="panel-title">SWEEP TO TARGET</div>
      <label className="t-field">
        Target floor / ETH
        <input
          value={target}
          inputMode="decimal"
          placeholder="0.016"
          onChange={(e) => setTarget(e.target.value)}
        />
      </label>
      <dl className="metric-list">
        {[
          ["NFTs to purchase", s?.quantity ?? "—"],
          ["Capital required", eth(s?.capital)],
          ["Average purchase", eth(s?.average)],
          ["Highest execution", eth(s?.highest)],
          ["Theoretical next floor", eth(s?.next)],
        ].map(([l, v]) => (
          <div key={l}>
            <dt>{l}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="t-note">
        {book?.complete
          ? "Snapshot estimate; fees, gas and competing buyers excluded."
          : "Incomplete snapshot: quantity and capital are lower bounds. The resulting floor is not established."}
      </p>
    </section>
  );
}
export function LiquidityPanel({ book }: { book: Book | null }) {
  const b = liquidity(book?.bids ?? [], "bid"),
    a = liquidity(book?.asks ?? [], "ask"),
    total = b.total + a.total;
  return (
    <section className="t-panel">
      <div className="panel-title">LIQUIDITY / SNAPSHOT</div>
      <dl className="metric-list">
        {[
          ["Bid liquidity", book && !book.errors.length ? eth(b.total) : "—"],
          ["Ask liquidity", book && !book.errors.length ? eth(a.total) : "—"],
          ["Weighted bid", eth(b.average)],
          ["Weighted ask", eth(a.average)],
          [
            "Active bids / listings",
            book && !book.errors.length
              ? `${book.orders.filter((o) => o.side === "bid").length} / ${book.orders.filter((o) => o.side === "ask").length}`
              : "—",
          ],
          [
            "Imbalance",
            total && book?.complete
              ? `${(Number(((b.total - a.total) * 10000n) / total) / 100).toFixed(2)}%`
              : "—",
          ],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="depth-bands">
        <span>Distance</span>
        <span className="positive">Bid qty</span>
        <span className="negative">Ask qty</span>
        {b.bands.map((band, i) => (
          <div className="depth-band" key={band.percent}>
            <span>±{band.percent}%</span>
            <span>{book && !book.errors.length ? band.quantity : "—"}</span>
            <span>
              {book && !book.errors.length ? a.bands[i].quantity : "—"}
            </span>
          </div>
        ))}
      </div>
      <p className="t-note">
        Distances are measured from each side’s best price. Shared maker funds
        may overstate depth; imbalance is not a directional signal.
      </p>
    </section>
  );
}
