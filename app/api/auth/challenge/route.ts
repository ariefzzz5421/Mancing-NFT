import { newChallenge, walletAuthConfigured } from "@/lib/server/wallet-session";

export async function GET(request: Request) {
  if (!walletAuthConfigured()) return Response.json({ error: "Wallet sign-in is not configured." }, { status: 503 });
  try {
    const address = new URL(request.url).searchParams.get("address") ?? "";
    return Response.json(newChallenge(request, address), { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Invalid wallet address." }, { status: 400 }); }
}
