import { NextResponse } from "next/server";
import { normalizeCollectionLeaderboard } from "@/lib/discovery";
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

  const status = payload.top.length > 0 || payload.trending.length > 0 ? 200 : 502;

  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
