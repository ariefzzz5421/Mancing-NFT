import { database, databaseConfigured } from "@/lib/server/watchlist-store";
import { walletAuthConfigured } from "@/lib/server/wallet-session";

export async function GET() {
  let databaseReachable = false;
  if (databaseConfigured()) {
    try {
      const results = await Promise.all([
        database().from("watchlist_items").select("id,group_id").limit(1),
        database().from("watchlist_groups").select("id").limit(1),
      ]);
      databaseReachable = results.every((result) => !result.error);
    } catch { databaseReachable = false; }
  }
  return Response.json({
    supabase: { configured: databaseConfigured(), operational: databaseReachable },
    privy: { configured: Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID) },
    walletAuth: { configured: walletAuthConfigured() },
    rpc: { dedicated: Boolean(process.env.ETHEREUM_RPC_URL) },
    opensea: { configured: Boolean(process.env.OPENSEA_API_KEY) },
  }, { headers: { "Cache-Control": "no-store" } });
}
