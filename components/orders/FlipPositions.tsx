"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { eth } from "@/lib/quant/book";

type Position = { id: string; collection_slug: string; token_id: string; entry_price_wei: string; listing_price_wei: string | null; exit_price_wei: string | null; status: string; created_at: string; entry_order_hash: string };

export function FlipPositions({ address }: { address: string }) {
  const [rows, setRows] = useState<Position[]>([]);
  const [listings, setListings] = useState<Array<{ order_hash: string; collection_slug: string; token_id: string | null; side: string }>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/trade-positions", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error ?? "Positions unavailable");
        setRows(data.rows);
      }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Positions unavailable"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    fetch("/api/trade-orders", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : { rows: [] })
      .then((data) => { if (!controller.signal.aborted) setListings(data.rows ?? []); }).catch(() => {});
    return () => controller.abort();
  }, [address]);
  async function verifyExit(hash: string) {
    try {
      const response = await fetch("/api/flip/reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Exit verification unavailable");
      if (data.verified) setRows((previous) => previous.map((row) => row.token_id === data.tokenId ? { ...row, status: "SOLD", exit_price_wei: data.exitPriceWei } : row));
      else setError(data.message ?? `Listing is ${data.status?.toLowerCase() ?? "not sold"}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Exit verification unavailable"); }
  }
  return <section className="t-panel flip-positions">
    <div className="panel-title"><span>FLIP FLOP POSITIONS</span><span>VERIFIED INVENTORY</span></div>
    {error && <p className="t-error">{error}</p>}
    <div className="table-scroll"><table className="terminal-table"><thead><tr><th>Collection / NFT</th><th>Entry</th><th>Listed</th><th>Exit</th><th>Status</th><th>Entry order</th><th>Action</th></tr></thead><tbody>
      {rows.map((row) => { const listing = listings.find((order) => order.side === "LIST" && order.collection_slug === row.collection_slug && order.token_id === row.token_id); return <tr key={row.id}><td>{row.collection_slug} #{row.token_id}</td><td>{eth(row.entry_price_wei)} WETH</td><td>{eth(row.listing_price_wei)} ETH</td><td>{eth(row.exit_price_wei)} ETH</td><td>{row.status}</td><td><code>{row.entry_order_hash.slice(0, 10)}…</code></td><td>{row.status === "LIST_ACTIVE" && listing ? <button className="t-button" onClick={() => void verifyExit(listing.order_hash)}>Verify exit</button> : <Link href={`/terminal/${encodeURIComponent(row.collection_slug)}`}>Open terminal ↗</Link>}</td></tr>; })}
    </tbody></table></div>
    {!rows.length && <p className="t-note">{loading ? "Loading signed-wallet positions…" : "No verified Flip Flop inventory yet. A filled offer needs Ethereum receipt and ownership verification."}</p>}
    <p className="t-note">Current mark-to-floor and executable-bid estimates appear in the owned-NFT position analysis below. A floor listing is not an immediate exit.</p>
  </section>;
}
