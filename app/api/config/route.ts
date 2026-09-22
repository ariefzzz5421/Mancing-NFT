import { database, databaseConfigured } from "@/lib/server/watchlist-store";

export async function GET() {
  let databaseReachable = false;
  if (databaseConfigured()) {
    try {
      const result = await database().from("watchlist_items").select("id").limit(1);
      databaseReachable = !result.error;
    } catch { databaseReachable = false; }
  }
  return Response.json({
    supabase: { configured: databaseConfigured(), operational: databaseReachable },
    privy: { configured: Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET) },
    rpc: { dedicated: Boolean(process.env.ETHEREUM_RPC_URL) },
    opensea: { configured: Boolean(process.env.OPENSEA_API_KEY) },
  }, { headers: { "Cache-Control": "no-store" } });
}
