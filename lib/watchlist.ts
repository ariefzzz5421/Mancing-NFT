"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_TARGET_FLOORS } from "@/lib/sweep";
import type { TrackedWallet, WatchlistGroup, WatchlistItem } from "@/lib/types";
import {
  getWatchlistKey,
  parseSupportedChain,
  type SupportedChain,
} from "@/lib/chains";
import { useWallet } from "@/components/wallet/WalletProvider";

const WATCHLIST_STORAGE_KEY = "nft-sweep-depth-watchlist:v1";
const GROUPS_STORAGE_KEY = "mancing-watchlist-groups:v1";

function normalizeItem(item: Partial<WatchlistItem> & { slug: string }): WatchlistItem {
  return {
    addedAt: item.addedAt ?? new Date().toISOString(),
    chain: parseSupportedChain(item.chain),
    contractAddress: item.contractAddress ?? null,
    devWallets: item.devWallets ?? [],
    groupId: item.groupId ?? null,
    imageUrl: item.imageUrl ?? null,
    name: item.name,
    notes: item.notes,
    slug: item.slug.trim(),
    targetFloors: item.targetFloors?.length ? item.targetFloors : DEFAULT_TARGET_FLOORS,
  };
}

function readWatchlist(storageKey = WATCHLIST_STORAGE_KEY): WatchlistItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Partial<WatchlistItem> & { slug: string } => {
        return Boolean(item && typeof item === "object" && "slug" in item);
      })
      .map((item) => normalizeItem(item));
  } catch {
    return [];
  }
}

function writeWatchlist(items: WatchlistItem[], storageKey = WATCHLIST_STORAGE_KEY) {
  window.localStorage.setItem(storageKey, JSON.stringify(items));
  window.dispatchEvent(new Event("watchlist-updated"));
}

function readGroups(storageKey: string): WatchlistGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((group): group is WatchlistGroup =>
      !!group && typeof group.id === "string" && typeof group.name === "string" && typeof group.createdAt === "string") : [];
  } catch { return []; }
}

function writeGroups(groups: WatchlistGroup[], storageKey: string) {
  window.localStorage.setItem(storageKey, JSON.stringify(groups));
  window.dispatchEvent(new Event("watchlist-updated"));
}

export function useWatchlist() {
  const { userId } = useWallet();
  const storageKey = userId ? `mancing-watchlist:wallet:${userId}:v1` : WATCHLIST_STORAGE_KEY;
  const groupsKey = userId ? `mancing-watchlist-groups:${userId}:v1` : GROUPS_STORAGE_KEY;
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [groups, setGroups] = useState<WatchlistGroup[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setItems(readWatchlist(storageKey));
      setGroups(readGroups(groupsKey));
      setHydrated(true);
    });

    function handleStorage() {
      setItems(readWatchlist(storageKey));
      setGroups(readGroups(groupsKey));
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("watchlist-updated", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("watchlist-updated", handleStorage);
    };
  }, [storageKey, groupsKey]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    async function loadCloud() {
      try {
        const [response, groupResponse] = await Promise.all([
          fetch("/api/watchlist", { cache: "no-store" }),
          fetch("/api/watchlist/groups", { cache: "no-store" }),
        ]);
        const [payload, groupPayload] = await Promise.all([response.json(), groupResponse.json()]);
        if (!response.ok) throw Error(payload.error ?? "Cloud watchlist unavailable.");
        if (!groupResponse.ok) throw Error(groupPayload.error ?? "Cloud groups unavailable.");
        if (active) {
          const list = (payload.items as WatchlistItem[]).map(normalizeItem);
          const cloudGroups = groupPayload.groups as WatchlistGroup[];
          writeWatchlist(list, storageKey);
          writeGroups(cloudGroups, groupsKey);
          setItems(list);
          setGroups(cloudGroups);
          setSyncError("");
        }
      } catch (error) {
        if (active) setSyncError(error instanceof Error ? error.message : "Cloud watchlist unavailable.");
      }
    }
    void loadCloud();
    return () => { active = false; };
  }, [storageKey, groupsKey, userId]);

  const sync = useCallback(async (method: "POST" | "DELETE", item: WatchlistItem) => {
    if (!userId) return;
    try {
      const response = await fetch(method === "POST" ? "/api/watchlist" : `/api/watchlist?slug=${encodeURIComponent(item.slug)}&chain=${encodeURIComponent(item.chain)}`, {
        method,
        headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: method === "POST" ? JSON.stringify(item) : undefined,
      });
      const payload = await response.json();
      if (!response.ok) throw Error(payload.error ?? "Cloud sync failed.");
      setSyncError("");
    } catch (error) {
      setSyncError(`Cloud sync failed: ${error instanceof Error ? error.message : "try again"}. This browser has your latest changes.`);
    }
  }, [userId]);

  const persist = useCallback((nextItems: WatchlistItem[]) => {
    const normalized = nextItems.map((item) => normalizeItem(item));
    writeWatchlist(normalized, storageKey);
    setItems(normalized);
  }, [storageKey]);

  const upsertItem = useCallback(
    (item: Partial<WatchlistItem> & { slug: string }) => {
      const current = readWatchlist(storageKey);
      const chain = parseSupportedChain(item.chain);
      const existing = current.find(
        (candidate) => getWatchlistKey(candidate.slug, candidate.chain) === getWatchlistKey(item.slug, chain),
      );
      const nextItem = normalizeItem({
        ...existing,
        ...item,
        addedAt: existing?.addedAt ?? item.addedAt,
        devWallets: item.devWallets ?? existing?.devWallets,
        groupId: item.groupId === undefined ? existing?.groupId : item.groupId,
        targetFloors: item.targetFloors ?? existing?.targetFloors,
      });
      const nextItems = [
        nextItem,
        ...current.filter(
          (candidate) =>
            getWatchlistKey(candidate.slug, candidate.chain) !== getWatchlistKey(item.slug, chain),
        ),
      ].sort((left, right) => right.addedAt.localeCompare(left.addedAt));

      persist(nextItems);
      void sync("POST", nextItem);
      return nextItem;
    },
    [persist, storageKey, sync],
  );

  const removeItem = useCallback(
    (slug: string, chain: SupportedChain = "ethereum") => {
      const key = getWatchlistKey(slug, chain);
      const current = readWatchlist(storageKey);
      persist(
        current.filter((item) => getWatchlistKey(item.slug, item.chain) !== key),
      );
      const removed = current.find((item) => getWatchlistKey(item.slug, item.chain) === key);
      if (removed) void sync("DELETE", removed);
    },
    [persist, storageKey, sync],
  );

  const updateTargetFloors = useCallback(
    (slug: string, targetFloors: number[], chain: SupportedChain = "ethereum") => {
      const current = readWatchlist(storageKey);
      const key = getWatchlistKey(slug, chain);
      const next = current.map((item) =>
          getWatchlistKey(item.slug, item.chain) === key
            ? normalizeItem({ ...item, targetFloors })
            : item,
        );
      persist(next);
      const changed = next.find((item) => getWatchlistKey(item.slug, item.chain) === key);
      if (changed) void sync("POST", changed);
    },
    [persist, storageKey, sync],
  );

  const addWallet = useCallback(
    (slug: string, wallet: TrackedWallet, chain: SupportedChain = "ethereum") => {
      const current = readWatchlist(storageKey);
      const key = getWatchlistKey(slug, chain);
      const next = current.map((item) => {
          if (getWatchlistKey(item.slug, item.chain) !== key) {
            return item;
          }

          const devWallets = [
            wallet,
            ...item.devWallets.filter(
              (candidate) => candidate.address.toLowerCase() !== wallet.address.toLowerCase(),
            ),
          ];

          return normalizeItem({ ...item, devWallets });
        });
      persist(next);
      const changed = next.find((item) => getWatchlistKey(item.slug, item.chain) === key);
      if (changed) void sync("POST", changed);
    },
    [persist, storageKey, sync],
  );

  const removeWallet = useCallback(
    (slug: string, address: string, chain: SupportedChain = "ethereum") => {
      const current = readWatchlist(storageKey);
      const key = getWatchlistKey(slug, chain);
      const next = current.map((item) =>
          getWatchlistKey(item.slug, item.chain) === key
            ? normalizeItem({
                ...item,
                devWallets: item.devWallets.filter(
                  (wallet) => wallet.address.toLowerCase() !== address.toLowerCase(),
                ),
              })
            : item,
        );
      persist(next);
      const changed = next.find((item) => getWatchlistKey(item.slug, item.chain) === key);
      if (changed) void sync("POST", changed);
    },
    [persist, storageKey, sync],
  );

  const bySlug = useMemo(() => {
    return new Map(items.map((item) => [item.slug, item]));
  }, [items]);
  const byKey = useMemo(() => {
    return new Map(items.map((item) => [getWatchlistKey(item.slug, item.chain), item]));
  }, [items]);

  const createGroup = useCallback(async (name: string) => {
    const clean = name.trim();
    if (!clean || clean.length > 60) throw Error("Enter a group name up to 60 characters.");
    if (readGroups(groupsKey).some((group) => group.name.toLowerCase() === clean.toLowerCase())) throw Error("A group with that name already exists.");
    let group: WatchlistGroup;
    if (userId) {
      const response = await fetch("/api/watchlist/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: clean }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Could not create group.");
      group = data.group;
    } else group = { id: crypto.randomUUID(), name: clean, createdAt: new Date().toISOString() };
    const next = [...readGroups(groupsKey), group];
    writeGroups(next, groupsKey);
    setGroups(next);
    return group;
  }, [groupsKey, userId]);

  const renameGroup = useCallback(async (id: string, name: string) => {
    const clean = name.trim();
    if (!clean || clean.length > 60) throw Error("Enter a group name up to 60 characters.");
    if (readGroups(groupsKey).some((group) => group.id !== id && group.name.toLowerCase() === clean.toLowerCase())) throw Error("A group with that name already exists.");
    if (userId) {
      const response = await fetch("/api/watchlist/groups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name: clean }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Could not rename group.");
    }
    const next = readGroups(groupsKey).map((group) => group.id === id ? { ...group, name: clean } : group);
    writeGroups(next, groupsKey);
    setGroups(next);
  }, [groupsKey, userId]);

  const removeGroup = useCallback(async (id: string) => {
    if (userId) {
      const response = await fetch(`/api/watchlist/groups?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Could not remove group.");
    }
    const nextGroups = readGroups(groupsKey).filter((group) => group.id !== id);
    writeGroups(nextGroups, groupsKey);
    setGroups(nextGroups);
    const nextItems = readWatchlist(storageKey).map((item) => item.groupId === id ? { ...item, groupId: null } : item);
    persist(nextItems);
  }, [groupsKey, storageKey, persist, userId]);

  const assignGroup = useCallback((slug: string, chain: SupportedChain, groupId: string | null) => {
    const item = readWatchlist(storageKey).find((candidate) => getWatchlistKey(candidate.slug, candidate.chain) === getWatchlistKey(slug, chain));
    if (item) upsertItem({ ...item, groupId });
  }, [storageKey, upsertItem]);

  const importBrowserItems = useCallback(async () => {
    if (!userId) throw Error("Sign in with your wallet first.");
    const guest = readWatchlist();
    const guestGroups = readGroups(GROUPS_STORAGE_KEY);
    const current = readWatchlist(storageKey);
    const cloudGroups = readGroups(groupsKey);
    const groupMap = new Map<string, string>();
    for (const group of guestGroups) {
      const existing = cloudGroups.find((saved) => saved.name.toLowerCase() === group.name.toLowerCase());
      if (existing) { groupMap.set(group.id, existing.id); continue; }
      const response = await fetch("/api/watchlist/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: group.name }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Could not import browser group.");
      cloudGroups.push(data.group);
      groupMap.set(group.id, data.group.id);
    }
    let importedCount = 0;
    for (const item of guest) {
      if (current.some((saved) => getWatchlistKey(saved.slug, saved.chain) === getWatchlistKey(item.slug, item.chain))) continue;
      const imported = { ...item, groupId: item.groupId ? groupMap.get(item.groupId) ?? null : null };
      const response = await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(imported) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Could not import browser watchlist.");
      current.push(imported);
      importedCount++;
    }
    writeGroups(cloudGroups, groupsKey);
    setGroups(cloudGroups);
    persist(current);
    return importedCount;
  }, [userId, storageKey, groupsKey, persist]);

  return {
    addWallet,
    byKey,
    bySlug,
    hydrated,
    items,
    groups,
    createGroup,
    renameGroup,
    removeGroup,
    assignGroup,
    importBrowserItems,
    guestCount: userId
      ? readWatchlist().filter((guest) => !byKey.has(getWatchlistKey(guest.slug, guest.chain))).length
        + readGroups(GROUPS_STORAGE_KEY).filter((guest) => !groups.some((saved) => saved.name.toLowerCase() === guest.name.toLowerCase())).length
      : 0,
    signedIn: Boolean(userId),
    syncError,
    storage: userId ? "Supabase · signed wallet" : "This browser",
    removeItem,
    removeWallet,
    updateTargetFloors,
    upsertItem,
  };
}

export function getDefaultWatchlistItem(
  slug: string,
  chain: SupportedChain = "ethereum",
): WatchlistItem {
  return normalizeItem({ chain, slug });
}
