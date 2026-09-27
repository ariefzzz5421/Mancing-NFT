"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { formatUnits } from "viem";
import type { MarketBookGroup } from "@/lib/opensea/read-only-book";
import type { MarketSelection } from "./ReadOnlyMarketBook";

type Mode = "BUY" | "OFFER" | "LIST" | "FLIP FLOP";

export function CollectionTradeAccess({ slug, chain, market, selection }: { slug: string; chain: string; market: MarketBookGroup | null; selection: MarketSelection | null }) {
  const [mode, setMode] = useState<Mode>("BUY");
  const ask = market?.asks[0];
  const bid = market?.bids[0];
  const relevant = selection?.side === (mode === "BUY" ? "ask" : "bid") && selection.currency === market?.currency && selection.decimals === market.decimals ? selection : null;
  const reference = mode === "BUY" ? ask : bid;
  const price = relevant ?? (reference && market ? { priceUnits: reference.priceUnits, currency: market.currency, decimals: market.decimals } : null);
  const spread = market?.bidScope === "collection" && ask && bid && BigInt(ask.priceUnits) > BigInt(bid.priceUnits) ? BigInt(ask.priceUnits) - BigInt(bid.priceUnits) : null;
  return <section className="t-panel collection-trade-access" aria-label="Trading access">
    <div className="panel-title"><span>04 / EXECUTION</span><span>CHAIN: {chain.toUpperCase()}</span></div>
    <div className="collection-trade-access__tabs" role="tablist" aria-label="Trade mode">{(["BUY", "OFFER", "LIST", "FLIP FLOP"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => setMode(item)}>{item}</button>)}</div>
    <div className="collection-trade-access__body">
      <h2>{mode === "FLIP FLOP" ? "Offer → fill → list" : mode === "LIST" ? "List an owned NFT" : mode === "OFFER" ? "Place an offer" : "Buy a listed NFT"}</h2>
      <dl><div><dt>{mode === "BUY" ? "Selected ask" : "Reference bid"}</dt><dd>{price ? `${formatUnits(BigInt(price.priceUnits), price.decimals)} ${price.currency}` : "—"}</dd></div><div><dt>Best ask</dt><dd>{ask && market ? `${formatUnits(BigInt(ask.priceUnits), market.decimals)} ${market.currency}` : "—"}</dd></div><div><dt>Gross spread</dt><dd>{spread && market ? `${formatUnits(spread, market.decimals)} ${market.currency}` : "—"}</dd></div></dl>
      {market?.bidScope === "token" && <p className="collection-trade-access__warning">The displayed bid targets a specific NFT. It cannot be treated as a collection-wide exit price.</p>}
      <p className="collection-trade-access__warning">Wallet execution on {chain} is not integrated in Mancing NFT. This is a market-data reference; no order is prepared or signed here. Review the exact NFT, price, currency, fees and wallet network on OpenSea.</p>
      <a className="t-primary collection-trade-access__action" href={`https://opensea.io/collection/${encodeURIComponent(slug)}`} target="_blank" rel="noopener noreferrer">Continue on OpenSea <ExternalLink size={14} aria-hidden="true" /></a>
    </div>
  </section>;
}
