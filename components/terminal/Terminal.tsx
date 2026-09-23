"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { CollectionSearch } from "./CollectionSearch";
import { CollectionHeader } from "./CollectionHeader";
import { SpreadPanel } from "./SpreadPanel";
import { OrderBook } from "./OrderBook";
import { TradePanel } from "./TradePanel";
import { NetEdgeCalculator } from "./NetEdgeCalculator";
import { SweepCalculator, LiquidityPanel } from "./SweepCalculator";
import { CollectionPriceTape } from "./CollectionPriceTape";
import { TopHolders } from "./TopHolders";
import { WatchlistStar } from "@/components/watchlist/WatchlistPicker";
import { useLiveEthPrice } from "@/components/useLiveEthPrice";
import { eth } from "@/lib/quant/book";
import type { Book, Collection, Stats, Level, Side } from "@/types/market";
const PriceHistoryChart = dynamic(() => import("./PriceHistoryChart").then((module) => module.PriceHistoryChart), { ssr: false, loading: () => <div className="t-panel t-note">Loading price history…</div> });
export function Terminal({ slug = "pudgypenguins" }: { slug?: string }) {
  const [collection, setCollection] = useState<Collection | null>(null),
    [stats, setStats] = useState<Stats | null>(null),
    [book, setBook] = useState<Book | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [tab, setTab] = useState("Overview"),
    [entry, setEntry] = useState(""),
    [exit, setExit] = useState(""),
    [quantity, setQuantity] = useState(1),
    [mode, setMode] = useState<"BUY" | "OFFER" | "LIST">("OFFER"),
    [selected, setSelected] = useState(""),
    [selectedOrder, setSelectedOrder] = useState<string | null>(null),
    [leftCollapsed, setLeftCollapsed] = useState(false),
    [rightCollapsed, setRightCollapsed] = useState(false),
    [showAnalytics, setShowAnalytics] = useState(false);
  const analyticsRef = useRef<HTMLDivElement>(null);
  const ethUsd = useLiveEthPrice();
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      const responses = await Promise.allSettled(
        ["", "/stats", "/orders"].map(async (suffix) => {
          const r = await fetch(
            `/api/collections/${encodeURIComponent(slug)}${suffix}`,
            { signal },
          );
          const data = await r.json();
          if (!r.ok) throw Error(data.error);
          return data;
        }),
      );
      if (signal?.aborted) return;
      setError(
        responses
          .flatMap((r) => (r.status === "rejected" ? [r.reason.message] : []))
          .join(" · "),
      );
      if (responses[0].status === "fulfilled")
        setCollection(responses[0].value);
      if (responses[1].status === "fulfilled") setStats(responses[1].value);
      if (responses[2].status === "fulfilled") {
        const b: Book = responses[2].value;
        setBook(b);
        setEntry((v) => v || (b.bids[0] ? eth(b.bids[0].priceWei) : ""));
        setExit((v) => v || (b.asks[0] ? eth(b.asks[0].priceWei) : ""));
      }
      setLoading(false);
    },
    [slug],
  );
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void load(controller.signal));
    const timer = setInterval(() => {
      if (!document.hidden) queueMicrotask(() => void load(controller.signal));
    }, 60000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    const target = analyticsRef.current;
    if (!target || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { setShowAnalytics(true); observer.disconnect(); } }, { rootMargin: "300px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  function select(l: Level, s: Side) {
    setRightCollapsed(false);
    setSelected(`${s}:${l.priceWei}`);
    setSelectedOrder(s === "ask" ? (l.orders[0]?.orderHash ?? null) : null);
    if (s === "bid") {
      setEntry(eth(l.priceWei));
      setMode("OFFER");
    } else {
      setExit(eth(l.priceWei));
      setEntry(eth(l.orders[0].priceWei));
      setMode("BUY");
    }
    setTab("Trade");
  }
  return (
    <main className="terminal-page">
      <div className="terminal-heading">
        <div>
          <span className="eyebrow">COLLECTION LIQUIDITY / ETHEREUM</span>
          <h1>
            Trading terminal<span className="heading-dot">.</span>
          </h1>
        </div>
        <WatchlistStar item={{ slug, chain: "ethereum", name: collection?.name ?? slug, imageUrl: collection?.image }} className="terminal-star" showText />
      </div>
      <CollectionSearch />
      <CollectionPriceTape collection={collection} stats={stats} book={book} slug={slug} />
      <SpreadPanel
        bid={book?.bids[0]?.priceWei}
        ask={book?.asks[0]?.priceWei}
      />
      {error && (
        <div className="t-error" role="alert">
          {error} <button onClick={() => void load()}>Retry</button>
        </div>
      )}
      <div
        className="mobile-terminal-tabs"
        role="tablist"
        aria-label="Terminal sections"
      >
        {["Overview", "Book", "Trade", "Analytics"].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            key={t}
            onClick={() => { setTab(t); if (t === "Analytics") setShowAnalytics(true); }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className={`terminal-grid mobile-${tab.toLowerCase()}${leftCollapsed ? " terminal-grid--left-collapsed" : ""}${rightCollapsed ? " terminal-grid--right-collapsed" : ""}`}>
        <aside className="terminal-overview">
          <button className="terminal-pane-toggle terminal-pane-toggle--left" type="button" aria-label={leftCollapsed ? "Expand collection panel" : "Minimize collection panel"} aria-expanded={!leftCollapsed} onClick={() => setLeftCollapsed((value) => !value)}>{leftCollapsed ? ">" : "<"}<span>{leftCollapsed ? "COLLECTION" : "MINIMIZE"}</span></button>
          {!leftCollapsed && <>
          <CollectionHeader
            collection={collection}
            stats={stats}
            book={book}
            slug={slug}
          />
          <LiquidityPanel book={book} />
          <TopHolders slug={slug} />
          </>}
        </aside>
        <div className="terminal-book">
          <OrderBook
            book={book}
            loading={loading}
            onSelect={select}
            selected={selected}
            retry={() => void load()}
          />
          <SweepCalculator book={book} />
        </div>
        <aside className="terminal-trade">
          <button className="terminal-pane-toggle terminal-pane-toggle--right" type="button" aria-label={rightCollapsed ? "Expand execution panel" : "Minimize execution panel"} aria-expanded={!rightCollapsed} onClick={() => setRightCollapsed((value) => !value)}><span>{rightCollapsed ? "EXECUTION" : "MINIMIZE"}</span>{rightCollapsed ? "<" : ">"}</button>
          {!rightCollapsed && <>
          <TradePanel
            collection={collection}
            slug={slug}
            entry={entry}
            exit={exit}
            setEntry={setEntry}
            setExit={setExit}
            quantity={quantity}
            setQuantity={setQuantity}
            mode={mode}
            setMode={setMode}
            book={book}
            selectedOrder={selectedOrder}
            ethUsd={ethUsd.priceUsd}
          />
          <NetEdgeCalculator entry={entry} exit={exit} quantity={quantity} ethUsd={ethUsd.priceUsd} />
          </>}
        </aside>
      </div>
      <div ref={analyticsRef} className={`terminal-analytics ${tab === "Analytics" ? "mobile-visible" : ""}`}>
        {showAnalytics && <PriceHistoryChart slug={slug} floor={stats?.floor ?? null} />}
      </div>
    </main>
  );
}
