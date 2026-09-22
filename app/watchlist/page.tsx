"use client";
import { useState } from "react";
import Link from "next/link";
import { useWatchlist } from "@/lib/watchlist";
import { CollectionSearch } from "@/components/terminal/CollectionSearch";
export default function Page() {
  const { items, removeItem, upsertItem, hydrated, syncError, storage } = useWatchlist();
  const [slug, setSlug] = useState("");
  const [inputError, setInputError] = useState("");
  function add(event: React.FormEvent) {
    event.preventDefault();
    const clean = slug.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,159}$/.test(clean)) {
      setInputError("Enter a valid OpenSea collection slug.");
      return;
    }
    upsertItem({ slug: clean, chain: "ethereum" });
    setSlug("");
    setInputError("");
  }
  return (
    <main className="terminal-page">
      <div className="terminal-heading">
        <div>
          <span className="eyebrow">YOUR COLLECTION RADAR</span>
          <h1>Watchlist.</h1>
        </div>
      </div>
      <CollectionSearch />
      <form className="watchlist-add" onSubmit={add}>
        <label htmlFor="watchlist-slug">Add collection by OpenSea slug</label>
        <div>
          <input id="watchlist-slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="e.g. pudgypenguins" />
          <button className="t-button t-primary" type="submit">Add to watchlist</button>
        </div>
        {inputError && <p className="t-error" role="alert">{inputError}</p>}
      </form>
      {syncError && <p className="t-error" role="alert">{syncError}</p>}
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
        {hydrated && !items.length && (
          <div className="ledger-empty">
            Find a collection and select “Watch collection” to add it here.
          </div>
        )}
      </div>
      <p className="t-note">
        Storage: {storage}. Your existing browser watchlist remains available when signed out.
      </p>
    </main>
  );
}
