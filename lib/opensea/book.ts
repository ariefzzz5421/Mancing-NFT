import { request } from "./client";
import { arr, record, normalizeOrder } from "./normalize";
import { aggregate } from "@/lib/quant/book";
import type { Book, NormalizedOrder, Side } from "@/types/market";
async function side(slug: string, side: Side) {
  const kind = side === "ask" ? "listings" : "offers";
  const orders: NormalizedOrder[] = [];
  let cursor: string | undefined,
    pages = 0,
    excluded = 0;
  const seen = new Set<string>();
  do {
    const q = new URLSearchParams({ limit: "200" });
    if (cursor) q.set("next", cursor);
    // The /all offer feed mixes NFT-specific and collection offers. On busy
    // collections its first pages can contain no collection-wide bids at all.
    const endpoint = side === "bid"
      ? `/offers/collection/${encodeURIComponent(slug)}?${q}`
      : `/listings/collection/${encodeURIComponent(slug)}/all?${q}`;
    const raw = record(await request(endpoint, 20));
    for (const item of arr(raw[kind])) {
      const order = normalizeOrder(item, side);
      if (!order) {
        excluded++;
        continue;
      }
      if (!seen.has(order.orderHash)) {
        seen.add(order.orderHash);
        orders.push(order);
      }
    }
    cursor = typeof raw.next === "string" && raw.next ? raw.next : undefined;
    pages++;
  } while (cursor && pages < 3);
  // One ERC-721 can have several active listing hashes. It can be swept only once.
  if (side === "ask") {
    const assets = new Map<string, NormalizedOrder>();
    for (const order of orders) {
      const key = `${order.tokenAddress}:${order.tokenId}`;
      const previous = assets.get(key);
      if (!previous || BigInt(order.priceWei) < BigInt(previous.priceWei))
        assets.set(key, order);
    }
    excluded += orders.length - assets.size;
    return { orders: [...assets.values()], complete: !cursor, pages, excluded };
  }
  return { orders, complete: !cursor, pages, excluded };
}
export async function getBook(slug: string): Promise<Book> {
  const results = await Promise.allSettled([
    side(slug, "ask"),
    side(slug, "bid"),
  ]);
  const errors = results.flatMap((r, i) =>
    r.status === "rejected"
      ? [
          `${i === 0 ? "Listings" : "Offers"}: ${r.reason instanceof Error ? r.reason.message : "unavailable"}`,
        ]
      : [],
  );
  const ok = results.flatMap((r) =>
    r.status === "fulfilled" ? [r.value] : [],
  );
  const orders = ok.flatMap((r) => r.orders);
  return {
    orders,
    asks: aggregate(orders, "ask"),
    bids: aggregate(orders, "bid"),
    updatedAt: new Date().toISOString(),
    complete: !errors.length && ok.every((x) => x.complete),
    excluded: ok.reduce((s, x) => s + x.excluded, 0),
    pages: ok.reduce((s, x) => s + x.pages, 0),
    errors,
    bidScope:
      "Collection-wide ETH/WETH offers only; trait and token-specific bids excluded. Depth is advertised, not balance-verified; makers may share funding across orders.",
  };
}
