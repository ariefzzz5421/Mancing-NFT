import { request, MarketError } from "@/lib/opensea/client";

const PAGE_LIMIT = 200;
const MAX_PAGES = 100;
const HOLDER_PAGE_LIMIT = 100;
const MAX_HOLDER_PAGES = 20;

export class OpenSeaApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "OpenSeaApiError";
    this.status = status;
  }
}

async function fetchOpenSea<T>(path: string): Promise<T> {
  try {
    return await request<T>(
      path,
      path.includes("/stats")
        ? 45
        : /^\/collections\/[^/?]+$/.test(path)
          ? 900
          : 30,
    );
  } catch (e) {
    if (e instanceof MarketError)
      throw new OpenSeaApiError(e.message, e.status);
    throw e;
  }
}

function readArrayPayload(payload: unknown, key: string) {
  if (payload && typeof payload === "object" && key in payload) {
    const value = (payload as Record<string, unknown>)[key];
    return Array.isArray(value) ? value : [];
  }

  return [];
}

function readNextCursor(payload: unknown) {
  if (payload && typeof payload === "object" && "next" in payload) {
    const value = (payload as Record<string, unknown>).next;
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  return null;
}

export function fetchCollection(slug: string) {
  return fetchOpenSea<unknown>(`/collections/${encodeURIComponent(slug)}`);
}

export function fetchContract(chain: string, address: string) {
  return fetchOpenSea<unknown>(
    `/chain/${encodeURIComponent(chain)}/contract/${encodeURIComponent(address)}`,
  );
}

export function fetchCollectionStats(slug: string) {
  return fetchOpenSea<unknown>(
    `/collections/${encodeURIComponent(slug)}/stats`,
  );
}

export function fetchTopCollections(limit = 20) {
  const params = new URLSearchParams({
    limit: String(limit),
    sort_by: "one_day_volume",
  });
  return fetchOpenSea<unknown>(`/collections/top?${params.toString()}`);
}

export function fetchCollectionsBySales(limit = 20) {
  const params = new URLSearchParams({
    limit: String(limit),
    sort_by: "one_day_sales",
  });
  return fetchOpenSea<unknown>(`/collections/top?${params.toString()}`);
}

export function fetchTrendingCollections(limit = 20) {
  const params = new URLSearchParams({
    limit: String(limit),
    timeframe: "one_day",
  });
  return fetchOpenSea<unknown>(`/collections/trending?${params.toString()}`);
}

export function searchCollections(query: string, limit = 8) {
  const params = new URLSearchParams({
    asset_types: "collection",
    limit: String(Math.min(Math.max(limit, 1), 20)),
    query,
  });
  params.append("chains", "ethereum");
  params.append("chains", "ape_chain");

  return fetchOpenSea<unknown>(`/search?${params.toString()}`);
}

export async function fetchCollectionHolders(slug: string) {
  const holders: unknown[] = [];
  let cursor: string | null = null;
  let page = 0;

  do {
    const params = new URLSearchParams({
      limit: String(HOLDER_PAGE_LIMIT),
      sort_direction: "desc",
    });

    if (cursor) {
      params.set("cursor", cursor);
    }

    const payload = await fetchOpenSea<unknown>(
      `/collections/${encodeURIComponent(slug)}/holders?${params.toString()}`,
    );

    holders.push(...readArrayPayload(payload, "holders"));
    cursor = readNextCursor(payload);
    page += 1;
  } while (cursor && page < MAX_HOLDER_PAGES);

  return {
    complete: !cursor,
    holders,
  };
}

export async function fetchAllListings(slug: string) {
  const listings: unknown[] = [];
  let cursor: string | null = null;
  let page = 0;

  do {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });

    if (cursor) {
      params.set("next", cursor);
    }

    const payload = await fetchOpenSea<unknown>(
      `/listings/collection/${encodeURIComponent(slug)}/all?${params.toString()}`,
    );

    listings.push(...readArrayPayload(payload, "listings"));
    cursor = readNextCursor(payload);
    page += 1;
  } while (cursor && page < MAX_PAGES);

  return listings;
}

export async function fetchAllCollectionOffers(slug: string) {
  const offers: unknown[] = [];
  let cursor: string | null = null;
  let page = 0;

  do {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });

    if (cursor) {
      params.set("next", cursor);
    }

    const payload = await fetchOpenSea<unknown>(
      `/offers/collection/${encodeURIComponent(slug)}/all?${params.toString()}`,
    );

    offers.push(...readArrayPayload(payload, "offers"));
    cursor = readNextCursor(payload);
    page += 1;
  } while (cursor && page < MAX_PAGES);

  return offers;
}

export async function fetchCollectionEvents(
  slug: string,
  params: URLSearchParams,
) {
  return fetchOpenSea<unknown>(
    `/events/collection/${encodeURIComponent(slug)}?${params.toString()}`,
  );
}

export function getEthUsdFallback() {
  const value = Number(process.env.ETH_USD_FALLBACK ?? "1730");
  return Number.isFinite(value) && value > 0 ? value : 1730;
}

export function getApeUsdFallback() {
  const value = Number(process.env.APE_USD_FALLBACK ?? "0");
  return Number.isFinite(value) && value > 0 ? value : 0;
}
