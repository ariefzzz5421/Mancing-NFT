"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { OrderHistory } from "./OrderHistory";
import type { OrderComponents } from "@opensea/seaport-js/lib/types";
import type { NormalizedOrder, Book, Stats } from "@/types/market";
import {
  useWallet,
  WalletConnect,
  injected,
} from "@/components/wallet/WalletProvider";
import { eth, wei, price } from "@/lib/quant/book";
type NFT = {
  tokenId: string;
  contract: string;
  collection: string;
  name: string;
  image: string | null;
};
type Order = NormalizedOrder & { parameters: OrderComponents };
export function AccountLedger({
  view,
}: {
  view: "wallet" | "orders" | "positions";
}) {
  const w = useWallet(),
    [tab, setTab] = useState(view === "orders" ? "offers" : "nfts"),
    [nfts, setNfts] = useState<NFT[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [next, setNext] = useState<string | null>(null),
    [nonce, setNonce] = useState(0),
    [cancel, setCancel] = useState<Order | null>(null);
  async function load(cursor?: string, signal?: AbortSignal) {
    if (!w.address || tab === "filled" || tab === "cancelled") return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/account/${w.address}?kind=${tab}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        { signal },
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (tab === "nfts") setNfts((x) => (cursor ? [...x, ...d.rows] : d.rows));
      else setOrders((x) => (cursor ? [...x, ...d.rows] : d.rows));
      setNext(d.next);
    } catch (e) {
      if (!signal?.aborted)
        setError(e instanceof Error ? e.message : "Account data unavailable");
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    queueMicrotask(() => {
      setOrders([]);
      setNfts([]);
      setNext(null);
      setCancel(null);
    });
    if (!w.address || tab === "filled" || tab === "cancelled") return;
    const c = new AbortController();
    queueMicrotask(() => void load(undefined, c.signal));
    return () =>
      c.abort(); /* account/tab changes invalidate the entire ledger */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.address, tab, nonce]);
  async function cancelOrder() {
    if (!cancel || !w.address || !injected()) return;
    setBusy(true);
    try {
      if (cancel.maker.toLowerCase() !== w.address.toLowerCase())
        throw Error("Connected wallet does not own this order");
      const { cancelWalletOrder } = await import("@/lib/web3/trade");
      await cancelWalletOrder(injected()!, cancel.parameters, w.address);
      const { markCancelled } = await import("@/lib/web3/order-history");
      markCancelled(w.address, cancel.orderHash);
      setCancel(null);
      setNonce((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancellation failed");
    } finally {
      setBusy(false);
    }
  }
  const history = tab === "filled" || tab === "cancelled";
  return (
    <main className="terminal-page">
      <div className="terminal-heading">
        <div>
          <span className="eyebrow">CONNECTED WALLET / ETHEREUM</span>
          <h1>
            {view === "wallet"
              ? "Wallet."
              : view === "orders"
                ? "Order ledger."
                : "Positions."}
          </h1>
        </div>
        <WalletConnect />
      </div>
      {w.error && (
        <p role="alert" className="t-error">
          {w.error}
        </p>
      )}
      {w.address ? (
        <>
          <div className="wallet-summary">
            <div>
              <span className="t-muted">ACCOUNT</span>
              <br />
              <code>{w.address}</code>
            </div>
            <div>
              <span className="t-muted">ETH</span>
              <br />
              {w.eth ?? "Unavailable"}
            </div>
            <div>
              <span className="t-muted">WETH</span>
              <br />
              {w.weth ?? "Unavailable"}
            </div>
            <button
              className="t-button"
              onClick={() => {
                void w.refresh();
                setNonce((n) => n + 1);
              }}
              disabled={busy}
            >
              Refresh
            </button>
          </div>
          {view === "wallet" && (
            <p className="t-note">
              <Link href="/wallets">
                Open existing wallet tracking & creator research ↗
              </Link>
            </p>
          )}
          {view !== "positions" && (
            <div className="ledger-tabs">
              {(view === "wallet"
                ? [
                    ["nfts", "Owned NFTs"],
                    ["offers", "Open offers"],
                    ["listings", "Active listings"],
                  ]
                : [
                    ["offers", "Open offers"],
                    ["listings", "Active listings"],
                    ["filled", "Filled"],
                    ["cancelled", "Cancelled / expired"],
                  ]
              ).map(([k, l]) => (
                <button
                  className="t-button"
                  key={k}
                  aria-pressed={tab === k}
                  onClick={() => setTab(k)}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
          {error && (
            <p className="t-error" role="alert">
              {error}
            </p>
          )}
          {history ? (
            <OrderHistory
              key={w.address + tab}
              address={w.address}
              kind={tab as "filled" | "cancelled"}
            />
          ) : tab === "nfts" ? (
            <div className="position-grid">
              {nfts.map((n) =>
                view === "positions" ? (
                  <Position key={`${n.contract}:${n.tokenId}`} nft={n} />
                ) : (
                  <div
                    className="watchlist-entry t-panel"
                    key={`${n.contract}:${n.tokenId}`}
                  >
                    <div>
                      <strong>{n.name}</strong>
                      <small>
                        {n.collection} · #{n.tokenId}
                      </small>
                    </div>
                    <Link
                      className="t-button"
                      href={`/terminal/${encodeURIComponent(n.collection)}`}
                    >
                      Open terminal
                    </Link>
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="terminal-table">
                <thead>
                  <tr>
                    {[
                      "Collection / NFT",
                      "Side",
                      "Price",
                      "Qty",
                      "Created",
                      "Expiration",
                      "Status",
                      "Action",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.orderHash}>
                      <td>
                        {o.collection || "Collection"}{" "}
                        {o.tokenId ? `#${o.tokenId}` : "Collection offer"}
                      </td>
                      <td>{o.side}</td>
                      <td>{eth(o.priceWei)}</td>
                      <td>{o.quantity}</td>
                      <td>{new Date(o.created * 1000).toLocaleString()}</td>
                      <td>{new Date(o.expiration * 1000).toLocaleString()}</td>
                      <td>Active (API snapshot)</td>
                      <td>
                        <button
                          className="t-button"
                          disabled={
                            busy ||
                            o.protocol.toLowerCase() !==
                              "0x0000000000000068f116a894984e2db1123eb395"
                          }
                          onClick={() => setCancel(o)}
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!history &&
            !busy &&
            !error &&
            !(tab === "nfts" ? nfts : orders).length && (
              <div className="ledger-empty">
                No supported {tab} returned for this wallet.
              </div>
            )}
          {busy && (
            <p role="status" className="t-note">
              Loading wallet records…
            </p>
          )}
          {next && !history && (
            <button
              className="t-button"
              disabled={busy}
              onClick={() => void load(next)}
            >
              Load more
            </button>
          )}
          {cancel && (
            <div className="order-review">
              <h2>Cancel order {cancel.orderHash.slice(0, 12)}…</h2>
              <p>
                On-chain cancellation uses gas and permanently invalidates this
                order. Review the transaction in your wallet.
              </p>
              <button
                className="t-button"
                disabled={busy}
                onClick={cancelOrder}
              >
                Confirm cancellation in wallet
              </button>{" "}
              <button className="t-button" onClick={() => setCancel(null)}>
                Keep order
              </button>
            </div>
          )}
          <p className="t-note">
            Ethereum only. Paginated account snapshot; collections and orders on
            other chains are not included.
          </p>
        </>
      ) : (
        <div className="t-panel ledger-empty">
          Connect your wallet to load{" "}
          {view === "positions"
            ? "owned NFTs and position estimates"
            : "balances, owned NFTs and orders"}
          . No signature is needed to read your public holdings.
        </div>
      )}
    </main>
  );
}
function Position({ nft }: { nft: NFT }) {
  const wallet = useWallet();
  const [basis, setBasis] = useState("Manual, unverified cost basis"),
    [held, setHeld] = useState<string | null>(null);
  const [entry, setEntry] = useState(""),
    [data, setData] = useState<{ stats: Stats | null; book: Book | null }>({
      stats: null,
      book: null,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function inspect() {
    setBusy(true);
    try {
      const [s, b, acquisition] = await Promise.all([
        fetch(`/api/collections/${nft.collection}/stats`).then((r) => r.json()),
        fetch(`/api/collections/${nft.collection}/orders`).then((r) =>
          r.json(),
        ),
        fetch(
          `/api/positions/${wallet.address}/${nft.contract}/${nft.tokenId}`,
        ).then((r) => r.json()),
      ]);
      if (acquisition.entryWei) {
        setEntry(eth(acquisition.entryWei));
        setBasis("OpenSea latest ownership event (sale)");
        setHeld(
          `${Math.floor((Date.now() - acquisition.acquiredAt) / 3600000)}h ${Math.floor((Date.now() - acquisition.acquiredAt) / 60000) % 60}m at last check`,
        );
      } else
        setBasis(
          acquisition.source ?? "Acquisition data unavailable; manual input",
        );
      setData({ stats: s.error ? null : s, book: b.error ? null : b });
      setError(s.error ?? b.error ?? b.errors?.join(" · ") ?? "");
    } catch {
      setError("Position pricing unavailable");
    } finally {
      setBusy(false);
    }
  }
  const e = wei(entry),
    bid = data.book?.bids[0]?.priceWei,
    floor = data.stats?.floor != null ? wei(String(data.stats.floor)) : null;
  return (
    <section className="t-panel">
      <div className="panel-title">
        <span>
          {nft.name} / #{nft.tokenId}
        </span>
        <button onClick={inspect} disabled={busy}>
          {busy ? "Loading…" : "Load marks"}
        </button>
      </div>
      <label className="t-field">
        Entry price / ETH — {basis}
        <input
          value={entry}
          onChange={(e) => {
            setEntry(e.target.value);
            setBasis("Manual, unverified cost basis");
          }}
          inputMode="decimal"
          placeholder="Unknown acquisition price"
        />
      </label>
      <dl className="metric-list">
        <div>
          <dt>Current floor</dt>
          <dd>{price(data.stats?.floor)} ETH</dd>
        </div>
        <div>
          <dt>Best collection bid</dt>
          <dd>{eth(bid)} WETH</dd>
        </div>
        <div>
          <dt>Mark-to-floor P/L</dt>
          <dd>{e && floor ? eth(floor - e) : "—"} ETH</dd>
        </div>
        <div>
          <dt>Bid-based P/L before fees</dt>
          <dd>{e && bid ? eth(BigInt(bid) - e) : "—"} ETH</dd>
        </div>
        <div>
          <dt>Bid-based ROI before fees</dt>
          <dd>
            {e && bid
              ? `${Number(((BigInt(bid) - e) * 10000n) / e) / 100}%`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Holding duration</dt>
          <dd>{held ?? "Acquisition history unavailable"}</dd>
        </div>
      </dl>
      {error && <p className="t-error">{error}</p>}
      <p className="t-note">
        Floor is an asking price, not an executable exit. Bid eligibility and
        funding must be checked before sale. Transfers do not establish a
        purchase cost.
      </p>
      <div className="t-links">
        <Link href={`/terminal/${nft.collection}`}>
          Open collection terminal ↗
        </Link>
      </div>
    </section>
  );
}
