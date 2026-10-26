"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { TrackedWalletsPanel } from "@/components/wallets/TrackedWalletsPanel";
import { useWatchlist } from "@/lib/watchlist";
import { getCollectionHref, getWatchlistKey } from "@/lib/chains";
import { NetworkBadge } from "@/components/NetworkBadge";

export function WalletsPage() {
  const { addWallet, hydrated, items, removeWallet } = useWatchlist();
  const [selected, setSelected] = useState("");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  function addTracked(event: FormEvent) {
    event.preventDefault();
    const collectionKey = selected || (items[0] ? `${items[0].chain}:${items[0].slug}` : "");
    const item = items.find((value) => `${value.chain}:${value.slug}` === collectionKey);
    if (!item) { setError("Choose a collection from your watchlist."); return; }
    if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) { setError("Enter a valid EVM wallet address."); return; }
    if (!label.trim()) { setError("Enter a wallet label."); return; }
    addWallet(item.slug, { address: address.trim(), label: label.trim() }, item.chain);
    setAddress(""); setLabel(""); setError("");
  }

  return (
    <main className="terminal-page wallet-tracker-page">
      <div className="support-page">
        <header className="terminal-heading">
          <div><span className="eyebrow">SAVED COLLECTIONS / WALLETS</span><h1>Wallet tracker</h1></div>
        </header>
        <p className="t-muted wallet-tracker-page__intro">Label wallets and follow their NFT activity for a saved collection.</p>

        <form className="wallet-tracker-add" onSubmit={addTracked}>
          <div><strong>Track a wallet</strong><p>Choose a collection, then label the wallet.</p></div>
          <select aria-label="Collection" disabled={!items.length} value={selected || (items[0] ? `${items[0].chain}:${items[0].slug}` : "")} onChange={(event) => setSelected(event.target.value)}>
            {!items.length && <option value="">Add a watchlist collection first</option>}
            {items.map((item) => <option key={`${item.chain}:${item.slug}`} value={`${item.chain}:${item.slug}`}>{item.name ?? item.slug} · {item.chain}</option>)}
          </select>
          <input aria-label="Wallet address" disabled={!items.length} placeholder="0x wallet address" value={address} onChange={(event) => setAddress(event.target.value)} />
          <input aria-label="Wallet label" disabled={!items.length} placeholder="e.g. Treasury" value={label} onChange={(event) => setLabel(event.target.value)} />
          <button className="button button--primary" type="submit" disabled={!items.length}>Add wallet</button>
          {error && <p className="t-error" role="alert">{error}</p>}
        </form>

        {hydrated && items.length === 0 ? (
          <section className="empty-state">
            <h2 className="text-lg font-semibold text-white">No collections in watchlist</h2>
            <p className="mt-2 text-sm text-slate-400">
              Add a collection first, then attach tracked wallets on its detail page.
            </p>
            <Link
              className="button button--primary mt-4"
              href="/"
            >
              Explore collections
            </Link>
          </section>
        ) : null}

        <div className="grid gap-6">
          {items.map((item) => (
            <section className="wallet-collection" key={getWatchlistKey(item.slug, item.chain)}>
              <div className="wallet-collection__header">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold text-white">{item.name ?? item.slug}</h2>
                    <NetworkBadge chain={item.chain} compact />
                  </div>
                  <p className="font-mono text-sm text-cyan-200">{item.slug}</p>
                </div>
                <Link
                  className="button button--secondary"
                  href={getCollectionHref(item.slug, item.chain)}
                >
                  Open collection
                </Link>
              </div>
              <TrackedWalletsPanel
                addWallet={(wallet) => addWallet(item.slug, wallet, item.chain)}
                chain={item.chain}
                removeWallet={(address) => removeWallet(item.slug, address, item.chain)}
                wallets={item.devWallets}
              />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
