import { NextResponse } from "next/server";
import { normalizeCollectionLeaderboard } from "@/lib/discovery";
import { normalizeStats } from "@/lib/opensea/normalize";
import { request } from "@/lib/opensea/client";
import {
  fetchCollectionsBySales,
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

export async function GET() {
  const [topResult, trendingResult] = await Promise.allSettled([
    fetchTopCollections(20),
    fetchTrendingCollections(20),
  ]);
  const warnings: string[] = [];
  let trendingMethod: CollectionDiscoveryResponse["trendingMethod"] = "opensea_trending";
  let trendingPayload = trendingResult.status === "fulfilled" ? trendingResult.value : null;

  if (topResult.status === "rejected") warnings.push(readFailure(topResult.reason, "Top collections"));
  if (trendingResult.status === "rejected") {
    try {
      trendingPayload = await fetchCollectionsBySales(20);
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

  // Reuse metrics already present in the leaderboard. Limit additional stats
  // calls and batch them in pairs to avoid a burst against the OpenSea key.
  const topBySlug = new Map(payload.top.map((item) => [item.slug, item]));
  payload.trending = payload.trending.map((item) => {
    const top = topBySlug.get(item.slug);
    return top ? { ...item, floor: item.floor ?? top.floor, volume24h: item.volume24h ?? top.volume24h, sales24h: item.sales24h ?? top.sales24h, owners: item.owners ?? top.owners } : item;
  });
  const needsStats = [...payload.trending.slice(0, 4), ...payload.top.slice(0, 2)]
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
