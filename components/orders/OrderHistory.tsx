"use client";
import { useEffect, useState } from "react";
import { readOrders, type SavedOrder } from "@/lib/web3/order-history";
import { eth } from "@/lib/quant/book";
export function OrderHistory({
  address,
  kind,
}: {
  address: string;
  kind: "filled" | "cancelled";
}) {
  const [orders, setOrders] = useState<SavedOrder[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [source, setSource] = useState("Signed wallet"),
    [legacyOnly, setLegacyOnly] = useState<SavedOrder[]>([]),
    [importing, setImporting] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      const legacy = readOrders(address);
      let saved = legacy;
      try {
        const response = await fetch("/api/trade-orders", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw Error(payload.error ?? "Cloud history unavailable");
        const cloud: SavedOrder[] = payload.rows.map((row: { order_hash: string; collection_slug: string; side: string; price_wei: string; quantity: number; created_at: string; expires_at: string | null; status: string }) => ({
          hash: row.order_hash, collection: row.collection_slug, side: row.side,
          price: eth(row.price_wei), quantity: row.quantity,
          created: Date.parse(row.created_at), expiration: row.expires_at ? Date.parse(row.expires_at) : 0,
          status: row.status,
        }));
        const missing = legacy.filter((order) => !cloud.some((item) => item.hash.toLowerCase() === order.hash.toLowerCase()));
        saved = [...cloud, ...missing];
        if (active) setLegacyOnly(missing);
        if (active) setSource(legacy.length > cloud.length ? "Supabase + legacy browser orders" : "Supabase · signed wallet");
      } catch (cause) {
        if (active) { setSource("Browser backup"); setError(cause instanceof Error ? cause.message : "Cloud history unavailable"); }
      }
      if (active) { setOrders(saved); setBusy(false); }
      const updated = [...saved];
      for (let index = 0; index < Math.min(saved.length, 20); index += 4) {
        const batch = await Promise.all(saved.slice(index, index + 4).map(async (order) => {
          try {
            const response = await fetch(`/api/orders/${order.hash}`);
            const payload = await response.json();
            return response.ok ? { ...order, status: payload.status } : order;
          } catch { return order; }
        }));
        updated.splice(index, batch.length, ...batch);
        if (!active) return;
        setOrders([...updated]);
      }
      if (active) {
        setOrders(updated);
        setBusy(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [address, revision]);
  async function importLegacy() {
    if (!legacyOnly.length) return;
    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/trade-orders/import", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: legacyOnly.slice(0, 10).map((order) => ({ hash: order.hash, collection: order.collection })) }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Import unavailable");
      if (data.skipped?.length) setError(`${data.imported} imported; ${data.skipped.length} could not be verified against OpenSea.`);
      setRevision((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Import unavailable"); }
    finally { setImporting(false); }
  }
  const filtered = orders.filter((o) =>
    kind === "filled"
      ? ["FULFILLED", "FILLED"].includes(o.status)
      : ["CANCELLED", "EXPIRED"].includes(o.status),
  );
  return (
    <div className="t-panel">
      <div className="panel-title">TRADE HISTORY <span>{source}</span></div>
      {legacyOnly.length > 0 && <div className="legacy-import"><span>{legacyOnly.length} older browser order{legacyOnly.length === 1 ? "" : "s"} need verified cloud import.</span><button className="t-button" type="button" disabled={importing} onClick={() => void importLegacy()}>{importing ? "Verifying…" : "Import next 10"}</button></div>}
      {error && <p className="t-error">{error}</p>}
      <div className="table-scroll">
        <table className="terminal-table">
          <thead>
            <tr>
              {[
                "Collection",
                "Side",
                "Price",
                "Qty",
                "Created",
                "Expiration",
                "Status",
                "Order hash",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.hash}>
                <td>{o.collection}</td>
                <td>{o.side}</td>
                <td>{o.price}</td>
                <td>{o.quantity}</td>
                <td>{new Date(o.created).toLocaleString()}</td>
                <td>{new Date(o.expiration).toLocaleString()}</td>
                <td>{o.status}</td>
                <td><code title={o.hash}>{o.hash.slice(0, 10)}…{o.hash.slice(-6)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="ledger-empty">
          {busy
            ? "Checking recorded order status…"
            : "No matching recorded orders."}
        </div>
      )}
      <p className="t-note">
        Signed-wallet cloud orders sync across devices. Earlier browser-only orders remain as a local backup; status is checked against OpenSea when available.{" "}
        <a
          href={`https://opensea.io/${address}`}
          target="_blank"
          rel="noreferrer"
        >
          Full OpenSea activity ↗
        </a>
      </p>
    </div>
  );
}
