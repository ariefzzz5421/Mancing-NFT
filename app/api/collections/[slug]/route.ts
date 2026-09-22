import { request, apiError } from "@/lib/opensea/client";
import { normalizeCollection } from "@/lib/opensea/normalize";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    return Response.json(
      normalizeCollection(
        await request(`/collections/${encodeURIComponent(slug)}`, 900),
        slug,
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
