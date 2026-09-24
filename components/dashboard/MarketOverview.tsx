"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, RefreshCw } from "lucide-react";
import { CollectionSearch } from "@/components/terminal/CollectionSearch";
import { WatchlistStar } from "@/components/watchlist/WatchlistPicker";
import { ChainLogo } from "@/components/ChainLogo";
import { OpenSeaDetailsLink } from "@/components/OpenSeaDetailsLink";
import { getTerminalHref } from "@/lib/collection-navigation";
import type { CollectionDiscoveryResponse, MarketCollection } from "@/lib/types";

function metric(value: number | null, decimals = 2) {
  return value === null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: value !== 0 && Math.abs(value) < 0.001 ? 8 : decimals });
}

const overviewCache = new Map<string, { data: CollectionDiscoveryResponse; fetchedAt: number }>();
type StatsResult = { stats: Record<string, { floor: number | null; floorSymbol: string | null; volume: number | null; volumeSymbol: string | null; totalVolume: number | null; sales: number | null; owners: number | null }>; unavailable: string[] };

function mergeStats(data: CollectionDiscoveryResponse, stats: StatsResult["stats"]): CollectionDiscoveryResponse {
  const enrich = (items: MarketCollection[]) => items.map((item) => {
    const value = stats[item.slug];
    return value ? { ...item, floor: item.floor ?? value.floor, floorSymbol: value.floorSymbol ?? item.floorSymbol, volume24h: item.volume24h ?? value.volume, volumeSymbol: value.volumeSymbol ?? item.volumeSymbol, totalVolume: item.totalVolume ?? value.totalVolume, sales24h: item.sales24h ?? value.sales, owners: item.owners ?? value.owners } : item;
  });
  return { ...data, trending: enrich(data.trending), top: enrich(data.top) };
}

function CollectionArt({ item }: { item: MarketCollection }) {
  return item.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.imageUrl} alt="" width={42} height={42} loading="lazy" />
  ) : <span className="overview-art-fallback">{item.name.slice(0, 1)}</span>;
}

function href(item: MarketCollection) {
  return getTerminalHref(item.slug, item.chain);
}

export function MarketOverview() {
  const [chain, setChain] = useState("");
  const [sort, setSort] = useState("one_day_volume");
  const [data, setData] = useState<CollectionDiscoveryResponse | null>(null);
  const [shownKey, setShownKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const handledRefresh = useRef(0);
  const key = `${chain}:${sort}`;
  const visibleData = shownKey === key ? data : overviewCache.get(key)?.data ?? null;

  useEffect(() => {
    const controller = new AbortController();
    const cached = overviewCache.get(key);
    const forceRefresh = handledRefresh.current !== refreshVersion;
    handledRefresh.current = refreshVersion;
    async function load() {
      setStatsLoading(false);
      setError("");
      if (cached) { setData(cached.data); setShownKey(key); setLoading(false); }
      if (cached && Date.now() - cached.fetchedAt < 90_000 && !forceRefresh) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({ sort });
        if (chain) params.set("chain", chain);
        if (sort !== "floor_cap_estimate") params.set("rankings", "1");
        const response = await fetch(`/api/discovery?${params}`, { signal: controller.signal });
        const result = await response.json() as CollectionDiscoveryResponse & { error?: string };
        if (!response.ok) throw Error(result.error ?? result.warnings?.join(" · ") ?? "Trending feed unavailable.");
        if (controller.signal.aborted) return;
        overviewCache.set(key, { data: result, fetchedAt: Date.now() });
        setData(result);
        setShownKey(key);
        setLoading(false);
        if (sort === "floor_cap_estimate") return;

        const groups = [result.trending.slice(0, 10), result.top.slice(0, 10)];
        setStatsLoading(true);
        await Promise.all(groups.map(async (items) => {
          const slugs = [...new Set(items.filter((item) => item.floor === null || item.volume24h === null || item.totalVolume === null).map((item) => item.slug))];
          if (!slugs.length) return;
          try {
            const reply = await fetch(`/api/discovery/stats?slugs=${encodeURIComponent(slugs.join(","))}`, { signal: controller.signal });
            if (!reply.ok) return;
            const detail = await reply.json() as StatsResult;
            if (controller.signal.aborted) return;
            setData((current) => {
              if (!current) return current;
              const enriched = mergeStats(current, detail.stats);
              overviewCache.set(key, { data: enriched, fetchedAt: Date.now() });
              return enriched;
            });
          } catch { /* Keep real missing values visible as unavailable. */ }
        }));
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Trending feed unavailable.");
      } finally {
        if (!controller.signal.aborted) { setLoading(false); setStatsLoading(false); }
      }
    }
    queueMicrotask(() => void load());
    return () => controller.abort();
  }, [chain, sort, key, refreshVersion]);

  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) setRefreshVersion((value) => value + 1); }, 120_000);
    return () => window.clearInterval(timer);
  }, []);

  const trending = visibleData?.trending.slice(0, 10) ?? [];
  const top = visibleData?.top.slice(0, 10) ?? [];
  const maxVolume = Math.max(1, ...trending.map((item) => item.volume24h ?? 0));

  return <main className="terminal-page market-overview">
    <div className="terminal-heading">
      <div><span className="eyebrow">OPENSEA / COLLECTION DISCOVERY</span><h1>Market overview<span className="heading-dot">.</span></h1></div>
      <button className="t-button" type="button" onClick={() => setRefreshVersion((value) => value + 1)} disabled={loading}><RefreshCw size={14} aria-hidden="true" /> {loading ? "Updating…" : "Refresh"}</button>
    </div>
    <p className="overview-intro">Discover active collections, inspect their order books, and save the ones you want to follow.</p>
    <CollectionSearch />
    <div className="overview-filters" aria-label="Collection discovery filters">
      <div className="overview-chain-filters">
        {["", "ethereum", "solana", "base", "ape_chain", "polygon", "arbitrum", "robinhood", "arc"].map((value) => <button key={value || "all"} type="button" className={chain === value ? "active" : ""} aria-pressed={chain === value} title={value || "All chains"} onClick={() => { setChain(value); if (!value && sort === "floor_cap_estimate") setSort("one_day_volume"); }}>{value ? <ChainLogo chain={value} /> : "All"}<span>{value ? value.replaceAll("_", " ") : "All"}</span></button>)}
      </div>
      <label>TOP BY <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="one_day_volume">24h volume</option><option value="one_day_sales">24h sales</option><option value="floor_price">Floor price</option><option value="total_volume">All-time volume</option><option value="floor_cap_estimate" disabled={!chain}>Est. floor cap (choose chain)</option></select></label>
    </div>
    {error && <div className="t-error" role="alert">OpenSea market overview unavailable: {error} <button type="button" onClick={() => setRefreshVersion((value) => value + 1)}>Retry</button></div>}
    {!visibleData && !error && <div className="overview-loading" role="status">Loading trending collections from OpenSea…</div>}
    {visibleData && <>
      <div className="overview-meta"><span>{visibleData.trendingMethod === "opensea_trending" ? "OPENSEA / 24H TRENDING" : "OPENSEA / 24H SALES FALLBACK"}{statsLoading ? " · Loading collection metrics…" : ""}</span><span>Updated {new Date(visibleData.lastUpdated).toLocaleTimeString()}</span></div>
      {visibleData.warnings.map((warning) => <p className="t-note" key={warning}>{warning}</p>)}
      <div className="overview-grid">
        <section className="t-panel overview-trending" aria-labelledby="overview-trending-title">
          <div className="panel-title"><span id="overview-trending-title">01 / TRENDING COLLECTIONS</span><span>OPENSEA RANK</span></div>
          {trending.length ? trending.map((item) => <div className="overview-trend-row" key={item.slug}>
            <span className="overview-rank">{String(item.rank).padStart(2, "0")}</span>
            <Link className="overview-collection" href={href(item)}>
              <CollectionArt item={item} /><span><strong>{item.name}{item.verified && <BadgeCheck size={14} aria-label="Verified" />}</strong><small><ChainLogo chain={item.chain} />{item.chain === "robinhood" ? "Robinhood Chain" : item.chain.replaceAll("_", " ")}</small><small className="overview-mobile-metrics">Floor {metric(item.floor, 4)} {item.floorSymbol ?? item.nativeSymbol} · 24h {metric(item.volume24h, 2)} {item.volumeSymbol ?? item.nativeSymbol}</small></span><ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <span className="overview-trend-metric"><small>FLOOR</small>{metric(item.floor, 4)} <em>{item.floorSymbol ?? item.nativeSymbol}</em></span>
            <span className="overview-trend-metric"><small>24H VOL</small>{metric(item.volume24h, 2)} <em>{item.volumeSymbol ?? item.nativeSymbol}</em></span>
            <OpenSeaDetailsLink slug={item.slug} name={item.name} />
            {(item.chain === "ethereum" || item.chain === "ape_chain") && <WatchlistStar item={{ slug: item.slug, chain: item.chain, name: item.name, imageUrl: item.imageUrl }} />}
            {item.volume24h !== null && <span className="overview-volume-bar" style={{ width: `${Math.max(3, item.volume24h / maxVolume * 100)}%` }} aria-hidden="true" />}
          </div>) : <div className="book-empty">No trending collections were returned.</div>}
        </section>
        <aside className="t-panel overview-top" aria-labelledby="overview-top-title">
          <div className="panel-title"><span id="overview-top-title">02 / TOP COLLECTIONS</span><span>{sort.replaceAll("_", " ").toUpperCase()}</span></div>
          {top.map((item) => <div className="overview-top-row" key={item.slug}>
            <Link className="overview-top-main" href={href(item)}>
              <span>{String(item.rank).padStart(2, "0")}</span><CollectionArt item={item} /><ChainLogo chain={item.chain} /><strong>{item.name}</strong><span className="overview-top-value">{sort === "floor_cap_estimate" ? metric(item.floor !== null && item.supply ? item.floor * item.supply : null, 2) : sort === "one_day_sales" ? metric(item.sales24h, 0) : sort === "floor_price" ? metric(item.floor, 4) : sort === "total_volume" ? metric(item.totalVolume) : metric(item.volume24h)}<small>{sort === "one_day_sales" ? "sales" : sort === "floor_price" || sort === "floor_cap_estimate" ? item.floorSymbol ?? item.nativeSymbol : sort === "one_day_volume" ? item.volumeSymbol ?? item.nativeSymbol : item.nativeSymbol}</small></span><ArrowUpRight size={14} aria-hidden="true" />
            </Link><OpenSeaDetailsLink slug={item.slug} name={item.name} />
          </div>)}
          {!top.length && <div className="book-empty">Volume ranking unavailable.</div>}
          <p className="t-note">OpenSea ranks this list by the selected metric. Market cap is not supplied by this feed; floor × supply would only be an estimate. Ranking does not imply a tradeable spread.</p>
        </aside>
      </div>
      <p className="t-note">Floor and 24h volume appear only when collection statistics are available. Values are OpenSea snapshots, not executable prices.</p>
    </>}
  </main>;
}
