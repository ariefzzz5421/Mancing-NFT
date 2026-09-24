import { NextRequest, NextResponse } from "next/server";
import { request } from "@/lib/opensea/client";
import { normalizeStats } from "@/lib/opensea/normalize";

export const dynamic = "force-dynamic";

export async function GET(nextRequest: NextRequest) {
  const slugs = [...new Set((nextRequest.nextUrl.searchParams.get("slugs") ?? "").split(","))]
    .filter((slug) => /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(slug))
    .slice(0, 10);
  if (!slugs.length) return NextResponse.json({ error: "Provide collection slugs." }, { status: 400 });

  const stats: Record<string, ReturnType<typeof normalizeStats> & { floorSymbol: string | null; volumeSymbol: string | null; totalVolume: number | null }> = {};
  const unavailable: string[] = [];
  // Small batches avoid flooding the shared OpenSea key. The client only asks
  // for the ten visible rows on each side, and request() caches each slug.
  for (let index = 0; index < slugs.length; index += 2) {
    const pair = slugs.slice(index, index + 2);
    const results = await Promise.allSettled(pair.map((slug) => request(`/collections/${encodeURIComponent(slug)}/stats`, 300)));
    results.forEach((result, position) => {
      if (result.status === "fulfilled") {
        const raw = result.value as { total?: { floor_price_symbol?: string; volume?: number | string }; intervals?: Array<{ interval?: string; volume_symbol?: string }> };
        const totalVolume = Number(raw.total?.volume);
        stats[pair[position]] = {
          ...normalizeStats(result.value),
          floorSymbol: raw.total?.floor_price_symbol ?? null,
          volumeSymbol: raw.intervals?.find((entry) => entry.interval === "one_day")?.volume_symbol ?? null,
          totalVolume: Number.isFinite(totalVolume) ? totalVolume : null,
        };
      }
      else unavailable.push(pair[position]);
    });
    if (results.every((result) => result.status === "rejected")) {
      unavailable.push(...slugs.slice(index + pair.length));
      break;
    }
  }

  return NextResponse.json({ stats, unavailable }, {
    headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=180" },
  });
}
