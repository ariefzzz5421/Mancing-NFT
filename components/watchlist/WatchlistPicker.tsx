"use client";

import { useEffect, useState } from "react";
import { Plus, Star, X } from "lucide-react";
import { getWatchlistKey, type SupportedChain } from "@/lib/chains";
import { useWatchlist } from "@/lib/watchlist";

export type WatchlistCandidate = {
  slug: string;
  chain: SupportedChain;
  name?: string;
  imageUrl?: string | null;
};

export function WatchlistPicker({ item, onClose, initialGroupId = null }: {
  item: WatchlistCandidate;
  onClose: () => void;
  initialGroupId?: string | null;
}) {
  const watchlist = useWatchlist();
  const saved = watchlist.byKey.get(getWatchlistKey(item.slug, item.chain));
  const [groupId, setGroupId] = useState<string | null>(saved?.groupId ?? initialGroupId);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function createGroup(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const group = await watchlist.createGroup(newName);
      setGroupId(group.id);
      setNewName("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create group."); }
    finally { setBusy(false); }
  }

  function save() {
    watchlist.upsertItem({ ...item, groupId });
    onClose();
  }

  return <div className="watchlist-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="watchlist-modal" role="dialog" aria-modal="true" aria-labelledby="watchlist-dialog-title">
      <div className="watchlist-modal__head">
        <div><small>COLLECTION RADAR</small><h2 id="watchlist-dialog-title">Save to watchlist</h2></div>
        <button type="button" aria-label="Close watchlist dialog" onClick={onClose}><X size={18} /></button>
      </div>
      <p className="watchlist-modal__collection"><Star size={16} aria-hidden="true" /> {item.name ?? item.slug}<small>{item.chain.replaceAll("_", " ")}</small></p>
      <fieldset className="watchlist-modal__groups">
        <legend>Choose a group</legend>
        <label><input type="radio" name="watchlist-group" checked={groupId === null} onChange={() => setGroupId(null)} /> Default <small>Every wallet has this list</small></label>
        {watchlist.groups.map((group) => <label key={group.id}><input type="radio" name="watchlist-group" checked={groupId === group.id} onChange={() => setGroupId(group.id)} /> {group.name}</label>)}
      </fieldset>
      <form className="watchlist-modal__new" onSubmit={(event) => void createGroup(event)}>
        <label htmlFor="watchlist-dialog-new-group">New group</label>
        <div><input id="watchlist-dialog-new-group" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={60} placeholder="e.g. High liquidity" /><button className="t-button" type="submit" disabled={busy || !watchlist.cloudReady || !newName.trim()}><Plus size={15} /> Create</button></div>
      </form>
      {error && <p className="t-error" role="alert">{error}</p>}
      {watchlist.syncError && <p className="t-error" role="alert">{watchlist.syncError}</p>}
      <div className="watchlist-modal__actions">
        {saved && <button className="t-button" type="button" onClick={() => { watchlist.removeItem(item.slug, item.chain); onClose(); }}>Remove from watchlist</button>}
        <button className="t-button t-primary" type="button" onClick={save} disabled={busy || !watchlist.cloudReady}>{!watchlist.cloudReady ? "Loading wallet list…" : saved ? "Save group" : "Add to watchlist"}</button>
      </div>
      <p className="t-note">{watchlist.signedIn ? "Saved for your signed wallet in Supabase." : "Saved in this browser until you sign in with a wallet."}</p>
    </div>
  </div>;
}

export function WatchlistStar({ item, className = "", showText = false }: {
  item: WatchlistCandidate;
  className?: string;
  showText?: boolean;
}) {
  const watchlist = useWatchlist();
  const [open, setOpen] = useState(false);
  const saved = watchlist.byKey.has(getWatchlistKey(item.slug, item.chain));
  return <>
    <button type="button" className={`watchlist-star ${saved ? "is-active" : ""} ${className}`} aria-label={`${saved ? "Manage" : "Add"} ${item.name ?? item.slug} ${saved ? "in" : "to"} watchlist`} title={saved ? "Manage watchlist group" : "Add to watchlist"} onClick={() => setOpen(true)}>
      <Star size={18} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
      {showText && <span>{saved ? "Watchlisted" : "Watch collection"}</span>}
    </button>
    {open && <WatchlistPicker item={item} onClose={() => setOpen(false)} />}
  </>;
}
