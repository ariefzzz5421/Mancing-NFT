import type { NativeCurrencySymbol, SupportedChain } from "@/lib/chains";

export type SupportedCurrency = "ETH" | "WETH" | "APE" | "WAPE";

export type NormalizedListing = {
  tokenId: string;
  orderHash: string;
  priceEth: number;
  currency: SupportedCurrency;
  marketplace: "opensea";
  seller: string | null;
};

export type SweepLadderRow = {
  targetFloor: number;
  itemsToSweep: number;
  costEth: number;
  costUsd: number;
  avgPriceEth: number;
};

export type OpenSeaRefreshPolicy = {
  cacheSeconds: number;
  defaultRefreshSeconds: number;
  minRefreshSeconds: number;
  recommendedRefreshSeconds: number[];
  source: string;
  note: string;
};

export type ListingDistributionBucket = {
  bucket: string;
  count: number;
  totalEth: number;
};

export type CollectionHolder = {
  address: string;
  quantity: number;
  supplyShare: number | null;
};

export type HolderDistributionBucket = {
  bucket: string;
  holders: number;
  nfts: number;
};

export type HolderAnalysisData = {
  complete: boolean;
  distribution: HolderDistributionBucket[];
  fetchedHolders: number;
  topHolders: CollectionHolder[];
  totalHolders: number | null;
};

export type CollectionSummaryData = {
  creator: {
    address: string | null;
    contractAddress: string | null;
    source: string | null;
  };
  name: string;
  imageUrl: string | null;
  supply: number | null;
  floor: number | null;
  topOffer: number | null;
  listedCount: number;
  listedPercentage: number | null;
  owners: number | null;
  volume24h: number | null;
  totalVolume: number | null;
};

export type RiskSummary = {
  bidFloorRatio: number | null;
  bidSupportLabel: string;
  pumpabilityScore: number | null;
  pumpabilityLabel: string;
  warnings: string[];
};

export type TrackedWallet = {
  address: string;
  label: string;
  notes?: string;
};

export type WatchlistItem = {
  chain: SupportedChain;
  contractAddress?: string | null;
  slug: string;
  name?: string;
  imageUrl?: string | null;
  addedAt: string;
  notes?: string;
  targetFloors: number[];
  devWallets: TrackedWallet[];
  groupId?: string | null;
};

export type WatchlistGroup = {
  id: string;
  name: string;
  createdAt: string;
};

export type WalletTransaction = {
  hash: string;
  from: string;
  to: string;
  valueEth: number;
  timestamp: string;
  direction: "in" | "out" | "self";
};

export type WalletApiResponse = {
  address: string;
  chain: SupportedChain;
  currencySymbol: NativeCurrencySymbol;
  balanceEth: number;
  balanceUsd: number;
  txCount: number;
  lastTxAt: string | null;
  netEthFlow: number;
  recentTransactions: WalletTransaction[];
};

export type MarketSymbol = "BTC" | "ETH" | "APE" | "HYPE" | "BNB" | "SOL";

export type MarketPriceSource = "coingecko" | "yahoo" | "fallback";

export type MarketAssetPrice = {
  symbol: MarketSymbol;
  name: string;
  priceUsd: number;
  change24h: number | null;
  lastUpdated: string | null;
  source: MarketPriceSource;
};

export type MarketPricesResponse = {
  assets: MarketAssetPrice[];
  source: MarketPriceSource | "mixed";
  lastUpdated: string;
};

export type MarketCollection = {
  analyzable: boolean;
  chain: string;
  floor: number | null;
  floorSymbol?: string | null;
  floorChange24h: number | null;
  imageUrl: string | null;
  name: string;
  nativeSymbol: string;
  owners: number | null;
  rank: number;
  sales24h: number | null;
  supply: number | null;
  slug: string;
  totalVolume: number | null;
  verified: boolean;
  volume24h: number | null;
  volumeSymbol?: string | null;
};

export type CollectionDiscoveryResponse = {
  lastUpdated: string;
  refreshSeconds: number;
  source: "opensea";
  top: MarketCollection[];
  trending: MarketCollection[];
  trendingMethod: "opensea_trending" | "one_day_sales";
  warnings: string[];
};

export type CollectionSearchResponse = {
  results: MarketCollection[];
  source: "opensea";
};

export type SweepApiResponse = {
  chain: SupportedChain;
  slug: string;
  ethUsd: number;
  nativeCurrency: {
    symbol: NativeCurrencySymbol;
    wrappedSymbol: "WETH" | "WAPE";
  };
  nativeUsd: number;
  refreshPolicy: OpenSeaRefreshPolicy;
  collection: CollectionSummaryData;
  sweepLadder: SweepLadderRow[];
  holderAnalysis: HolderAnalysisData;
  listingDistribution: ListingDistributionBucket[];
  risk: RiskSummary;
  sanityWarnings: string[];
  listings: NormalizedListing[];
  lastUpdated: string;
};

export type ApiErrorResponse = {
  error: string;
  details?: string;
};

export type ActivityEventType =
  | "sale"
  | "transfer"
  | "mint"
  | "listing"
  | "offer"
  | "trait_offer"
  | "collection_offer"
  | "unknown";

export type NormalizedActivityEvent = {
  id: string;
  eventType: ActivityEventType;
  timestamp: string;
  tokenId?: string;
  tokenName?: string;
  imageUrl?: string;
  priceEth?: number;
  paymentSymbol?: string;
  from?: string;
  to?: string;
  buyer?: string;
  seller?: string;
  maker?: string;
  txHash?: string;
  orderHash?: string;
  openseaUrl?: string;
  etherscanUrl?: string;
};

export type ActivityApiResponse = {
  chain: SupportedChain;
  slug: string;
  events: NormalizedActivityEvent[];
  next: string | null;
  warnings: string[];
};

export type CollectionResolution = {
  chain: SupportedChain;
  actualChain?: string;
  collectionName: string | null;
  contractAddress: string | null;
  detectedFrom: "contract" | "slug";
  slug: string;
};
