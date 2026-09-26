"use client";
import { useEffect, useState } from "react";
import type { ActivityApiResponse } from "@/lib/types";

export function RecentActivity({ slug }: { slug: string }) {
  const [data, setData] = useState<ActivityApiResponse | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/activity/${encodeURIComponent(slug)}?chain=ethereum&limit=12`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw Error(payload.error ?? "OpenSea activity unavailable");
        setData(payload);
        setError("");
      }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Activity unavailable"); });
    return () => controller.abort();
  }, [slug, revision]);
  return <section className="t-panel recent-activity">
    <div className="panel-title"><span>RECENT ACTIVITY</span><button type="button" onClick={() => setRevision((value) => value + 1)}>Refresh</button></div>
    {error ? <p className="t-error">{error}</p> : !data ? <p className="t-note">Loading verified OpenSea events…</p> : data.events.length ?
      <div className="recent-activity__list">{data.events.slice(0, 12).map((event) => <div key={event.id} className="recent-activity__row">
        <span className={`recent-activity__type recent-activity__type--${event.eventType}`}>{event.eventType === "unknown" ? "Event" : event.eventType.replaceAll("_", " ")}</span>
        <span className="recent-activity__asset">{event.tokenName ?? (event.tokenId ? `#${event.tokenId}` : "Collection")}</span>
        <strong>{event.priceEth != null ? `${event.priceEth.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${event.paymentSymbol ?? "ETH"}` : "—"}</strong>
        <time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleTimeString()}</time>
      </div>)}</div> : <p className="t-note">No recent collection events returned.</p>}
    <p className="t-note">OpenSea activity snapshot. Confirm fills and ownership on Ethereum before listing.</p>
  </section>;
}
