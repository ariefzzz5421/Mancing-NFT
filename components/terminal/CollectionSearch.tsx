"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpRight, BadgeCheck } from "lucide-react";
import type { MarketCollection } from "@/lib/types";
export function CollectionSearch() {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketCollection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  useEffect(() => {
    if (!results.length) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setResults([]);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [results.length]);
  async function openResult(slug: string) {
    setOpening(slug);
    setError("");
    try {
      const response = await fetch(`/api/resolve-collection?input=${encodeURIComponent(slug)}`);
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Collection unavailable.");
      router.push(data.chain === "ethereum" ? `/terminal/${encodeURIComponent(data.slug)}` : `/collection/${encodeURIComponent(data.slug)}?chain=${encodeURIComponent(data.chain)}`);
      setResults([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open collection."); }
    finally { setOpening(null); }
  }
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
        router.push(d.chain === "ethereum" ? `/terminal/${encodeURIComponent(d.slug)}` : `/collection/${encodeURIComponent(d.slug)}?chain=${encodeURIComponent(d.chain)}`);
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
    <div className="collection-search" ref={container} onKeyDown={(event) => { if (event.key === "Escape") setResults([]); }}>
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
        <div className="search-results" role="region" aria-label="OpenSea collection search results">
          <div className="search-results__heading">{results.length} OpenSea collection results · choose one</div>
          {results.map((r) => (
            <button
              key={r.slug}
              type="button"
              disabled={opening !== null}
              onClick={() => void openResult(r.slug)}
            >
              <span className="search-results__identity">
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.imageUrl} alt="" width={34} height={34} loading="lazy" />
                ) : <span className="search-results__placeholder">{r.name.slice(0, 1)}</span>}
                <span><strong>{r.name}</strong>{r.verified && <BadgeCheck size={14} aria-label="Verified" />}<small>{r.slug}</small></span>
              </span>
              {opening === r.slug ? <span>Opening…</span> : <ArrowUpRight size={16} />}
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
