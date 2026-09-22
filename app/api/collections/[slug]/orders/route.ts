import { getBook } from "@/lib/opensea/book";
import { apiError } from "@/lib/opensea/client";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    return Response.json(await getBook(slug), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
