import { request, apiError, MarketError } from "@/lib/opensea/client";
import { arr, normalizeCollection, record } from "@/lib/opensea/normalize";
import { buildMarketBookGroups, normalizeMarketBookOrder } from "@/lib/opensea/read-only-book";
import type { MarketBookOrder } from "@/lib/opensea/read-only-book";

async function fetchSide(slug: string, chain: string, side: "ask" | "bid") {
  const kind = side === "ask" ? "listings" : "offers";
  const orders: MarketBookOrder[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("next", cursor);
    const payload = record(await request(`/${kind}/collection/${encodeURIComponent(slug)}/all?${query}`, 20));
    for (const raw of arr(payload[kind])) {
      const order = normalizeMarketBookOrder(raw, side, chain);
      if (order && !seen.has(order.id)) { seen.add(order.id); orders.push(order); }
    }
    cursor = typeof payload.next === "string" && payload.next ? payload.next : null;
    pages++;
  } while (cursor && pages < 2);
  if (side === "ask") {
    const byToken = new Map<string, MarketBookOrder>();
    for (const order of orders) {
      const key = order.tokenId ? `${order.tokenContract ?? slug}:${order.tokenId}` : order.id;
      const previous = byToken.get(key);
      if (!previous || BigInt(order.priceUnits) < BigInt(previous.priceUnits)) byToken.set(key, order);
    }
    return { orders: [...byToken.values()], complete: !cursor };
  }
  return { orders, complete: !cursor };
}

export async function GET(incoming: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    if (!/^[a-z0-9][a-z0-9_.-]{0,159}$/i.test(slug)) throw new MarketError("Invalid collection slug.", 400);
    const source = record(await request(`/collections/${encodeURIComponent(slug)}`, 300));
    const collection = normalizeCollection(source, slug);
    const requestedChain = new URL(incoming.url).searchParams.get("chain");
    if (requestedChain && requestedChain !== collection.chain) throw new MarketError("Collection network changed. Search again for the verified chain.", 409);
    if (collection.chain === "ethereum") throw new MarketError("Use the Ethereum execution order book for this collection.", 400);
    const results = await Promise.allSettled([fetchSide(slug, collection.chain, "ask"), fetchSide(slug, collection.chain, "bid")]);
    if (results.every((result) => result.status === "rejected")) throw results[0].status === "rejected" ? results[0].reason : new MarketError("OpenSea order book unavailable.");
    const orders = results.flatMap((result) => result.status === "fulfilled" ? result.value.orders : []);
    const errors = results.flatMap((result, index) => result.status === "rejected" ? [`${index === 0 ? "Listings" : "Offers"}: ${result.reason instanceof Error ? result.reason.message : "unavailable"}`] : []);
    return Response.json({ chain: collection.chain, groups: buildMarketBookGroups(orders), updatedAt: new Date().toISOString(), complete: results.every((result) => result.status === "fulfilled" && result.value.complete), errors }, {
      headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=20" },
    });
  } catch (cause) { return apiError(cause); }
}
