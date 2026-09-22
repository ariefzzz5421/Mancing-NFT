"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpRight } from "lucide-react";
import type { MarketCollection } from "@/lib/types";
export function CollectionSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketCollection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setBusy(true);
    setError("");
    setResults([]);
    try {
      if (/^0x|opensea\.io|https?:/i.test(query)) {
        const r = await fetch(
          `/api/resolve-collection?input=${encodeURIComponent(query)}`,
        );
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        router.push(`/terminal/${encodeURIComponent(d.slug)}`);
      } else {
        const r = await fetch(
          `/api/collections/search?q=${encodeURIComponent(query)}`,
        );
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setResults(d.results);
        if (!d.results.length)
          setError("No matches. Try the exact OpenSea slug.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search unavailable");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="collection-search">
      <form onSubmit={search}>
        <Search size={19} />
        <input
          aria-label="Search collection name, OpenSea URL, slug, or contract"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search collection name, OpenSea URL, slug, or contract"
          required
          minLength={2}
        />
        <button className="t-button" disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>
      {error && (
        <p className="t-error" role="alert">
          {error}
        </p>
      )}
      {results.length > 0 && (
        <div className="search-results">
          {results.map((r) => (
            <button
              key={r.slug}
              onClick={() => {
                router.push(`/terminal/${encodeURIComponent(r.slug)}`);
                setResults([]);
              }}
            >
              <span>
                {r.name} <small>{r.chain}</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      )}
      <div className="quick-search">
        <span>QUICK LOAD</span>
        {[
          ["pudgypenguins", "Pudgy Penguins"],
          ["milady", "Milady"],
          ["azuki", "Azuki"],
        ].map(([s, n]) => (
          <button key={s} onClick={() => router.push(`/terminal/${s}`)}>
            {n}
            <ArrowUpRight size={12} />
          </button>
        ))}
      </div>
    </div>
  );
}
