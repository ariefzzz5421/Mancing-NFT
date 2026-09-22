import { request, MarketError } from "@/lib/opensea/client";
let lastSuccess: string | null = null;
export async function GET() {
  const results = await Promise.allSettled([
    request("/offers/collection/pudgypenguins/all?limit=200", 0),
    request("/listings/collection/pudgypenguins/all?limit=200", 0),
  ]);
  const failures = results.flatMap((r) =>
    r.status === "rejected"
      ? [r.reason instanceof MarketError ? r.reason.status : 503]
      : [],
  );
  const lastStatus =
    failures.find((s) => s === 401 || s === 403) ??
    failures.find((s) => s === 429) ??
    failures[0] ??
    200;
  const state =
    lastStatus === 200
      ? "Operational"
      : lastStatus === 401 || lastStatus === 403
        ? "Authentication Failed"
        : lastStatus === 429
          ? "Rate Limited"
          : "Offline";
  const updatedAt = new Date().toISOString();
  if (!failures.length) lastSuccess = updatedAt;
  return Response.json(
    { state, lastStatus, lastSuccess, updatedAt },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
