import { createPublicClient, erc721Abi, http, isAddress, keccak256, toBytes } from "viem";
import { mainnet } from "viem/chains";
import { authenticatedOwner, database, databaseConfigured } from "@/lib/server/watchlist-store";
import { sameOrigin } from "@/lib/server/wallet-session";
import { request, apiError, MarketError } from "@/lib/opensea/client";
import { arr, record } from "@/lib/opensea/normalize";
import { normalizeActivityEvents } from "@/lib/activity";
import { SEAPORT } from "@/lib/web3/constants";

const transferTopic = keccak256(toBytes("Transfer(address,address,uint256)"));
const rpc = createPublicClient({ chain: mainnet, transport: http(process.env.ETHEREUM_RPC_URL ?? "https://ethereum-rpc.publicnode.com", { timeout: 8000 }) });

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new MarketError("Same-origin request required.", 403);
    const owner = await authenticatedOwner(req);
    if (!owner) throw new MarketError("Sign in with your wallet to verify fills.", 401);
    if (!databaseConfigured()) throw new MarketError("Trade database is not configured.", 503);
    const body = await req.json();
    if (typeof body.hash !== "string" || !/^0x[a-f0-9]{64}$/i.test(body.hash)) throw new MarketError("Invalid offer hash.", 400);
    const { data: row, error } = await database().from("trade_orders")
      .select("order_hash,owner_id,wallet_address,collection_slug,contract_address,token_id,price_wei,quantity,side,status")
      .eq("owner_id", owner).eq("order_hash", body.hash).maybeSingle();
    if (error) throw new MarketError("Trade history unavailable. Check the Supabase migration.", 503);
    if (!row || !["OFFER", "LIST"].includes(row.side)) throw new MarketError("Trade order not found for this signed wallet.", 404);
    if (!isAddress(row.wallet_address) || !isAddress(row.contract_address)) throw new MarketError("Stored wallet or contract invalid.", 500);
    const order = record(await request(`/orders/chain/ethereum/protocol/${SEAPORT}/${row.order_hash}`, 0));
    const status = String(order.status ?? "UNKNOWN");
    if (["CANCELLED", "EXPIRED"].includes(status)) {
      await database().from("trade_orders").update({ status, updated_at: new Date().toISOString() })
        .eq("owner_id", owner).eq("order_hash", row.order_hash);
      if (row.side === "LIST" && row.token_id) {
        const currentOwner = await rpc.readContract({ address: row.contract_address as `0x${string}`, abi: erc721Abi, functionName: "ownerOf", args: [BigInt(row.token_id)] });
        if (currentOwner.toLowerCase() === row.wallet_address)
          await database().from("positions").update({ status: "INVENTORY", listing_price_wei: null, updated_at: new Date().toISOString() })
            .eq("owner_id", owner).eq("contract_address", row.contract_address).eq("token_id", row.token_id).eq("status", "LIST_ACTIVE");
      }
      return Response.json({ status, verified: false });
    }
    if (status !== "FULFILLED") return Response.json({ status, verified: false, message: "Offer is not filled according to OpenSea." });
    const result = record(await request(`/events/collection/${encodeURIComponent(row.collection_slug)}?event_type=sale&limit=100`, 0));
    const events = normalizeActivityEvents(arr(result.asset_events ?? result.events), "ethereum");
    const match = events.find((event) => event.orderHash?.toLowerCase() === row.order_hash.toLowerCase() &&
      (row.side === "OFFER" ? event.buyer?.toLowerCase() === row.wallet_address : event.seller?.toLowerCase() === row.wallet_address) &&
      (row.side === "OFFER" || event.tokenId === row.token_id) && event.tokenId && event.txHash);
    if (!match?.tokenId || !match.txHash || !/^0x[a-f0-9]{64}$/i.test(match.txHash))
      return Response.json({ status: "FILLED", verified: false, message: "Fill reported; matching sale event is not indexed yet. Retry later." });
    const tokenId = BigInt(match.tokenId);
    const [receipt, currentOwner] = await Promise.all([
      rpc.getTransactionReceipt({ hash: match.txHash as `0x${string}` }),
      rpc.readContract({ address: row.contract_address as `0x${string}`, abi: erc721Abi, functionName: "ownerOf", args: [tokenId] }),
    ]);
    const walletTopic = `0x${row.wallet_address.slice(2).padStart(64, "0")}`.toLowerCase();
    const tokenTopic = `0x${tokenId.toString(16).padStart(64, "0")}`.toLowerCase();
    const transfer = receipt.logs.some((log) => log.address.toLowerCase() === row.contract_address &&
      log.topics[0]?.toLowerCase() === transferTopic &&
      (row.side === "OFFER" ? log.topics[2]?.toLowerCase() === walletTopic : log.topics[1]?.toLowerCase() === walletTopic) &&
      log.topics[3]?.toLowerCase() === tokenTopic);
    const ownsAfter = currentOwner.toLowerCase() === row.wallet_address;
    if (receipt.status !== "success" || !transfer || (row.side === "OFFER" ? !ownsAfter : ownsAfter))
      return Response.json({ status: "FILLED", verified: false, message: "Order filled, but NFT transfer or current ownership is not verified. Position was not advanced." });
    const now = new Date().toISOString();
    if (row.side === "LIST") {
      const { data: position, error: lookupError } = await database().from("positions").select("id")
        .eq("owner_id", owner).eq("contract_address", row.contract_address).eq("token_id", tokenId.toString())
        .eq("status", "LIST_ACTIVE").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (lookupError || !position) throw new MarketError("Verified sale has no matching active position.", 409);
      const { error: updateError } = await database().from("positions").update({
        exit_price_wei: row.price_wei, exit_tx_hash: match.txHash, status: "SOLD", closed_at: now, updated_at: now,
      }).eq("id", position.id).eq("owner_id", owner);
      if (updateError) throw new MarketError("Sale verified, but position update failed.", 503);
      await database().from("trade_orders").update({ status: "FILLED", filled_at: now, tx_hash: match.txHash, updated_at: now })
        .eq("owner_id", owner).eq("order_hash", row.order_hash);
      return Response.json({ status: "SOLD", verified: true, tokenId: tokenId.toString(), exitPriceWei: row.price_wei, txHash: match.txHash });
    }
    const { error: positionError } = await database().from("positions").upsert({
      owner_id: owner, wallet_address: row.wallet_address, collection_slug: row.collection_slug,
      contract_address: row.contract_address, token_id: tokenId.toString(),
      entry_price_wei: row.price_wei, entry_order_hash: row.order_hash,
      entry_tx_hash: match.txHash, status: "INVENTORY", updated_at: now,
    }, { onConflict: "owner_id,contract_address,token_id,entry_order_hash" });
    if (positionError) throw new MarketError("Fill verified, but position storage failed. Check the Supabase migration.", 503);
    await database().from("trade_orders").update({ status: "FILLED", filled_at: now, tx_hash: match.txHash, updated_at: now })
      .eq("owner_id", owner).eq("order_hash", row.order_hash);
    return Response.json({ status: "INVENTORY", verified: true, tokenId: tokenId.toString(), entryPriceWei: row.price_wei, txHash: match.txHash });
  } catch (error) {
    return apiError(error);
  }
}
