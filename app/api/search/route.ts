import { NextRequest, NextResponse } from "next/server";
import { normalizeCollectionSearch, normalizeCollectionLeaderboard } from "@/lib/discovery";
import { OpenSeaApiError, searchCollections } from "@/lib/opensea";
import type { CollectionSearchResponse } from "@/lib/types";

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { headers: { "Cache-Control": "no-store" }, status },
  );
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return jsonError("Enter at least two characters.", 400);
  }

  try {
    const matches = normalizeCollectionSearch(await searchCollections(query, 12), 12);
    const key = process.env.OPENSEA_API_KEY;
    let details = new Map<string, ReturnType<typeof normalizeCollectionLeaderboard>[number]>();
    if (key && matches.length) {
      details = new Map();
      for (let index = 0; index < matches.length; index += 4) {
        const group = matches.slice(index, index + 4);
        const response = await fetch("https://api.opensea.io/api/v2/collections/batch", {
          method: "POST",
          headers: { "x-api-key": key, "content-type": "application/json" },
          body: JSON.stringify({ slugs: group.map((item) => item.slug) }),
          signal: AbortSignal.timeout(8000),
        }).catch(() => null);
        if (!response?.ok) continue;
        const rows = normalizeCollectionLeaderboard(await response.json(), 4);
        rows.forEach((item) => details.set(item.slug, item));
      }
    }
    const results = matches.map((item) => {
      const detail = details.get(item.slug);
      return detail ? { ...item, chain: detail.chain, analyzable: detail.analyzable, nativeSymbol: detail.nativeSymbol, supply: detail.supply, verified: detail.verified || item.verified } : item;
    });
    const payload: CollectionSearchResponse = {
      results: results.filter((item, index, all) => all.findIndex((other) => other.slug === item.slug && other.chain === item.chain) === index),
      source: "opensea",
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": results.some((item) => item.chain === "unknown") ? "public, s-maxage=15" : "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (cause) {
    if (cause instanceof OpenSeaApiError) {
      return jsonError(cause.message, cause.status);
    }

    return jsonError("Collection search is unavailable right now.", 500);
  }
}
