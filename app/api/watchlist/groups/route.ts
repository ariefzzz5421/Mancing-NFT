import { authenticatedOwner, database, fromGroupRow, validGroupName, watchlistConfigured } from "@/lib/server/watchlist-store";
import { sameOrigin } from "@/lib/server/wallet-session";

const headers = { "Cache-Control": "no-store" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });

async function ownerFor(request: Request) {
  if (!watchlistConfigured()) return null;
  return authenticatedOwner(request);
}

export async function GET(request: Request) {
  const owner = await ownerFor(request);
  if (!owner) return json({ error: "Sign in with your wallet to view groups." }, 401);
  const { data, error } = await database().from("watchlist_groups").select("id,name,created_at").eq("owner_id", owner).order("created_at", { ascending: true }).limit(100);
  return error ? json({ error: "Watchlist groups unavailable." }, 503) : json({ groups: data.map(fromGroupRow) });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const owner = await ownerFor(request);
  if (!owner) return json({ error: "Sign in with your wallet to create groups." }, 401);
  const body = await request.text();
  if (body.length > 1000) return json({ error: "Request too large." }, 413);
  let input: unknown;
  try { input = JSON.parse(body); } catch { return json({ error: "Invalid request." }, 400); }
  const name = (input as { name?: unknown })?.name;
  if (!validGroupName(name)) return json({ error: "Enter a group name up to 60 characters." }, 400);
  const { data, error } = await database().from("watchlist_groups").insert({ owner_id: owner, name: name.trim() }).select("id,name,created_at").single();
  return error ? json({ error: error.code === "23505" ? "You already have a group with that name." : "Could not create group." }, error.code === "23505" ? 409 : 503) : json({ group: fromGroupRow(data) }, 201);
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const owner = await ownerFor(request);
  if (!owner) return json({ error: "Sign in with your wallet to rename groups." }, 401);
  const body = await request.text();
  if (body.length > 1000) return json({ error: "Request too large." }, 413);
  let input: { id?: unknown; name?: unknown } | null;
  try { input = JSON.parse(body); } catch { return json({ error: "Invalid request." }, 400); }
  if (!input || typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id) || !validGroupName(input.name)) return json({ error: "Invalid group." }, 400);
  const { data, error } = await database().from("watchlist_groups").update({ name: input.name.trim() }).eq("owner_id", owner).eq("id", input.id).select("id,name,created_at").maybeSingle();
  return error ? json({ error: error.code === "23505" ? "You already have a group with that name." : "Could not rename group." }, error.code === "23505" ? 409 : 503) : data ? json({ group: fromGroupRow(data) }) : json({ error: "Group not found." }, 404);
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const owner = await ownerFor(request);
  if (!owner) return json({ error: "Sign in with your wallet to remove groups." }, 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Invalid group." }, 400);
  const client = database();
  const belongs = await client.from("watchlist_groups").select("id").eq("owner_id", owner).eq("id", id).maybeSingle();
  if (belongs.error) return json({ error: "Could not check group." }, 503);
  if (!belongs.data) return json({ error: "Group not found." }, 404);
  const unset = await client.from("watchlist_items").update({ group_id: null }).eq("owner_id", owner).eq("group_id", id);
  if (unset.error) return json({ error: "Could not remove group." }, 503);
  const removed = await client.from("watchlist_groups").delete().eq("owner_id", owner).eq("id", id);
  return removed.error ? json({ error: "Could not remove group." }, 503) : json({ removed: true });
}
