"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import type { MarketBookGroup, MarketBookLevel } from "@/lib/opensea/read-only-book";

type ResponseBook = { groups: MarketBookGroup[]; complete: boolean; errors: string[]; updatedAt: string };

function amount(units: string, decimals: number) {
  return formatUnits(BigInt(units), decimals);
}

function Rows({ rows, decimals, side }: { rows: MarketBookLevel[]; decimals: number; side: "ask" | "bid" }) {
  const max = Math.max(1, ...rows.map((row) => row.quantity));
  return <div className="readonly-book__side">
    <div className={`readonly-book__side-heading ${side === "bid" ? "positive" : "negative"}`}>{side === "ask" ? "SELL / ASK" : "OFFER / BID"}<span>{rows.length} price levels</span></div>
    <div className="readonly-book__columns"><span>PRICE</span><span>QTY</span><span>Σ QTY</span><span>VALUE</span></div>
    {rows.length ? rows.slice(0, 15).map((row) => <div className={`readonly-book__row readonly-book__row--${side}`} key={row.priceUnits} style={{ "--depth-percent": `${Math.max(3, row.quantity / max * 100)}%` } as React.CSSProperties}>
      <strong title={amount(row.priceUnits, decimals)}>{amount(row.priceUnits, decimals)} <small>{row.currency}</small></strong>
      <span>{row.quantity}</span><span>{row.cumulativeQuantity}</span>
      <span title={`Cumulative: ${amount(row.cumulativeValueUnits, decimals)} ${row.currency}`}>{amount(row.valueUnits, decimals)}</span>
    </div>) : <p className="t-note">No active {side === "ask" ? "listings" : "offers"} in this quote currency.</p>}
  </div>;
}

export function ReadOnlyMarketBook({ slug, chain }: { slug: string; chain: string }) {
  const [data, setData] = useState<ResponseBook | null>(null);
  const [currency, setCurrency] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      if (document.hidden) return;
      setLoading(true);
      try {
        const response = await fetch(`/api/collections/${encodeURIComponent(slug)}/market-book?chain=${encodeURIComponent(chain)}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw Error(payload.error ?? "Order book unavailable.");
        if (!controller.signal.aborted) { setData(payload); setError(""); }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Order book unavailable."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [slug, chain, revision]);
  const selected = data?.groups.find((group) => group.key === currency) ?? data?.groups[0];
  const ask = selected?.asks[0];
  const bid = selected?.bids[0];
  const comparable = selected?.bidScope === "collection" && ask && bid;
  const spread = comparable ? BigInt(ask.priceUnits) - BigInt(bid.priceUnits) : null;
  return <section className="t-panel readonly-book" aria-label={`${chain} collection order book`}>
    <div className="panel-title"><span>02 / ORDER BOOK · READ ONLY</span><button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>{loading ? "Updating…" : "Refresh"}</button></div>
    {error && <p className="t-error" role="alert">{error}</p>}
    {!data && loading && <p className="t-note">Loading listings and offers from OpenSea…</p>}
    {data && !data.groups.length && <p className="t-note">No active comparable listings or offers were returned for this collection. {data.errors.join(" · ")}</p>}
    {selected && <>
      <div className="readonly-book__summary"><span>BEST ASK <strong className="negative">{ask ? amount(ask.priceUnits, selected.decimals) : "—"}</strong></span><span>{selected.bidScope === "token" ? "TOP TOKEN BID" : "BEST COLLECTION BID"} <strong className="positive">{bid ? amount(bid.priceUnits, selected.decimals) : "—"}</strong></span><span>{selected.currency}</span></div>
      {selected.bidScope === "token" && <p className="readonly-book__scope-note">These bids target individual NFTs; they are not available for every token in the collection.</p>}
      {(data?.groups.length ?? 0) > 1 && <label className="readonly-book__currency">Quote currency <select value={selected.key} onChange={(event) => setCurrency(event.target.value)}>{data?.groups.map((group) => <option key={group.key} value={group.key}>{group.currency} · {group.askCount} asks / {group.bidCount} bids</option>)}</select></label>}
      <Rows rows={selected.asks} decimals={selected.decimals} side="ask" />
      <div className="readonly-book__spread">{spread === null ? selected.bidScope === "token" ? "NFT-specific bids cannot establish a collection-wide spread" : "Collection spread unavailable" : <>GROSS SPREAD <strong>{amount(spread.toString(), selected.decimals)} {selected.currency}</strong></>}</div>
      <Rows rows={selected.bids} decimals={selected.decimals} side="bid" />
      <p className="t-note">OpenSea snapshot {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : "—"}. {selected.bidScope === "token" ? "Bids shown are for specific NFTs and may not apply to the floor NFT. " : ""}{!data?.complete ? "Partial depth: more orders exist beyond fetched pages. " : ""}Read-only on {chain}; Ethereum wallet signing is disabled here.</p>
      {(data?.errors.length ?? 0) > 0 && <p className="t-error">{data?.errors.join(" · ")}</p>}
    </>}
  </section>;
}
