"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { ChainLogo } from "@/components/ChainLogo";
import { OpenSeaDetailsLink } from "@/components/OpenSeaDetailsLink";
import type { Collection } from "@/types/market";
import { ReadOnlyMarketBook, type MarketSelection } from "./ReadOnlyMarketBook";
import { CollectionTradeAccess } from "./CollectionTradeAccess";
import { CollectionSalesAnalytics } from "./CollectionSalesAnalytics";
import type { MarketBookGroup } from "@/lib/opensea/read-only-book";
import { rememberTerminal } from "@/lib/collection-navigation";

type Snapshot = {
  floor: number | null;
  floorSymbol: string | null;
  volume: number | null;
  volumeSymbol: string | null;
  sales: number | null;
  owners: number | null;
};

function metric(value: number | null | undefined, maximumFractionDigits = 4) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}

export function CollectionTerminalPreview({ slug, requestedChain }: { slug: string; requestedChain: string }) {
  const router = useRouter();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [market, setMarket] = useState<MarketBookGroup | null>(null);
  const [selection, setSelection] = useState<MarketSelection | null>(null);
  const [view, setView] = useState<"BOOK" | "TRADE" | "SALES">("BOOK");

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const [collectionResponse, statsResponse] = await Promise.all([
        fetch(`/api/collections/${encodeURIComponent(slug)}`, { signal }),
        fetch(`/api/discovery/stats?slugs=${encodeURIComponent(slug)}`, { signal }),
      ]);
      const details = await collectionResponse.json();
      if (!collectionResponse.ok) throw new Error(details.error ?? "Collection unavailable.");
      if (signal.aborted) return;
      const nextCollection = details as Collection;
      if (nextCollection.chain === "ethereum") {
        router.replace(`/terminal/${encodeURIComponent(slug)}`);
        return;
      }
      setCollection(nextCollection);
      rememberTerminal(slug, nextCollection.chain);
      if (statsResponse.ok) {
        const data = await statsResponse.json();
        setSnapshot(data.stats?.[slug] ?? null);
      } else setSnapshot(null);
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : "Collection unavailable.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [router, slug]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void load(controller.signal));
    return () => controller.abort();
  }, [load, revision]);

  const chain = collection?.chain || requestedChain;
  const chainName = chain === "ape_chain" ? "ApeChain" : chain.replaceAll("_", " ");
  return <main className="terminal-page collection-terminal-preview">
    <div className="terminal-heading"><div><span className="eyebrow">COLLECTION / {chainName.toUpperCase()}</span><h1>Trading terminal<span className="heading-dot">.</span></h1></div></div>
    {loading && !collection && <div className="t-panel collection-terminal-preview__loading" role="status">Loading collection details…</div>}
    {error && <div className="t-error" role="alert">{error} <button type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}
    {collection && <>
      <section className="t-panel collection-terminal-preview__identity" aria-label="Collection overview">
        <div className="collection-terminal-preview__title">
          {collection.image && <span className="collection-terminal-preview__art"><Image src={collection.image} alt="" width={80} height={80} unoptimized /></span>}
          <div><span className="eyebrow">01 / COLLECTION OVERVIEW</span><h2>{collection.name} {collection.verified && <BadgeCheck size={17} aria-label="Verified on OpenSea" />}</h2><p><ChainLogo chain={chain} /> {chainName}</p></div>
          <OpenSeaDetailsLink slug={slug} name={collection.name} />
        </div>
        <div className="collection-terminal-preview__metrics">
          <div><small>FLOOR</small><strong>{metric(snapshot?.floor)} {snapshot?.floorSymbol ?? ""}</strong></div>
          <div><small>BEST ASK</small><strong>{market?.asks[0] ? `${metric(Number(market.asks[0].priceUnits) / 10 ** market.decimals, 7)} ${market.currency}` : "—"}</strong></div>
          <div><small>{market?.bidScope === "token" ? "TOP TOKEN BID" : "BEST COLLECTION BID"}</small><strong>{market?.bids[0] ? `${metric(Number(market.bids[0].priceUnits) / 10 ** market.decimals, 7)} ${market.currency}` : "—"}</strong></div>
          <div><small>24H VOLUME</small><strong>{metric(snapshot?.volume, 3)} {snapshot?.volumeSymbol ?? ""}</strong></div>
          <div><small>24H SALES</small><strong>{metric(snapshot?.sales, 0)}</strong></div>
          <div><small>OWNERS</small><strong>{metric(snapshot?.owners, 0)}</strong></div>
          <div><small>SUPPLY</small><strong>{metric(collection.supply, 0)}</strong></div>
        </div>
        {collection.contract && <p className="collection-terminal-preview__contract"><span>CONTRACT</span><code>{collection.contract}</code></p>}
        {!snapshot && <p className="t-note">OpenSea statistics are temporarily unavailable for this collection.</p>}
      </section>
      <div className="collection-terminal-preview__tabs" role="tablist" aria-label="Collection terminal sections">{(["BOOK", "TRADE", "SALES"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)}>{item}</button>)}</div>
      <div className={`collection-terminal-preview__grid collection-terminal-preview__grid--${view.toLowerCase()}`}>
        <div className="collection-terminal-preview__book"><ReadOnlyMarketBook slug={slug} chain={chain} onMarketChange={setMarket} onLevelSelect={(value) => { setSelection(value); setView("TRADE"); }} selection={selection} />{chain === "ape_chain" && <Link className="t-button" href={`/collection/${encodeURIComponent(slug)}?chain=ape_chain`}>View ApeChain research</Link>}</div>
        <CollectionTradeAccess slug={slug} chain={chain} market={market} selection={selection} />
      </div>
      <div className={`collection-terminal-preview__sales${view === "SALES" ? " collection-terminal-preview__sales--active" : ""}`}><CollectionSalesAnalytics slug={slug} chain={chain} reportedSales={snapshot?.sales ?? null} floor={snapshot?.floor ?? null} floorSymbol={snapshot?.floorSymbol ?? null} /></div>
    </>}
  </main>;
}
