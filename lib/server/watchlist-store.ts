import "server-only";
import { PrivyClient } from "@privy-io/node";
import { createClient } from "@supabase/supabase-js";
import type { WatchlistItem } from "@/lib/types";
import { parseSupportedChain } from "@/lib/chains";

const projectUrl = "https://ecdbtggwqpvzljswjafe.supabase.co";

export function watchlistConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
}

export function databaseConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function database() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase server credential is not configured.");
  return createClient(projectUrl, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function authenticatedOwner(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const secret = process.env.PRIVY_APP_SECRET;
  if (!token || !appId || !secret) return null;
  try {
    const claims = await new PrivyClient({ appId, appSecret: secret }).utils().auth().verifyAccessToken(token);
    return claims.user_id;
  } catch {
    return null;
  }
}

type WatchlistRow = {
  chain: string; slug: string; name: string | null; image_url: string | null;
  contract_address: string | null; notes: string | null; target_floors: unknown;
  dev_wallets: unknown; added_at: string;
};

export function fromRow(row: WatchlistRow): WatchlistItem {
  return {
    chain: parseSupportedChain(row.chain), slug: row.slug,
    name: row.name ?? undefined, imageUrl: row.image_url,
    contractAddress: row.contract_address, notes: row.notes ?? undefined,
    addedAt: row.added_at,
    targetFloors: Array.isArray(row.target_floors)
      ? row.target_floors.filter((value): value is number => typeof value === "number" && Number.isFinite(value)) : [],
    devWallets: Array.isArray(row.dev_wallets)
      ? row.dev_wallets.filter((wallet): wallet is { address: string; label: string; notes?: string } =>
          !!wallet && typeof wallet === "object" && typeof wallet.address === "string" && typeof wallet.label === "string") : [],
  };
}

export function validateItem(input: unknown): WatchlistItem | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Partial<WatchlistItem>;
  if (
    typeof item.slug !== "string" || !/^[a-z0-9][a-z0-9_-]{0,159}$/i.test(item.slug) ||
    !["ethereum", "ape_chain"].includes(String(item.chain)) ||
    (item.name != null && (typeof item.name !== "string" || item.name.length > 180)) ||
    (item.notes != null && (typeof item.notes !== "string" || item.notes.length > 1000)) ||
    (item.imageUrl != null && (typeof item.imageUrl !== "string" || item.imageUrl.length > 2048)) ||
    (item.contractAddress != null && (typeof item.contractAddress !== "string" || !/^0x[a-f0-9]{40}$/i.test(item.contractAddress))) ||
    typeof item.addedAt !== "string" || !Number.isFinite(Date.parse(item.addedAt)) ||
    !Array.isArray(item.targetFloors) || item.targetFloors.length > 20 ||
    !item.targetFloors.every((value) => typeof value === "number" && Number.isFinite(value) && value > 0) ||
    !Array.isArray(item.devWallets) || item.devWallets.length > 50 ||
    !item.devWallets.every((wallet) => wallet && typeof wallet.address === "string" && /^0x[a-f0-9]{40}$/i.test(wallet.address) && typeof wallet.label === "string" && wallet.label.length <= 100 && (wallet.notes == null || (typeof wallet.notes === "string" && wallet.notes.length <= 500)))
  ) return null;
  return item as WatchlistItem;
}
