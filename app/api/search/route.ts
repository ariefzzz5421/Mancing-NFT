import { NextRequest, NextResponse } from "next/server";
import { normalizeCollectionSearch } from "@/lib/discovery";
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
    const [ethereum, apeChain] = await Promise.allSettled([
      searchCollections(query, 8, "ethereum"),
      searchCollections(query, 4, "ape_chain"),
    ]);
    if (ethereum.status === "rejected" && apeChain.status === "rejected") throw ethereum.reason;
    const ethResults = ethereum.status === "fulfilled" ? normalizeCollectionSearch(ethereum.value, 8).map((item) => ({ ...item, chain: "ethereum", analyzable: true, nativeSymbol: "ETH" })) : [];
    const apeResults = apeChain.status === "fulfilled" ? normalizeCollectionSearch(apeChain.value, 4).map((item) => ({ ...item, chain: "ape_chain", analyzable: true, nativeSymbol: "APE" })) : [];
    const payload: CollectionSearchResponse = {
      results: [...ethResults.slice(0, 6), ...apeResults.slice(0, 2), ...ethResults.slice(6)].filter((item, index, all) => all.findIndex((other) => other.slug === item.slug) === index).slice(0, 8),
      source: "opensea",
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (cause) {
    if (cause instanceof OpenSeaApiError) {
      return jsonError(cause.message, cause.status);
    }

    return jsonError("Collection search is unavailable right now.", 500);
  }
}
