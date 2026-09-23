import { request, apiError } from "@/lib/opensea/client";
import { buildHolderAnalysis } from "@/lib/holders";
import { extractSlug } from "@/lib/slug";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const slug = extractSlug((await context.params).slug);
  if (!slug) return Response.json({ error: "Invalid collection slug." }, { status: 400 });
  try {
    const payload = await request<{ holders?: unknown[]; next?: string }>(`/collections/${encodeURIComponent(slug)}/holders?limit=20&sort_direction=desc`, 120);
    const data = buildHolderAnalysis({ holders: Array.isArray(payload.holders) ? payload.holders : [], complete: !payload.next, supply: null, totalHolders: null });
    return Response.json({ holders: data.topHolders.slice(0, 10), partial: Boolean(payload.next), updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=120" } });
  } catch (error) { return apiError(error); }
}
