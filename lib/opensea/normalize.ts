import { WETH } from "@/lib/web3/constants";
import type { NormalizedOrder, Side, Collection, Stats } from "@/types/market";
export function record(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
}
export function arr(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}
const num = (x: unknown) =>
  typeof x === "number" && Number.isFinite(x) ? x : null;
export function normalizeOrder(
  raw: unknown,
  side: Side,
  now = Math.floor(Date.now() / 1000),
  collectionOnly = true,
): NormalizedOrder | null {
  const r = record(raw),
    p = record(record(r.protocol_data).parameters),
    current = record(side === "ask" ? record(r.price).current : r.price);
  const items = arr(side === "ask" ? p.offer : p.consideration).map(record),
    nft = items.find((i) => Number(i.itemType) >= 2);
  const criteria = record(r.criteria),
    traits = arr(criteria.traits),
    numeric = arr(criteria.numeric_traits);
  const expiration = Number(p.endTime),
    start = Number(p.startTime),
    quantity = Number(r.remaining_quantity);
  if (
    r.chain !== "ethereum" ||
    r.status !== "ACTIVE" ||
    !Number.isFinite(expiration) ||
    expiration <= now ||
    !Number.isFinite(start) ||
    start > now ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    typeof r.order_hash !== "string" ||
    !nft
  )
    return null;
  if (
    !["ETH", "WETH"].includes(String(current.currency)) ||
    current.decimals !== 18 ||
    typeof current.value !== "string" ||
    !/^\d+$/.test(current.value)
  )
    return null;
  // Exclude dynamic-price, private, bundle and unsupported orders from comparable liquidity.
  if (
    [...arr(p.offer), ...arr(p.consideration)].some(
      (i) => record(i).startAmount !== record(i).endAmount,
    )
  )
    return null;
  if (items.filter((i) => Number(i.itemType) >= 2).length !== 1) return null;
  if (
    side === "ask" &&
    arr(p.consideration).some((i) => Number(record(i).itemType) >= 2)
  )
    return null;
  const scope =
    Number(nft.itemType) <= 3
      ? "token"
      : traits.length || numeric.length
        ? "trait"
        : "collection";
  if (side === "bid" && collectionOnly && scope !== "collection") return null;
  if (
    side === "bid" &&
    collectionOnly &&
    String(nft.identifierOrCriteria) !== "0"
  )
    return null;
  // Only single-token ERC-721 asks are comparable; currency amounts in a
  // collection offer are TOTAL consideration, divided by its original NFT quantity.
  if (
    side === "ask" &&
    (Number(nft.itemType) !== 2 ||
      String(nft.startAmount) !== "1" ||
      quantity !== 1)
  )
    return null;
  let priceWei = BigInt(current.value);
  if (side === "bid") {
    const currencies = arr(p.offer).map(record);
    if (
      currencies.length !== 1 ||
      String(currencies[0].token).toLowerCase() !== WETH.toLowerCase() ||
      Number(currencies[0].itemType) !== 1 ||
      typeof currencies[0].startAmount !== "string" ||
      !/^\d+$/.test(currencies[0].startAmount) ||
      !/^\d+$/.test(String(nft.startAmount))
    )
      return null;
    const original = BigInt(String(nft.startAmount));
    if (original <= 0n || original < BigInt(quantity)) return null;
    priceWei = BigInt(currencies[0].startAmount) / original;
  }
  if (priceWei <= 0n) return null;
  return {
    orderHash: r.order_hash,
    side,
    priceWei: priceWei.toString(),
    quantity,
    maker: String(p.offerer ?? ""),
    expiration,
    created: Number(r.order_created_at ?? start),
    tokenId: scope === "token" ? String(nft.identifierOrCriteria) : undefined,
    tokenAddress:
      typeof nft.token === "string" ? nft.token.toLowerCase() : undefined,
    scope,
    protocol: String(r.protocol_address ?? ""),
    collection: String(record(criteria.collection).slug ?? ""),
  };
}
export function normalizeCollection(raw: unknown, slug: string): Collection {
  const r = record(raw),
    c = record(arr(r.contracts)[0]);
  return {
    slug,
    name: String(r.name ?? slug),
    image: typeof r.image_url === "string" ? r.image_url : null,
    verified: r.safelist_status === "verified" || r.is_verified === true,
    contract: typeof c.address === "string" ? c.address : null,
    chain: String(c.chain ?? "unknown"),
    supply: num(r.total_supply),
    fees: arr(r.fees).map((f) => {
      const x = record(f);
      return {
        recipient: String(x.recipient ?? ""),
        bps: Math.round(Number(x.fee ?? 0) * 100),
        required: x.required === true,
      };
    }),
  };
}
export function normalizeStats(raw: unknown): Stats {
  const r = record(raw),
    t = record(r.total),
    day =
      arr(r.intervals)
        .map(record)
        .find((x) => x.interval === "one_day") ?? {};
  return {
    floor: num(t.floor_price),
    volume: num(day.volume),
    sales: num(day.sales),
    owners: num(t.num_owners),
    listed: num(t.num_listings),
    lastSale: null,
  };
}
