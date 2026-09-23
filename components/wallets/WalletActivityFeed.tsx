"use client";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { NormalizedActivityEvent } from "@/lib/types";
import type { SupportedChain } from "@/lib/chains";

export function WalletActivityFeed({ address, chain }: { address: string; chain: SupportedChain }) {
  const [events, setEvents] = useState<NormalizedActivityEvent[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async (cursor?: string | null, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const url = `/api/wallet/${encodeURIComponent(address)}/activity?chain=${chain}${cursor ? `&next=${encodeURIComponent(cursor)}` : ""}`;
      const response = await fetch(url, { signal });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Wallet activity unavailable.");
      if (signal?.aborted) return;
      setEvents((current) => cursor ? [...current, ...data.events] : data.events);
      setNext(data.next);
      setError("");
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Wallet activity unavailable."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [address, chain]);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void load(null, controller.signal); }); return () => controller.abort(); }, [load]);
  return <section className="wallet-activity-feed" aria-label="Tracked wallet NFT activity">
    <div className="wallet-activity-feed__heading"><div><h2>NFT activity feed</h2><p>OpenSea account events · {chain.replaceAll("_", " ")}</p></div><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh wallet activity"><RefreshCw size={14} /></button></div>
    {error && <p className="t-error" role="alert">{error} <button type="button" onClick={() => void load()}>Retry</button></p>}
    {loading && !events.length ? <p className="t-note">Loading wallet activity…</p> : events.length ? <ol>{events.map((event) => <li key={event.id}><span className={`wallet-activity-feed__type wallet-activity-feed__type--${event.eventType}`}>{event.eventType.replaceAll("_", " ")}</span><span className="wallet-activity-feed__asset">{event.tokenName ?? (event.tokenId ? `NFT #${event.tokenId}` : "Collection activity")}</span><strong>{event.priceEth && event.paymentSymbol ? `${event.priceEth} ${event.paymentSymbol}` : "—"}</strong><time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleString()}</time>{event.etherscanUrl ? <a href={event.etherscanUrl} target="_blank" rel="noreferrer" aria-label="View transaction"><ExternalLink size={13} /></a> : null}</li>)}</ol> : !loading && !error ? <p className="t-note">No recent OpenSea NFT events for this wallet.</p> : null}
    {next && <button className="t-button" type="button" disabled={loading} onClick={() => void load(next)}>{loading ? "Loading…" : "Load older activity"}</button>}
    <p className="t-note">Transfers are shown as transfers; they do not prove a buy or sale.</p>
  </section>;
}
