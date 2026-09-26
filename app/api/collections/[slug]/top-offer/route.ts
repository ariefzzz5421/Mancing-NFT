import { request, apiError, MarketError } from "@/lib/opensea/client";
import { arr, normalizeOrder, record } from "@/lib/opensea/normalize";
import { topOfferPrice } from "@/lib/quant/top-offer";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    if (!/^[a-z0-9][a-z0-9_.-]{0,159}$/i.test(slug)) throw new MarketError("Invalid collection slug.", 400);
    const [offers, listings] = await Promise.all([
      request(`/offers/collection/${encodeURIComponent(slug)}?limit=50`, 2),
      request(`/listings/collection/${encodeURIComponent(slug)}/all?limit=50`, 2),
    ]);
    const bids = arr(record(offers).offers).map((order) => normalizeOrder(order, "bid")).filter((order) => order !== null);
    const asks = arr(record(listings).listings).map((order) => normalizeOrder(order, "ask")).filter((order) => order !== null);
    const bestBidWei = bids.reduce<bigint | null>((best, order) => !best || BigInt(order.priceWei) > best ? BigInt(order.priceWei) : best, null);
    const bestAskWei = asks.reduce<bigint | null>((best, order) => !best || BigInt(order.priceWei) < best ? BigInt(order.priceWei) : best, null);
    const suggestion = bestBidWei ? topOfferPrice(bestBidWei, bestAskWei) : null;
    return Response.json({ bestBidWei: bestBidWei?.toString() ?? null, bestAskWei: bestAskWei?.toString() ?? null, priceWei: suggestion?.priceWei.toString() ?? null, tickWei: suggestion?.tickWei.toString() ?? null, priceEth: suggestion?.priceEth ?? null, observedAt: new Date().toISOString(), reason: !bestBidWei ? "No active collection-wide bid found." : !suggestion ? "The next bid tick would meet or exceed the lowest fetched ask." : null, coverage: "First 50 recent collection offers and listings; a higher bid may exist outside this snapshot." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
