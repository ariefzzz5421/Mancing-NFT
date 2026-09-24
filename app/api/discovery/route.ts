import { NextRequest, NextResponse } from "next/server";
import { normalizeCollectionLeaderboard } from "@/lib/discovery";
import { normalizeStats } from "@/lib/opensea/normalize";
import { request } from "@/lib/opensea/client";
import {
  fetchCollectionsBySales,
  fetchCollection,
  fetchTopCollections,
  fetchTrendingCollections,
  OpenSeaApiError,
} from "@/lib/opensea";
import type { CollectionDiscoveryResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

function readFailure(reason: unknown, label: string) {
  if (reason instanceof OpenSeaApiError) return `${label}: ${reason.message}`;
  if (reason instanceof Error) return `${label}: ${reason.message}`;
  return `${label}: OpenSea request failed.`;
}

const sorts = new Set(["one_day_volume", "one_day_sales", "floor_price", "total_volume", "floor_cap_estimate"]);
export async function GET(nextRequest: NextRequest) {
  const chainValue = nextRequest.nextUrl.searchParams.get("chain") ?? "";
  const chain = /^[a-z][a-z_0-9]{1,31}$/.test(chainValue) ? chainValue : undefined;
  const sortValue = nextRequest.nextUrl.searchParams.get("sort") ?? "one_day_volume";
  const sort = sorts.has(sortValue) ? sortValue : "one_day_volume";
  const capMode = sort === "floor_cap_estimate" && Boolean(chain);
  const rankingsOnly = nextRequest.nextUrl.searchParams.get("rankings") === "1" && !capMode;
  const [topResult, trendingResult] = await Promise.allSettled([
    fetchTopCollections(20, sort === "floor_cap_estimate" ? "one_day_volume" : sort, chain),
    fetchTrendingCollections(20, chain),
  ]);
  const warnings: string[] = [];
  let trendingMethod: CollectionDiscoveryResponse["trendingMethod"] = "opensea_trending";
  let trendingPayload = trendingResult.status === "fulfilled" ? trendingResult.value : null;

  if (topResult.status === "rejected") warnings.push(readFailure(topResult.reason, "Top collections"));
  if (trendingResult.status === "rejected") {
    try {
      trendingPayload = await fetchCollectionsBySales(20, chain);
      trendingMethod = "one_day_sales";
      warnings.push("Trending uses OpenSea 24h sales ranking while its trending endpoint is unavailable.");
    } catch (fallbackReason) {
      warnings.push(readFailure(trendingResult.reason, "Trending collections"));
      warnings.push(readFailure(fallbackReason, "24h sales fallback"));
    }
  }

  const payload: CollectionDiscoveryResponse = {
    lastUpdated: new Date().toISOString(),
    refreshSeconds: 60,
    source: "opensea",
    top:
      topResult.status === "fulfilled"
        ? normalizeCollectionLeaderboard(topResult.value)
        : [],
    trending: trendingPayload ? normalizeCollectionLeaderboard(trendingPayload) : [],
    trendingMethod,
    warnings,
  };

  // The overview renders rankings immediately, then requests cached statistics
  // for visible collections. Keep the full response for other API consumers.
  if (rankingsOnly) {
    return NextResponse.json(payload, {
      status: payload.top.length || payload.trending.length ? 200 : 502,
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=180" },
    });
  }

  // Reuse metrics already present in the leaderboard. Limit additional stats
  // calls and batch them in pairs to avoid a burst against the OpenSea key.
  const topBySlug = new Map(payload.top.map((item) => [item.slug, item]));
  payload.trending = payload.trending.map((item) => {
    const top = topBySlug.get(item.slug);
    return top ? { ...item, floor: item.floor ?? top.floor, volume24h: item.volume24h ?? top.volume24h, sales24h: item.sales24h ?? top.sales24h, owners: item.owners ?? top.owners } : item;
  });
  const needsStats = [...payload.trending.slice(0, capMode ? 10 : 4), ...payload.top.slice(0, capMode ? 10 : 8)]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.slug === item.slug) === index)
    .filter((item) => item.floor === null || item.volume24h === null);
  const statsBySlug = new Map<string, ReturnType<typeof normalizeStats>>();
  let statsUnavailable = false;
  for (let index = 0; index < needsStats.length; index += 2) {
    const pair = needsStats.slice(index, index + 2);
    const results = await Promise.allSettled(pair.map((item) => request(`/collections/${encodeURIComponent(item.slug)}/stats`, 300)));
    results.forEach((result, pairIndex) => {
      if (result.status === "fulfilled") statsBySlug.set(pair[pairIndex].slug, normalizeStats(result.value));
      else statsUnavailable = true;
    });
    if (results.every((result) => result.status === "rejected")) break;
  }
  if (statsUnavailable) warnings.push("Some collection metrics are temporarily unavailable from OpenSea.");
  payload.top = payload.top.map((item) => {
    const stats = statsBySlug.get(item.slug);
    return stats ? { ...item, floor: item.floor ?? stats.floor, volume24h: item.volume24h ?? stats.volume, sales24h: item.sales24h ?? stats.sales, owners: item.owners ?? stats.owners } : item;
  });
  if (capMode) {
    const candidates = payload.top.slice(0, 10);
    const supplyBySlug = new Map<string, number>();
    for (let index = 0; index < candidates.length; index += 2) {
      const pair = candidates.slice(index, index + 2);
      const results = await Promise.allSettled(pair.map((item) => fetchCollection(item.slug)));
      results.forEach((result, pairIndex) => {
        if (result.status !== "fulfilled") return;
        const normalized = normalizeCollectionLeaderboard({ collections: [result.value] }, 1)[0];
        if (normalized?.supply && normalized.supply > 0) supplyBySlug.set(pair[pairIndex].slug, normalized.supply);
      });
    }
    payload.top = candidates.map((item) => ({ ...item, supply: supplyBySlug.get(item.slug) ?? item.supply }))
      .sort((a, b) => (b.floor !== null && b.supply ? b.floor * b.supply : -1) - (a.floor !== null && a.supply ? a.floor * a.supply : -1))
      .map((item, index) => ({ ...item, rank: index + 1 }));
    warnings.push("Floor-cap estimate ranks only ten 24h-volume candidates on the selected chain. It is not a global market-cap ranking.");
  }
  payload.trending = payload.trending.map((item) => {
    const stats = statsBySlug.get(item.slug);
    return stats ? { ...item, floor: item.floor ?? stats.floor, volume24h: item.volume24h ?? stats.volume, sales24h: item.sales24h ?? stats.sales, owners: item.owners ?? stats.owners } : item;
  });

  const status = payload.top.length > 0 || payload.trending.length > 0 ? 200 : 502;

  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=180",
    },
  });
}
