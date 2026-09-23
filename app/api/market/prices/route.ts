import { NextResponse } from "next/server";
import { fetchMarketPrices } from "@/lib/server/market";

export async function GET() {
  const response = await fetchMarketPrices();

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
    },
  });
}
