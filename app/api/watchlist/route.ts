import { authenticatedOwner, database, fromRow, watchlistConfigured, validateItem } from "@/lib/server/watchlist-store";
import { sameOrigin } from "@/lib/server/wallet-session";

const headers = { "Cache-Control": "no-store" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });

async function ownerFor(request: Request) {
  if (!watchlistConfigured()) return { error: json({ error: "Cloud watchlist is not configured." }, 503), owner: null };
  const owner = await authenticatedOwner(request);
  if (!owner) return { error: json({ error: "Sign in with your wallet to sync your watchlist." }, 401), owner: null };
  return { owner, error: null };
}

export async function GET(request: Request) {
  const auth = await ownerFor(request);
  if (auth.error) return auth.error;
  const { data, error } = await database()
    .from("watchlist_items")
    .select("chain,slug,name,image_url,contract_address,notes,target_floors,dev_wallets,added_at,group_id")
    .eq("owner_id", auth.owner)
    .order("added_at", { ascending: false })
    .limit(200);
  return error ? json({ error: "Watchlist database unavailable." }, 503) : json({ items: data.map(fromRow) });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const auth = await ownerFor(request);
  if (auth.error) return auth.error;
  const text = await request.text();
  if (text.length > 30000) return json({ error: "Watchlist item too large." }, 413);
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return json({ error: "Invalid JSON." }, 400); }
  const item = validateItem(parsed);
  if (!item) return json({ error: "Invalid watchlist item." }, 400);
  if (item.groupId) {
    const group = await database().from("watchlist_groups").select("id").eq("owner_id", auth.owner).eq("id", item.groupId).maybeSingle();
    if (group.error || !group.data) return json({ error: "Watchlist group not found." }, 400);
  }
  const { data, error } = await database()
    .from("watchlist_items")
    .upsert({
      owner_id: auth.owner, chain: item.chain, slug: item.slug.toLowerCase(),
      name: item.name ?? null, image_url: item.imageUrl ?? null,
      contract_address: item.contractAddress ?? null, notes: item.notes ?? null,
      target_floors: item.targetFloors, dev_wallets: item.devWallets,
      added_at: item.addedAt, group_id: item.groupId ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: "owner_id,chain,slug" })
    .select("chain,slug,name,image_url,contract_address,notes,target_floors,dev_wallets,added_at,group_id")
    .single();
  return error ? json({ error: "Watchlist save failed." }, 503) : json({ item: fromRow(data) });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const auth = await ownerFor(request);
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.toLowerCase();
  const chain = url.searchParams.get("chain");
  if (!slug || !/^[a-z0-9][a-z0-9_-]{0,159}$/.test(slug) || !["ethereum", "ape_chain"].includes(String(chain)))
    return json({ error: "Invalid collection." }, 400);
  const { error } = await database().from("watchlist_items").delete().eq("owner_id", auth.owner).eq("chain", chain).eq("slug", slug);
  return error ? json({ error: "Watchlist removal failed." }, 503) : json({ removed: true });
}
