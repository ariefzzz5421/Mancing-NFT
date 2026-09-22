"use client";
import { useMemo, useState } from "react";
import type { Book, Level, Side } from "@/types/market";
import { aggregate, eth, spread, wei } from "@/lib/quant/book";
export function OrderBook({
  book,
  loading,
  onSelect,
  selected,
  retry,
}: {
  book: Book | null;
  loading: boolean;
  onSelect: (l: Level, s: Side) => void;
  selected: string;
  retry: () => void;
}) {
  const [tick, setTick] = useState("0");
  const [limit, setLimit] = useState(10);
  const asks = useMemo(
    () => aggregate(book?.orders ?? [], "ask", wei(tick) ?? 1n),
    [book, tick],
  );
  const bids = useMemo(
    () => aggregate(book?.orders ?? [], "bid", wei(tick) ?? 1n),
    [book, tick],
  );
  const s = spread(book?.bids[0]?.priceWei, book?.asks[0]?.priceWei);
  function rows(levels: Level[], side: Side) {
    const visible = levels.slice(0, limit);
    const max = visible.reduce(
      (m, l) => (BigInt(l.valueWei) > m ? BigInt(l.valueWei) : m),
      1n,
    );
    return (side === "ask" ? [...visible].reverse() : visible).map((l) => (
      <button
        className={`book-row ${side} ${selected === `${side}:${l.priceWei}` ? "selected" : ""}`}
        key={l.priceWei}
        onClick={() => onSelect(l, side)}
        aria-label={`Select ${side} ${eth(l.priceWei)} ETH, quantity ${l.quantity}`}
      >
        <span
          className="depth-bar"
          style={{
            width: `${Number((BigInt(l.valueWei) * 10000n) / max) / 100}%`,
          }}
        />
        <span>{eth(l.priceWei)}</span>
        <span>{l.quantity}</span>
        <span>{l.cumulativeQuantity}</span>
        <span title={`Cumulative ETH: ${eth(l.cumulativeValueWei)}`}>
          {eth(l.valueWei)}
        </span>
        <span>{eth(l.cumulativeValueWei)}</span>
      </button>
    ));
  }
  return (
    <section className="t-panel order-book">
      <div className="panel-title">
        <span>02 / ORDER BOOK</span>
        <label>
          Tick{" "}
          <select value={tick} onChange={(e) => setTick(e.target.value)}>
            <option value="0">Exact</option>
            <option>0.0001</option>
            <option>0.001</option>
            <option>0.01</option>
          </select>
        </label>
      </div>
      <div className="book-side-label negative">
        <span>SELL / ASK</span>
        <span>{asks.length} levels</span>
      </div>
      <div className="book-columns">
        <span>Price / ETH</span>
        <span>Qty</span>
        <span>Σ Qty</span>
        <span>Value</span>
        <span>Σ ETH</span>
      </div>
      {loading && !book ? (
        <BookSkeleton />
      ) : asks.length ? (
        rows(asks, "ask")
      ) : (
        <div className="book-empty">
          {book?.errors.length
            ? "Listings unavailable"
            : "No valid active ETH listings"}
        </div>
      )}
      <div className="book-mid">
        <strong>{s ? `${eth(s.absolute)} ETH` : "—"}</strong>
        <span>SPREAD</span>
        <span>
          {s ? `${(s.bps / 100).toFixed(2)}%` : "Awaiting both sides"}
        </span>
      </div>
      <div className="book-side-label positive">
        <span>OFFER / BID</span>
        <span>{bids.length} levels</span>
      </div>
      {loading && !book ? (
        <BookSkeleton />
      ) : bids.length ? (
        rows(bids, "bid")
      ) : (
        <div className="book-empty">
          {book?.errors.length
            ? "Offers unavailable"
            : "No valid collection-wide WETH offers"}
        </div>
      )}
      <div className="book-foot">
        <label>
          Levels{" "}
          <select
            aria-label="Visible price levels per side"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[10, 25, 50, 100, 600].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span>
          {book?.complete
            ? "Fetched all pages"
            : "Partial / unavailable coverage"}{" "}
          · max 600 orders per side
        </span>
        <button onClick={retry} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {book?.errors.map((e) => (
        <p className="t-error" key={e}>
          {e}
        </p>
      ))}
      <p className="t-note">
        Best prices refer to fetched orders only. Snapshot read:{" "}
        {book?.updatedAt ? new Date(book.updatedAt).toLocaleTimeString() : "�"}.
        Depth shows advertised ETH value at each level. Σ = cumulative.{" "}
        {book?.excluded ?? 0} unsupported orders excluded. {book?.bidScope}
      </p>
    </section>
  );
}
function BookSkeleton() {
  return (
    <div
      className="book-skeleton"
      role="status"
      aria-label="Loading order book"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} />
      ))}
      <span>Loading orders…</span>
    </div>
  );
}
