import { apiError, MarketError, request } from "@/lib/opensea/client";
import { arr, normalizeCollection, record } from "@/lib/opensea/normalize";

export async function GET(incoming: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    if (!/^[a-z0-9][a-z0-9_.-]{0,159}$/i.test(slug)) throw new MarketError("Invalid collection slug.", 400);
    const collection = normalizeCollection(await request(`/collections/${encodeURIComponent(slug)}`, 300), slug);
    const chain = new URL(incoming.url).searchParams.get("chain");
    if (chain && chain !== collection.chain) throw new MarketError("Collection network changed. Search again.", 409);
    const raw = record(await request(`/events/collection/${encodeURIComponent(slug)}?event_type=sale&limit=100`, 45));
    const sales = arr(raw.asset_events).flatMap((entry, index) => {
      const event = record(entry);
      const payment = record(event.payment);
      const asset = record(event.asset);
      const nft = record(event.nft);
      const symbol = String(payment.symbol ?? "").toUpperCase();
      const decimals = Number(payment.decimals);
      const units = String(payment.quantity ?? "");
      const timestamp = Number(event.event_timestamp);
      if (event.chain !== collection.chain || Number(event.quantity) !== 1 || !/^[A-Z0-9]{2,12}$/.test(symbol) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18 || !/^\d+$/.test(units) || BigInt(units) <= 0n || !Number.isSafeInteger(timestamp) || timestamp <= 0) return [];
      const tokenId = nft.identifier ?? asset.identifier;
      const eventId = record(event.transaction).transaction_hash ?? event.order_hash ?? `${timestamp}:${units}`;
      return [{ id: `${String(eventId)}:${String(tokenId ?? index)}`, timestamp, priceUnits: units, decimals, symbol, tokenId: typeof tokenId === "string" ? tokenId : null }];
    });
    return Response.json({ sales, sampled: arr(raw.asset_events).length, hasMore: Boolean(raw.next), updatedAt: new Date().toISOString(), chain: collection.chain }, { headers: { "Cache-Control": "public, s-maxage=45, stale-while-revalidate=30" } });
  } catch (cause) { return apiError(cause); }
}
