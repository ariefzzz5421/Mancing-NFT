# Mancing NFT

NFT Quant Trading Terminal for collection liquidity research and non-custodial Ethereum trading.

## Workspaces

- Overview: real OpenSea trending collections and 24h volume ranking, with collection search and direct terminal access. Trending floor and volume are shown only when OpenSea statistics are available.
- Terminal: collection search, aggregated asks and collection-wide bids, spread, liquidity bands, net-edge estimates and sweep targets.
- Scanner: compare up to eight collections with explicit depth coverage and cost assumptions.
- Wallet, Orders and Positions: injected or Privy wallet balances, paginated holdings, order creation/cancellation and floor-versus-bid estimates.
- Watchlist and Settings: a built-in Default list, named groups selected from the star dialog, wallet-scoped Supabase sync, real API health and reported OpenSea request quota, diagnostics and trading preferences.
- Wallet Tracker: label a wallet under a saved collection, keep the label in the wallet-scoped watchlist, and open a dedicated OpenSea NFT activity feed for that address. Terminal shows the top indexed holders for its collection.

## Run

Use Node 20.9+ (Node 24 tested).

```sh
git clone https://github.com/ariefzzz5421/Mancing-NFT.git
cd Mancing-NFT
npm ci
```

Copy `.env.example` to `.env.local`, set `OPENSEA_API_KEY`, then run `npm run dev`.
Optional `ETHEREUM_RPC_URL` supplies a server-only RPC; otherwise public Ethereum RPC is used. `ETHERSCAN_API_KEY` supports the existing wallet research tools. No server credential belongs in a `NEXT_PUBLIC_` variable.

For wallet-backed watchlists, run `supabase/migrations/20260923_watchlist_items.sql` and `supabase/migrations/20260923_watchlist_groups.sql` in the intended Supabase project. Set `SUPABASE_SERVICE_ROLE_KEY` and a random 32-byte or longer `WATCHLIST_SESSION_SECRET` on the server. A wallet signs a short-lived, site-bound sign-in message; an HttpOnly session cookie then scopes items and groups to that wallet. The service-role key and session secret must never be public. `NEXT_PUBLIC_PRIVY_APP_ID` remains optional for Privy-powered wallet connection; configure the deployed site as an allowed origin in Privy before enabling it. Settings shows the actual configuration state.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Execution and data boundaries

Orders are prepared through server-only OpenSea APIs and signed by the connected wallet using Seaport. The application never requests or stores private keys. Ethereum ERC-721 trading and EOA order signatures are supported; other formats are explicitly excluded. Quotes, funding, gas and order validity are rechecked before requesting wallet execution.

Depth is advertised liquidity, not guaranteed executable capital. Partial pagination, shared maker funds, fees and resale uncertainty are visible. Gross spread is never described as profit. Production routes never supply mock market data.

The major-asset strip uses a server-fetched CoinGecko snapshot refreshed at most once per minute, with a limited Yahoo fallback. Missing quotes stay unavailable. USD values in the execution calculator are indicative conversions, never signing amounts. Chain marks shown in collection discovery are locally served assets from [Solana](https://solana.com/branding), [ApeChain](https://apechain.com/), [Base](https://brand.base.org/core-identifiers), [Polygon](https://www.polygon.technology/brand-guidelines), [Avalanche](https://www.avax.network/), and [Arbitrum](https://arbitrum.io/brand-kit) where available; an explicit chain abbreviation is shown when an official mark is unavailable. Marks identify a network and do not imply an endorsement.

Overview filters OpenSea's trending and top rankings by chain and by supported ranking metrics. OpenSea does not provide a true collection market-cap ranking here: the optional single-chain floor-cap view multiplies floor by reported supply for a clearly labeled sample of six volume leaders. Search uses OpenSea's cross-chain results and batch collection metadata to identify networks; if metadata is temporarily unavailable, the chain stays unknown until opening the result triggers another lookup. The terminal trades only on its supported chains. The status bar's NFT transaction USD cost is an illustration using the current Ethereum gas price and 180,000 gas units, not a wallet quote. Etherscan's server-side gas oracle supplies the rate when configured, with RPC fallback. The APE, Robinhood Chain and Arc artwork was supplied by the project owner.

The previous production OpenSea credential returned 401. A temporary replacement key restored authenticated order-book access on 23 September 2026; it expires around 29 September 2026 and must be replaced with a permanent server-side OpenSea key. See [architecture, scope and verification notes](docs/MANCING-NFT.md).
