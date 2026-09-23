export type Side = "bid" | "ask";
export type NormalizedOrder = {
  orderHash: string;
  side: Side;
  priceWei: string;
  quantity: number;
  maker: string;
  expiration: number;
  created: number;
  tokenId?: string;
  tokenAddress?: string;
  scope: "collection" | "trait" | "token";
  protocol: string;
  collection?: string;
};
export type Level = {
  priceWei: string;
  quantity: number;
  cumulativeQuantity: number;
  valueWei: string;
  cumulativeValueWei: string;
  orders: NormalizedOrder[];
};
export type Collection = {
  slug: string;
  name: string;
  image: string | null;
  verified: boolean;
  contract: string | null;
  chain: string;
  supply: number | null;
  fees: { recipient: string; bps: number; required: boolean }[];
};
export type Stats = {
  floor: number | null;
  volume: number | null;
  sales: number | null;
  owners: number | null;
  listed: number | null;
  lastSale: number | null;
};
export type Book = {
  orders: NormalizedOrder[];
  asks: Level[];
  bids: Level[];
  updatedAt: string;
  complete: boolean;
  excluded: number;
  errors: string[];
  pages: number;
  bidScope: string;
};
export type Health = {
  state:
    | "Operational"
    | "Authentication Failed"
    | "Rate Limited"
    | "Offline"
    | "Not checked";
  lastSuccess: string | null;
  lastStatus: number | null;
  updatedAt: string | null;
  rateLimit: {
    limit: number;
    remaining: number;
    resetAt: string | null;
    observedAt: string;
  } | null;
};
