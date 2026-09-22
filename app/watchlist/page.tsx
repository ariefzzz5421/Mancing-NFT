"use client";
import Link from "next/link";
import { useWatchlist } from "@/lib/watchlist";
import { CollectionSearch } from "@/components/terminal/CollectionSearch";
export default function Page() {
  const { items, removeItem } = useWatchlist();
  return (
    <main className="terminal-page">
      <div className="terminal-heading">
        <div>
          <span className="eyebrow">YOUR COLLECTION RADAR</span>
          <h1>Watchlist.</h1>
        </div>
      </div>
      <CollectionSearch />
      <div className="t-panel">
        {items.map((i) => (
          <div className="watchlist-entry" key={`${i.chain}:${i.slug}`}>
            <Link
              href={
                i.chain === "ethereum"
                  ? `/terminal/${i.slug}`
                  : `/collection/${i.slug}?chain=${i.chain}`
              }
            >
              <strong>{i.name ?? i.slug}</strong>
              <small>
                {i.chain} · {i.notes ?? "Open terminal"}
              </small>
            </Link>
            <button
              className="t-button"
              onClick={() => removeItem(i.slug, i.chain)}
            >
              Remove
            </button>
          </div>
        ))}
        {!items.length && (
          <div className="ledger-empty">
            Find a collection and select “Watch collection” to add it here.
          </div>
        )}
      </div>
      <p className="t-note">
        Saved in this browser. Existing watchlist entries and research targets
        are preserved.
      </p>
    </main>
  );
}
