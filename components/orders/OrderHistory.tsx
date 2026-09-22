"use client";
import { useEffect, useState } from "react";
import { readOrders, type SavedOrder } from "@/lib/web3/order-history";
export function OrderHistory({
  address,
  kind,
}: {
  address: string;
  kind: "filled" | "cancelled";
}) {
  const [orders, setOrders] = useState<SavedOrder[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    async function load() {
      const saved = readOrders(address);
      const updated: SavedOrder[] = [];
      for (const o of saved) {
        if (!active) return;
        try {
          const r = await fetch(`/api/orders/${o.hash}`);
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          updated.push({ ...o, status: d.status });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Status unavailable");
          updated.push(o);
          break;
        }
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
  }, [address]);
  const filtered = orders.filter((o) =>
    kind === "filled"
      ? o.status === "FULFILLED"
      : ["CANCELLED", "EXPIRED"].includes(o.status),
  );
  return (
    <div className="t-panel">
      <div className="panel-title">ORDERS CREATED IN THIS BROWSER</div>
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
        History covers orders submitted from this browser (maximum 200),
        verified against OpenSea when available. Other-device orders are not
        imported.{" "}
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
