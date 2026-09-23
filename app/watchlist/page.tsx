"use client";
import { useState } from "react";
import Link from "next/link";
import { Pencil, Star, Trash2 } from "lucide-react";
import { useWatchlist } from "@/lib/watchlist";
import { useWallet } from "@/components/wallet/WalletProvider";
import { CollectionSearch } from "@/components/terminal/CollectionSearch";

export default function Page() {
  const watchlist = useWatchlist();
  const wallet = useWallet();
  const [slug, setSlug] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [inputError, setInputError] = useState("");
  const [notice, setNotice] = useState("");
  const visible = selectedGroup ? watchlist.items.filter((item) => item.groupId === selectedGroup) : watchlist.items;

  function add(event: React.FormEvent) {
    event.preventDefault();
    const clean = slug.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,159}$/.test(clean)) {
      setInputError("Enter a valid OpenSea collection slug.");
      return;
    }
    watchlist.upsertItem({ slug: clean, chain: "ethereum", groupId: selectedGroup });
    setSlug("");
    setInputError("");
  }

  async function createGroup(event: React.FormEvent) {
    event.preventDefault();
    try {
      const group = await watchlist.createGroup(groupName);
      setSelectedGroup(group.id);
      setGroupName("");
      setInputError("");
    } catch (cause) { setInputError(cause instanceof Error ? cause.message : "Could not create group."); }
  }

  async function renameGroup(event: React.FormEvent) {
    event.preventDefault();
    if (!editingId) return;
    try {
      await watchlist.renameGroup(editingId, editingName);
      setEditingId(null);
      setInputError("");
    } catch (cause) { setInputError(cause instanceof Error ? cause.message : "Could not rename group."); }
  }

  return <main className="terminal-page">
    <div className="terminal-heading">
      <div><span className="eyebrow">YOUR COLLECTION RADAR</span><h1>Watchlist.</h1></div>
    </div>
    <CollectionSearch />
    <div className="watchlist-toolbar">
      <form className="watchlist-add" onSubmit={add}>
        <label htmlFor="watchlist-slug">Add collection by OpenSea slug</label>
        <div>
          <input id="watchlist-slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="e.g. pudgypenguins" />
          <button className="t-button t-primary" type="submit"><Star size={15} aria-hidden="true" /> Add collection</button>
        </div>
      </form>
      <form className="watchlist-add" onSubmit={(event) => void createGroup(event)}>
        <label htmlFor="watchlist-group-name">Create a named watchlist group</label>
        <div>
          <input id="watchlist-group-name" maxLength={60} value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. High liquidity" />
          <button className="t-button" type="submit">Create group</button>
        </div>
      </form>
    </div>
    {inputError && <p className="t-error" role="alert">{inputError}</p>}
    {watchlist.syncError && <p className="t-error" role="alert">{watchlist.syncError}</p>}
    {notice && <p className="t-note" role="status">{notice}</p>}
    <div className="watchlist-session-note">
      <span>{watchlist.signedIn ? "Saved to Supabase for this wallet." : "Saved in this browser. Sign in with a wallet to save across devices."}</span>
      {wallet.address && !watchlist.signedIn && <button className="t-button" onClick={() => void wallet.signIn().catch((cause) => setInputError(cause instanceof Error ? cause.message : "Wallet sign-in failed."))}>Sign in to sync</button>}
      {watchlist.signedIn && watchlist.guestCount > 0 && <button className="t-button" onClick={() => void watchlist.importBrowserItems().then((count) => setNotice(`${count} browser collections imported; named groups were kept.`)).catch((cause) => setInputError(cause instanceof Error ? cause.message : "Import failed."))}>Import browser watchlist</button>}
    </div>
    <div className="watchlist-groups" role="tablist" aria-label="Watchlist groups">
      <button type="button" role="tab" aria-selected={!selectedGroup} className={!selectedGroup ? "is-active" : ""} onClick={() => setSelectedGroup(null)}>All <span>{watchlist.items.length}</span></button>
      {watchlist.groups.map((group) => <button type="button" role="tab" aria-selected={selectedGroup === group.id} className={selectedGroup === group.id ? "is-active" : ""} onClick={() => setSelectedGroup(group.id)} key={group.id}>{group.name} <span>{watchlist.items.filter((item) => item.groupId === group.id).length}</span></button>)}
    </div>
    {selectedGroup && <div className="watchlist-group-actions">
      {editingId === selectedGroup ? <form onSubmit={(event) => void renameGroup(event)}>
        <input aria-label="Rename group" maxLength={60} value={editingName} onChange={(event) => setEditingName(event.target.value)} />
        <button className="t-button" type="submit">Save name</button>
        <button className="t-button" type="button" onClick={() => setEditingId(null)}>Cancel</button>
      </form> : <>
        <button className="t-button" onClick={() => { setEditingId(selectedGroup); setEditingName(watchlist.groups.find((group) => group.id === selectedGroup)?.name ?? ""); }}><Pencil size={14} aria-hidden="true" /> Rename group</button>
        <button className="t-button" onClick={() => void watchlist.removeGroup(selectedGroup).then(() => setSelectedGroup(null)).catch((cause) => setInputError(cause instanceof Error ? cause.message : "Could not remove group."))}><Trash2 size={14} aria-hidden="true" /> Delete group</button>
      </>}
      <span>Deleting a group keeps its collections in All.</span>
    </div>}
    <div className="t-panel">
      {visible.map((item) => <div className="watchlist-entry" key={`${item.chain}:${item.slug}`}>
        <Link href={item.chain === "ethereum" ? `/terminal/${item.slug}` : `/collection/${item.slug}?chain=${item.chain}`}>
          <strong>{item.name ?? item.slug}</strong><small>{item.chain} · {item.notes ?? "Open terminal"}</small>
        </Link>
        <div className="watchlist-entry__controls">
          <select aria-label={`Group for ${item.name ?? item.slug}`} value={item.groupId ?? ""} onChange={(event) => watchlist.assignGroup(item.slug, item.chain, event.target.value || null)}>
            <option value="">Ungrouped</option>
            {watchlist.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
          <button className="watchlist-star is-active" aria-label={`Remove ${item.name ?? item.slug} from watchlist`} title="Remove from watchlist" onClick={() => watchlist.removeItem(item.slug, item.chain)}><Star size={19} fill="currentColor" aria-hidden="true" /></button>
        </div>
      </div>)}
      {watchlist.hydrated && !visible.length && <div className="ledger-empty">{selectedGroup ? "No collections in this group yet. Add one above or assign an existing collection." : "Find a collection and select the star to watch it."}</div>}
    </div>
    <p className="t-note">Storage: {watchlist.storage}. A wallet signature signs you in; it does not submit a transaction.</p>
  </main>;
}
