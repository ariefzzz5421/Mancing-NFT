import { authenticatedOwner, database, databaseConfigured } from "@/lib/server/watchlist-store";

export async function GET(request: Request) {
  const owner = await authenticatedOwner(request);
  if (!owner) return Response.json({ error: "Sign in with your connected wallet to load Flip Flop positions." }, { status: 401 });
  if (!databaseConfigured()) return Response.json({ error: "Trade database is not configured." }, { status: 503 });
  const { data, error } = await database().from("positions")
    .select("id,collection_slug,contract_address,token_id,entry_price_wei,entry_order_hash,entry_tx_hash,current_floor_wei,listing_price_wei,exit_price_wei,exit_tx_hash,status,created_at,closed_at")
    .eq("owner_id", owner).order("created_at", { ascending: false }).limit(100);
  if (error) return Response.json({ error: "Positions unavailable. Check the Supabase migration." }, { status: 503 });
  return Response.json({ rows: data }, { headers: { "Cache-Control": "private, no-store" } });
}
