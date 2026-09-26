import { arr, record } from "./normalize";

export type MarketBookOrder = {
  id: string;
  side: "ask" | "bid";
  chain: string;
  currency: string;
  decimals: number;
  priceUnits: string;
  quantity: number;
  scope: "collection" | "token";
  tokenId: string | null;
  tokenContract: string | null;
};

export type MarketBookLevel = {
  priceUnits: string;
  currency: string;
  quantity: number;
  cumulativeQuantity: number;
  valueUnits: string;
  cumulativeValueUnits: string;
};

export type MarketBookGroup = {
  key: string;
  currency: string;
  decimals: number;
  asks: MarketBookLevel[];
  bids: MarketBookLevel[];
  bidScope: "collection" | "token" | "none";
  askCount: number;
  bidCount: number;
};

function family(currency: string) {
  const upper = currency.toUpperCase();
  return ["ETH", "APE", "SOL", "POL"].find((native) => upper === native || upper === `W${native}`) ?? upper;
}

export function normalizeMarketBookOrder(raw: unknown, side: "ask" | "bid", chain: string, now = Math.floor(Date.now() / 1000)): MarketBookOrder | null {
  const order = record(raw);
  if (order.chain !== chain || order.status !== "ACTIVE") return null;
  const quantity = Number(order.remaining_quantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) return null;
  const parameters = record(record(order.protocol_data).parameters);
  if (parameters.endTime && Number(parameters.endTime) <= now) return null;
  if (parameters.startTime && Number(parameters.startTime) > now) return null;
  const price = record(side === "ask" ? record(order.price).current : order.price);
  const currency = String(price.currency ?? "").toUpperCase();
  const decimals = Number(price.decimals);
  const value = String(price.value ?? "");
  if (!/^[A-Z0-9]{2,12}$/.test(currency) || !Number.isSafeInteger(decimals) || decimals < 0 || decimals > 18 || !/^\d+$/.test(value)) return null;
  const nft = arr(side === "ask" ? parameters.offer : parameters.consideration).map(record).find((item) => Number(item.itemType) >= 2);
  const asset = record(order.asset);
  if (!nft && !asset.identifier) return null;
  if (side === "ask" && (quantity !== 1 || (nft && (Number(nft.itemType) !== 2 || String(nft.startAmount) !== "1")))) return null;
  if (nft && [...arr(parameters.offer), ...arr(parameters.consideration)].some((item) => record(item).startAmount !== record(item).endAmount)) return null;
  const criteria = record(order.criteria);
  if (arr(criteria.traits).length || arr(criteria.numeric_traits).length) return null;
  const tokenId = nft && Number(nft.itemType) <= 3 ? String(nft.identifierOrCriteria) : typeof asset.identifier === "string" ? asset.identifier : null;
  const tokenContract = typeof nft?.token === "string" ? nft.token.toLowerCase() : typeof asset.contract === "string" ? asset.contract.toLowerCase() : null;
  const scope = side === "bid" && nft && Number(nft.itemType) >= 4 && String(nft.identifierOrCriteria) === "0" ? "collection" : "token";
  const originalText = side === "bid" && nft ? String(nft.startAmount ?? 1) : "1";
  if (!/^\d+$/.test(originalText)) return null;
  const originalQuantity = BigInt(originalText);
  if (originalQuantity < BigInt(quantity) || originalQuantity <= 0n) return null;
  const priceUnits = BigInt(value) / originalQuantity;
  if (priceUnits <= 0n) return null;
  const id = String(order.order_hash ?? record(order.svm_order).id ?? "");
  if (!id) return null;
  return { id, side, chain, currency, decimals, priceUnits: priceUnits.toString(), quantity, scope, tokenId, tokenContract };
}

function levels(orders: MarketBookOrder[], side: "ask" | "bid"): MarketBookLevel[] {
  const grouped = new Map<string, { price: bigint; quantity: number; currency: string }>();
  for (const order of orders.filter((item) => item.side === side)) {
    const previous = grouped.get(order.priceUnits);
    grouped.set(order.priceUnits, { price: BigInt(order.priceUnits), quantity: (previous?.quantity ?? 0) + order.quantity, currency: order.currency });
  }
  const sorted = [...grouped.values()].sort((a, b) => a.price === b.price ? 0 : side === "ask" ? a.price < b.price ? -1 : 1 : a.price > b.price ? -1 : 1);
  let cumulativeQuantity = 0;
  let cumulativeValue = 0n;
  return sorted.slice(0, 40).map(({ price, quantity, currency }) => {
    cumulativeQuantity += quantity;
    const value = price * BigInt(quantity);
    cumulativeValue += value;
    return { priceUnits: price.toString(), currency, quantity, cumulativeQuantity, valueUnits: value.toString(), cumulativeValueUnits: cumulativeValue.toString() };
  });
}

export function buildMarketBookGroups(orders: MarketBookOrder[]): MarketBookGroup[] {
  const families = new Map<string, MarketBookOrder[]>();
  for (const order of orders) {
    const key = `${family(order.currency)}:${order.decimals}`;
    families.set(key, [...(families.get(key) ?? []), order]);
  }
  return [...families].map(([key, members]) => {
    const asks = members.filter((item) => item.side === "ask");
    const collectionBids = members.filter((item) => item.side === "bid" && item.scope === "collection");
    const bids = collectionBids.length ? collectionBids : members.filter((item) => item.side === "bid");
    return { key, currency: family(members[0].currency), decimals: members[0].decimals, asks: levels(asks, "ask"), bids: levels(bids, "bid"), bidScope: collectionBids.length ? "collection" as const : bids.length ? "token" as const : "none" as const, askCount: asks.length, bidCount: bids.length };
  }).sort((a, b) => Number(Boolean(b.asks.length && b.bids.length)) - Number(Boolean(a.asks.length && a.bids.length)) || b.askCount + b.bidCount - a.askCount - a.bidCount);
}
