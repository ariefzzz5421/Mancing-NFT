import { NextRequest } from "next/server";
import { request, apiError } from "@/lib/opensea/client";
import { normalizeActivityEvents } from "@/lib/activity";
import { parseSupportedChain } from "@/lib/chains";

export async function GET(requestUrl: NextRequest, context: { params: Promise<{ address: string }> }) {
  const { address } = await context.params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return Response.json({ error: "Invalid wallet address." }, { status: 400 });
  const chain = parseSupportedChain(requestUrl.nextUrl.searchParams.get("chain"));
  const cursor = requestUrl.nextUrl.searchParams.get("next");
  if (cursor && cursor.length > 512) return Response.json({ error: "Invalid cursor." }, { status: 400 });
  const params = new URLSearchParams({ chain, limit: "30" });
  if (cursor) params.set("next", cursor);
  try {
    const payload = await request<{ asset_events?: unknown[]; events?: unknown[]; next?: string }>(`/events/accounts/${address}?${params}`, 45);
    const events = Array.isArray(payload.asset_events) ? payload.asset_events : Array.isArray(payload.events) ? payload.events : [];
    return Response.json({ address: address.toLowerCase(), chain, events: normalizeActivityEvents(events, chain), next: payload.next ?? null, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=45, stale-while-revalidate=30" } });
  } catch (error) { return apiError(error); }
}
