"use client";
import { useEffect, useState, useCallback } from "react";
import { CollectionSearch } from "./CollectionSearch";
import { CollectionHeader } from "./CollectionHeader";
import { SpreadPanel } from "./SpreadPanel";
import { OrderBook } from "./OrderBook";
import { TradePanel } from "./TradePanel";
import { NetEdgeCalculator } from "./NetEdgeCalculator";
import { SweepCalculator, LiquidityPanel } from "./SweepCalculator";
import { PriceHistoryChart } from "./PriceHistoryChart";
import { eth } from "@/lib/quant/book";
import type { Book, Collection, Stats, Level, Side } from "@/types/market";
import { useWatchlist } from "@/lib/watchlist";
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
    [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const watchlist = useWatchlist();
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
  function select(l: Level, s: Side) {
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
        <button
          className="t-button"
          onClick={() => {
            if (watchlist.byKey.has(`ethereum:${slug}`)) {
              watchlist.removeItem(slug, "ethereum");
              return;
            }
            watchlist.upsertItem({
              slug,
              name: collection?.name ?? slug,
              chain: "ethereum",
              imageUrl: collection?.image ?? null,
            });
          }}
        >
          {watchlist.items.some((x) => x.slug === slug)
            ? "× Remove from watchlist"
            : "+ Watch collection"}
        </button>
      </div>
      {watchlist.syncError && <p className="t-error" role="alert">{watchlist.syncError}</p>}
      <CollectionSearch />
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
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className={`terminal-grid mobile-${tab.toLowerCase()}`}>
        <aside className="terminal-overview">
          <CollectionHeader
            collection={collection}
            stats={stats}
            book={book}
            slug={slug}
          />
          <LiquidityPanel book={book} />
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
          />
          <NetEdgeCalculator entry={entry} exit={exit} quantity={quantity} />
        </aside>
      </div>
      <div className={`terminal-analytics ${tab === "Analytics" ? "mobile-visible" : ""}`}>
        <PriceHistoryChart slug={slug} floor={stats?.floor ?? null} />
      </div>
    </main>
  );
}
