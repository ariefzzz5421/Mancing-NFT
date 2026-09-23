import type {
  MarketAssetPrice,
  MarketPriceSource,
  MarketPricesResponse,
  MarketSymbol,
} from "@/lib/types";

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3/simple/price";
const YAHOO_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

const MARKET_ASSETS = [
  { coingeckoId: "bitcoin", name: "Bitcoin", symbol: "BTC", yahooTicker: "BTC-USD" },
  { coingeckoId: "ethereum", name: "Ethereum", symbol: "ETH", yahooTicker: "ETH-USD" },
  { coingeckoId: "hyperliquid", name: "Hyperliquid", symbol: "HYPE", yahooTicker: null },
  { coingeckoId: "solana", name: "Solana", symbol: "SOL", yahooTicker: "SOL-USD" },
  { coingeckoId: "binancecoin", name: "BNB", symbol: "BNB", yahooTicker: "BNB-USD" },
  { coingeckoId: "apecoin", name: "ApeCoin", symbol: "APE", yahooTicker: null },
] as const;

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fallbackAsset(symbol: MarketSymbol): MarketAssetPrice {
  const asset = MARKET_ASSETS.find((candidate) => candidate.symbol === symbol);

  return {
    change24h: null,
    lastUpdated: null,
    name: asset?.name ?? symbol,
    priceUsd: 0,
    source: "fallback",
    symbol,
  };
}

function responseSource(assets: MarketAssetPrice[]): MarketPricesResponse["source"] {
  const sources = new Set<MarketPriceSource>(assets.map((asset) => asset.source));

  if (sources.size === 1) {
    return assets[0]?.source ?? "fallback";
  }

  return "mixed";
}

function buildResponse(assets: MarketAssetPrice[]): MarketPricesResponse {
  return {
    assets,
    lastUpdated: new Date().toISOString(),
    source: responseSource(assets),
  };
}

async function fetchCoinGeckoPrices(): Promise<MarketPricesResponse> {
  const ids = MARKET_ASSETS.map((asset) => asset.coingeckoId).join(",");
  const params = new URLSearchParams({
    ids,
    include_24hr_change: "true",
    include_last_updated_at: "true",
    vs_currencies: "usd",
  });
  const response = await fetch(`${COINGECKO_BASE_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`CoinGecko price request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as Record<string, Record<string, unknown>>;
  const now = new Date().toISOString();
  const assets = MARKET_ASSETS.map((asset) => {
    const data = payload[asset.coingeckoId];
    const updatedAt = readNumber(data?.last_updated_at);
    const priceUsd = readNumber(data?.usd) ?? 0;

    return {
      change24h: readNumber(data?.usd_24h_change),
      lastUpdated: updatedAt ? new Date(updatedAt * 1000).toISOString() : now,
      name: asset.name,
      priceUsd,
      source: priceUsd > 0 ? "coingecko" : "fallback",
      symbol: asset.symbol,
    } satisfies MarketAssetPrice;
  });

  if (assets.every((asset) => asset.priceUsd <= 0)) {
    throw new Error("CoinGecko returned incomplete price data.");
  }

  return buildResponse(assets);
}

async function fetchYahooSymbol(symbol: MarketSymbol): Promise<MarketAssetPrice> {
  const asset = MARKET_ASSETS.find((candidate) => candidate.symbol === symbol);

  if (!asset) {
    throw new Error(`Unsupported market symbol ${symbol}.`);
  }
  if (!asset.yahooTicker) throw new Error(`Yahoo fallback unavailable for ${symbol}.`);

  const response = await fetch(
    `${YAHOO_BASE_URL}/${asset.yahooTicker}?interval=1m&range=1d`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    },
  );

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          chartPreviousClose?: number;
          regularMarketTime?: number;
        };
      }>;
    };
  };
  const meta = payload.chart?.result?.[0]?.meta;
  const price = readNumber(meta?.regularMarketPrice);

  if (!price || price <= 0) {
    throw new Error(`Yahoo Finance returned incomplete ${symbol} price data.`);
  }

  const previousClose = readNumber(meta?.chartPreviousClose);
  const change24h =
    previousClose && previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : null;
  const marketTime = readNumber(meta?.regularMarketTime);

  return {
    change24h,
    lastUpdated: marketTime ? new Date(marketTime * 1000).toISOString() : new Date().toISOString(),
    name: asset.name,
    priceUsd: price,
    source: "yahoo",
    symbol,
  };
}

async function fetchYahooPrices(): Promise<MarketPricesResponse> {
  const results = await Promise.allSettled(
    MARKET_ASSETS.map((asset) => fetchYahooSymbol(asset.symbol)),
  );
  const assets = results.map((result, index) => {
    const symbol = MARKET_ASSETS[index].symbol;
    return result.status === "fulfilled" ? result.value : fallbackAsset(symbol);
  });

  if (assets.every((asset) => asset.priceUsd <= 0)) {
    throw new Error("Yahoo Finance returned no usable price data.");
  }

  return buildResponse(assets);
}

export async function fetchMarketPrices(): Promise<MarketPricesResponse> {
  try {
    return await fetchCoinGeckoPrices();
  } catch {
    try {
      return await fetchYahooPrices();
    } catch {
      return buildResponse(MARKET_ASSETS.map((asset) => fallbackAsset(asset.symbol)));
    }
  }
}
