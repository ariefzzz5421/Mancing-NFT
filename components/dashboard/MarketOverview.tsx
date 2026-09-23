"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, RefreshCw } from "lucide-react";
import { CollectionSearch } from "@/components/terminal/CollectionSearch";
import { WatchlistStar } from "@/components/watchlist/WatchlistPicker";
import { ChainLogo } from "@/components/ChainLogo";
import type { CollectionDiscoveryResponse, MarketCollection } from "@/lib/types";

function metric(value: number | null, decimals = 2) {
  return value === null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function CollectionArt({ item }: { item: MarketCollection }) {
  return item.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.imageUrl} alt="" width={42} height={42} loading="lazy" />
  ) : <span className="overview-art-fallback">{item.name.slice(0, 1)}</span>;
}

function href(item: MarketCollection) {
  return item.chain === "ethereum" ? `/terminal/${encodeURIComponent(item.slug)}` :
    item.chain === "ape_chain" ? `/collection/${encodeURIComponent(item.slug)}?chain=ape_chain` :
      `https://opensea.io/collection/${encodeURIComponent(item.slug)}`;
}

export function MarketOverview() {
  const [chain, setChain] = useState("");
  const [sort, setSort] = useState("one_day_volume");
  const [data, setData] = useState<CollectionDiscoveryResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort });
      if (chain) params.set("chain", chain);
      const response = await fetch(`/api/discovery?${params}`, { signal });
      const result = await response.json() as CollectionDiscoveryResponse & { error?: string };
      if (!response.ok) throw Error(result.error ?? result.warnings?.join(" · ") ?? "Trending feed unavailable.");
      if (signal?.aborted) return;
      setData(result);
      setError("");
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Trending feed unavailable.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [chain, sort]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void load(controller.signal));
    const timer = window.setInterval(() => { if (!document.hidden) void load(controller.signal); }, 120_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [load]);

  const trending = data?.trending.slice(0, 8) ?? [];
  const top = data?.top.slice(0, 8) ?? [];
  const maxVolume = Math.max(1, ...trending.map((item) => item.volume24h ?? 0));

  return <main className="terminal-page market-overview">
    <div className="terminal-heading">
      <div><span className="eyebrow">OPENSEA / COLLECTION DISCOVERY</span><h1>Market overview<span className="heading-dot">.</span></h1></div>
      <button className="t-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} aria-hidden="true" /> {loading ? "Updating…" : "Refresh"}</button>
    </div>
    <p className="overview-intro">Discover active collections, inspect their order books, and save the ones you want to follow.</p>
    <CollectionSearch />
    <div className="overview-filters" aria-label="Collection discovery filters">
      <div className="overview-chain-filters">
        {["", "ethereum", "solana", "base", "ape_chain", "polygon", "arbitrum", "robinhood", "arc"].map((value) => <button key={value || "all"} type="button" className={chain === value ? "active" : ""} aria-pressed={chain === value} title={value || "All chains"} onClick={() => { setChain(value); if (!value && sort === "floor_cap_estimate") setSort("one_day_volume"); }}>{value ? <ChainLogo chain={value} /> : "All"}<span>{value ? value.replaceAll("_", " ") : "All"}</span></button>)}
      </div>
      <label>TOP BY <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="one_day_volume">24h volume</option><option value="one_day_sales">24h sales</option><option value="floor_price">Floor price</option><option value="total_volume">All-time volume</option><option value="floor_cap_estimate" disabled={!chain}>Est. floor cap (choose chain)</option></select></label>
    </div>
    {error && <div className="t-error" role="alert">OpenSea market overview unavailable: {error} <button type="button" onClick={() => void load()}>Retry</button></div>}
    {loading && !data && <div className="overview-loading" role="status">Loading trending collections from OpenSea…</div>}
    {data && <>
      <div className="overview-meta"><span>{data.trendingMethod === "opensea_trending" ? "OPENSEA / 24H TRENDING" : "OPENSEA / 24H SALES FALLBACK"}</span><span>Updated {new Date(data.lastUpdated).toLocaleTimeString()}</span></div>
      {data.warnings.map((warning) => <p className="t-note" key={warning}>{warning}</p>)}
      <div className="overview-grid">
        <section className="t-panel overview-trending" aria-labelledby="overview-trending-title">
          <div className="panel-title"><span id="overview-trending-title">01 / TRENDING COLLECTIONS</span><span>OPENSEA RANK</span></div>
          {trending.length ? trending.map((item) => <div className="overview-trend-row" key={item.slug}>
            <span className="overview-rank">{String(item.rank).padStart(2, "0")}</span>
            <Link className="overview-collection" href={href(item)} target={item.analyzable ? undefined : "_blank"} rel={item.analyzable ? undefined : "noreferrer"}>
              <CollectionArt item={item} /><span><strong>{item.name}{item.verified && <BadgeCheck size={14} aria-label="Verified" />}</strong><small><ChainLogo chain={item.chain} />{item.chain === "robinhood" ? "Robinhood Chain" : item.chain.replaceAll("_", " ")}</small></span><ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <span className="overview-trend-metric"><small>FLOOR</small>{metric(item.floor, 4)} <em>{item.nativeSymbol}</em></span>
            <span className="overview-trend-metric"><small>24H VOL</small>{metric(item.volume24h, 2)} <em>{item.nativeSymbol}</em></span>
            {(item.chain === "ethereum" || item.chain === "ape_chain") && <WatchlistStar item={{ slug: item.slug, chain: item.chain, name: item.name, imageUrl: item.imageUrl }} />}
            {item.volume24h !== null && <span className="overview-volume-bar" style={{ width: `${Math.max(3, item.volume24h / maxVolume * 100)}%` }} aria-hidden="true" />}
          </div>) : <div className="book-empty">No trending collections were returned.</div>}
        </section>
        <aside className="t-panel overview-top" aria-labelledby="overview-top-title">
          <div className="panel-title"><span id="overview-top-title">02 / TOP COLLECTIONS</span><span>{sort.replaceAll("_", " ").toUpperCase()}</span></div>
          {top.map((item) => <Link className="overview-top-row" key={item.slug} href={href(item)} target={item.analyzable ? undefined : "_blank"} rel={item.analyzable ? undefined : "noreferrer"}>
            <span>{String(item.rank).padStart(2, "0")}</span><CollectionArt item={item} /><ChainLogo chain={item.chain} /><strong>{item.name}</strong><span className="overview-top-value">{sort === "floor_cap_estimate" ? metric(item.floor !== null && item.supply ? item.floor * item.supply : null, 2) : sort === "one_day_sales" ? metric(item.sales24h, 0) : sort === "floor_price" ? metric(item.floor, 4) : sort === "total_volume" ? metric(item.totalVolume) : metric(item.volume24h)}<small>{sort === "one_day_sales" ? "sales" : item.nativeSymbol}</small></span><ArrowUpRight size={14} aria-hidden="true" />
          </Link>)}
          {!top.length && <div className="book-empty">Volume ranking unavailable.</div>}
          <p className="t-note">OpenSea ranks this list by the selected metric. Market cap is not supplied by this feed; floor × supply would only be an estimate. Ranking does not imply a tradeable spread.</p>
        </aside>
      </div>
      <p className="t-note">Floor and 24h volume appear only when collection statistics are available. Values are OpenSea snapshots, not executable prices.</p>
    </>}
  </main>;
}
