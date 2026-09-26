# Flip Flop execution and verification

Flip Flop starts with a user-signed Ethereum collection offer. The signed Seaport order is validated by the server, submitted to OpenSea, and recorded in `trade_orders` for the wallet's authenticated owner ID. The browser keeps its existing order-history backup if the database is unavailable.

`POST /api/flip/reconcile` is the current verification boundary. It checks OpenSea's order status and matching sale event, then verifies a successful Ethereum transaction receipt, an ERC-721 transfer for the exact collection and token, and current ownership through `ownerOf`. Only after those checks may it create an `INVENTORY` position. A verified listing fill similarly advances an existing position to `SOLD` after a transfer out. Unmatched or unconfirmed events remain pending.

`lib/flip-flop/state.ts` defines the state transitions and separates a future OpenSea Stream signal from a confirmed Ethereum event. A Stream consumer may wake reconciliation, but it must never write a filled position directly. No background Stream connection or webhook is deployed yet; the Flip panel polls while open and has a manual Verify action. Old sale events outside OpenSea's fetched 100-event window may require a more complete indexed event source.

Orders and positions are private to the signed-wallet server session. The Supabase service-role key and OpenSea key remain server-side. BUY always fetches fulfillment data again and simulates the transaction before asking the wallet to send it. OFFER and LIST still require a separate wallet signature; no server-side private key is involved.

The UI's net edge is an estimate using the current book or reported floor and editable fee assumptions. Neither an offer fill nor a future sale is guaranteed. A reported floor is not an executable bid.
