"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { eth, price, spread, edge, liquidity } from "@/lib/quant/book";
import type { Book } from "@/types/market";
import type { MarketCollection } from "@/lib/types";
export function ScannerTable() {
  const [rows, setRows] = useState<MarketCollection[]>([]),
    [books, setBooks] = useState<Record<string, Book>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sort, setSort] = useState("volume"),
    [nonce, setNonce] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setBusy(true);
      setError("");
      try {
        const r = await fetch("/api/discovery", { signal: controller.signal });
        const d = await r.json();
        if (!r.ok)
          throw Error(
            d.error ?? d.warnings?.join(" · ") ?? "Discovery unavailable",
          );
        const collections: MarketCollection[] = d.top
          .filter((x: MarketCollection) => x.chain === "ethereum")
          .slice(0, 8);
        setRows(collections);
        for (let i = 0; i < collections.length; i += 2) {
          if (controller.signal.aborted) break;
          await Promise.all(
            collections.slice(i, i + 2).map(async (c) => {
              const r = await fetch(`/api/collections/${c.slug}/orders`, {
                signal: controller.signal,
              });
              const b = await r.json();
              if (!r.ok) throw Error(b.error);
              setBooks((v) => ({ ...v, [c.slug]: b }));
            }),
          );
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Scanner unavailable");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [nonce]);
  const sorted = [...rows].sort((a, b) =>
    sort === "spread"
      ? (spread(
          books[b.slug]?.bids[0]?.priceWei,
          books[b.slug]?.asks[0]?.priceWei,
        )?.bps ?? -Infinity) -
        (spread(
          books[a.slug]?.bids[0]?.priceWei,
          books[a.slug]?.asks[0]?.priceWei,
        )?.bps ?? -Infinity)
      : (b.volume24h ?? 0) - (a.volume24h ?? 0),
  );
  return (
    <main className="terminal-page">
      <div className="terminal-heading">
        <div>
          <span className="eyebrow">DISCOVER / COMPARE / INVESTIGATE</span>
          <h1>Market scanner.</h1>
        </div>
        <button
          className="t-button"
          onClick={() => setNonce((n) => n + 1)}
          disabled={busy}
        >
          {busy ? "Scanning…" : "Refresh scanner"}
        </button>
      </div>
      <p className="t-muted">
        Eight leading Ethereum collections by volume. A wide spread is not
        necessarily an attractive trade.
      </p>
      <div className="scanner-toolbar">
        <label>
          Sort{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="volume">24h volume</option>
            <option value="spread">Gross spread</option>
          </select>
        </label>
        <span>
          Edge assumptions: 1% fee · 0% royalty · 0.5% slippage · 0.0005 ETH gas
          / NFT
        </span>
      </div>
      {error && (
        <p className="t-error" role="alert">
          {error}
        </p>
      )}
      <div className="table-scroll">
        <table className="terminal-table">
          <thead>
            <tr>
              {[
                "Collection",
                "Floor",
                "Best bid",
                "Best ask",
                "Gross spread",
                "Net edge est.",
                "Bid depth / ETH",
                "Ask depth / ETH",
                "24h volume",
                "24h sales",
                "Liquidity",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const b = books[c.slug],
                s = spread(b?.bids[0]?.priceWei, b?.asks[0]?.priceWei),
                e = s
                  ? edge(
                      BigInt(b.bids[0].priceWei),
                      BigInt(b.asks[0].priceWei),
                      1,
                      100,
                      0,
                      500000000000000n,
                      50,
                    )
                  : null;
              return (
                <tr key={c.slug}>
                  <td>
                    <Link href={`/terminal/${c.slug}`}>{c.name} ↗</Link>
                  </td>
                  <td>{price(c.floor)}</td>
                  <td className="positive">{eth(b?.bids[0]?.priceWei)}</td>
                  <td className="negative">{eth(b?.asks[0]?.priceWei)}</td>
                  <td>{s ? `${s.bps / 100}%` : "—"}</td>
                  <td>{e ? `${e.roiBps / 100}%` : "—"}</td>
                  <td>
                    {b && !b.errors.length
                      ? eth(liquidity(b.bids, "bid").total)
                      : "—"}
                  </td>
                  <td>
                    {b && !b.errors.length
                      ? eth(liquidity(b.asks, "ask").total)
                      : "—"}
                  </td>
                  <td>{price(c.volume24h)}</td>
                  <td>{price(c.sales24h)}</td>
                  <td>
                    {b?.errors.length
                      ? "Unavailable"
                      : b?.complete
                        ? "Full snapshot"
                        : b
                          ? "Partial snapshot"
                          : "Loading"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <div className="ledger-empty">
            {busy
              ? "Loading collection universe…"
              : "Market data temporarily unavailable. Refresh to retry."}
          </div>
        )}
      </div>
      <p className="t-note">
        Collection-wide bids only. Depth is advertised and may share maker
        funds. Price validity and fees must be rechecked before execution.
      </p>
    </main>
  );
}
