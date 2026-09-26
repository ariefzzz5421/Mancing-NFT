import "server-only";
import { database, databaseConfigured } from "@/lib/server/watchlist-store";

export type TradeOrderRow = {
  order_hash: string;
  collection_slug: string;
  contract_address: string;
  token_id: string | null;
  side: "OFFER" | "LIST" | "BUY";
  price_wei: string;
  quantity: number;
  status: string;
  created_at: string;
  expires_at: string | null;
  filled_at: string | null;
  tx_hash: string | null;
};

export async function saveSubmittedTrade(input: {
  wallet: string; hash: string; slug: string; contract: string;
  tokenId: string | null; side: "OFFER" | "LIST";
  priceWei: string; quantity: number; expiresAt: string;
}) {
  if (!databaseConfigured()) return { saved: false, error: "Supabase is not configured" };
  const wallet = input.wallet.toLowerCase();
  const { error } = await database().from("trade_orders").upsert({
    owner_id: `wallet:${wallet}`,
    wallet_address: wallet,
    order_hash: input.hash,
    collection_slug: input.slug,
    contract_address: input.contract.toLowerCase(),
    token_id: input.tokenId,
    side: input.side,
    price_wei: input.priceWei,
    quantity: input.quantity,
    status: "ACTIVE",
    expires_at: input.expiresAt,
  }, { onConflict: "order_hash" });
  return error ? { saved: false, error: error.message } : { saved: true, error: null };
}

export async function listTrades(owner: string, limit = 100) {
  if (!databaseConfigured()) return { rows: [] as TradeOrderRow[], error: "Supabase is not configured" };
  const { data, error } = await database().from("trade_orders")
    .select("order_hash,collection_slug,contract_address,token_id,side,price_wei,quantity,status,created_at,expires_at,filled_at,tx_hash")
    .eq("owner_id", owner).order("created_at", { ascending: false }).limit(Math.min(200, limit));
  return { rows: (data ?? []) as TradeOrderRow[], error: error?.message ?? null };
}

export async function markVerifiedPositionListed(input: { wallet: string; contract: string; tokenId: string; priceWei: string }) {
  if (!databaseConfigured()) return;
  const wallet = input.wallet.toLowerCase();
  const { error } = await database().from("positions").update({
    listing_price_wei: input.priceWei,
    status: "LIST_ACTIVE",
    updated_at: new Date().toISOString(),
  }).eq("owner_id", `wallet:${wallet}`).eq("contract_address", input.contract.toLowerCase())
    .eq("token_id", input.tokenId).eq("status", "INVENTORY");
  if (error) throw new Error(error.message);
}
