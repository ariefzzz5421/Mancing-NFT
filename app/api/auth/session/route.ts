import { clearSessionCookie, sameOrigin, sessionAddress, sessionCookie, verifyChallenge, walletAuthConfigured } from "@/lib/server/wallet-session";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  return Response.json({ address: sessionAddress(request) }, { headers });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403, headers });
  if (!walletAuthConfigured()) return Response.json({ error: "Wallet sign-in is not configured." }, { status: 503, headers });
  const body = await request.text();
  if (body.length > 2048) return Response.json({ error: "Request too large." }, { status: 413, headers });
  let input: unknown;
  try { input = JSON.parse(body); } catch { return Response.json({ error: "Invalid request." }, { status: 400, headers }); }
  const address = await verifyChallenge(request, input);
  if (!address) return Response.json({ error: "Wallet signature is invalid or expired." }, { status: 401, headers });
  return Response.json({ address }, { headers: { ...headers, "Set-Cookie": sessionCookie(address, request) } });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403, headers });
  return Response.json({ signedOut: true }, { headers: { ...headers, "Set-Cookie": clearSessionCookie(request) } });
}
