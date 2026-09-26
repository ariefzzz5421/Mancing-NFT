import { authenticatedOwner } from "@/lib/server/watchlist-store";
import { listTrades } from "@/lib/server/trade-store";

export async function GET(request: Request) {
  const owner = await authenticatedOwner(request);
  if (!owner) return Response.json({ error: "Sign in with your connected wallet to load your trade history." }, { status: 401 });
  const { rows, error } = await listTrades(owner);
  if (error) return Response.json({ error: `Trade history unavailable: ${error}` }, { status: 503 });
  return Response.json({ rows }, { headers: { "Cache-Control": "private, no-store" } });
}
