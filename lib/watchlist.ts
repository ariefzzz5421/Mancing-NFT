"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_TARGET_FLOORS } from "@/lib/sweep";
import type { TrackedWallet, WatchlistItem } from "@/lib/types";
import {
  getWatchlistKey,
  parseSupportedChain,
  type SupportedChain,
} from "@/lib/chains";
import { useWallet } from "@/components/wallet/WalletProvider";

const WATCHLIST_STORAGE_KEY = "nft-sweep-depth-watchlist:v1";

function normalizeItem(item: Partial<WatchlistItem> & { slug: string }): WatchlistItem {
  return {
    addedAt: item.addedAt ?? new Date().toISOString(),
    chain: parseSupportedChain(item.chain),
    contractAddress: item.contractAddress ?? null,
    devWallets: item.devWallets ?? [],
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

export function useWatchlist() {
  const { userId, getAccessToken } = useWallet();
  const storageKey = userId ? `mancing-watchlist:privy:${userId}:v1` : WATCHLIST_STORAGE_KEY;
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setItems(readWatchlist(storageKey));
      setHydrated(true);
    });

    function handleStorage() {
      setItems(readWatchlist(storageKey));
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("watchlist-updated", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("watchlist-updated", handleStorage);
    };
  }, [storageKey]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    async function loadCloud() {
      try {
        const token = await getAccessToken();
        if (!token) throw Error("Privy session unavailable.");
        const response = await fetch("/api/watchlist", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw Error(payload.error ?? "Cloud watchlist unavailable.");
        if (active) {
          const list = (payload.items as WatchlistItem[]).map(normalizeItem);
          writeWatchlist(list, storageKey);
          setItems(list);
          setSyncError("");
        }
      } catch (error) {
        if (active) setSyncError(error instanceof Error ? error.message : "Cloud watchlist unavailable.");
      }
    }
    void loadCloud();
    return () => { active = false; };
  }, [storageKey, userId, getAccessToken]);

  const sync = useCallback(async (method: "POST" | "DELETE", item: WatchlistItem) => {
    if (!userId) return;
    try {
      const token = await getAccessToken();
      if (!token) throw Error("Privy session unavailable.");
      const response = await fetch(method === "POST" ? "/api/watchlist" : `/api/watchlist?slug=${encodeURIComponent(item.slug)}&chain=${encodeURIComponent(item.chain)}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
        body: method === "POST" ? JSON.stringify(item) : undefined,
      });
      const payload = await response.json();
      if (!response.ok) throw Error(payload.error ?? "Cloud sync failed.");
      setSyncError("");
    } catch (error) {
      setSyncError(`Cloud sync failed: ${error instanceof Error ? error.message : "try again"}. This browser has your latest changes.`);
    }
  }, [userId, getAccessToken]);

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

  return {
    addWallet,
    byKey,
    bySlug,
    hydrated,
    items,
    syncError,
    storage: userId ? "Supabase · Privy account" : "This browser",
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
