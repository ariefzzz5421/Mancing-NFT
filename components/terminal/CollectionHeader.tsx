import Link from "next/link";
import { BadgeCheck, ExternalLink } from "lucide-react";
import type { Collection, Stats, Book } from "@/types/market";
import { eth, price, spread } from "@/lib/quant/book";
import { ChainLogo } from "@/components/ChainLogo";
import { OpenSeaDetailsLink } from "@/components/OpenSeaDetailsLink";
export function CollectionHeader({
  collection: c,
  stats: s,
  book: b,
  slug,
}: {
  collection: Collection | null;
  stats: Stats | null;
  book: Book | null;
  slug: string;
}) {
  const bookSpread = spread(b?.bids[0]?.priceWei, b?.asks[0]?.priceWei);
  return (
    <section className="t-panel terminal-collection-overview">
      <div className="panel-title">
        <span>01 / COLLECTION</span>
        <span className="chain-inline">{c?.chain && <ChainLogo chain={c.chain} />}{c?.chain ?? "—"}</span>
      </div>
      <div className="collection-identity">
        {c?.image ? (
          // Remote OpenSea thumbnails have explicit dimensions; arbitrary collection hosts are not proxied.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.image} alt="" width={56} height={56} />
        ) : (
          <div className="collection-placeholder">M↗</div>
        )}
        <div>
          <h2 className="collection-title-line">{c?.name ?? slug} <OpenSeaDetailsLink slug={slug} name={c?.name ?? slug} /></h2>
          {c?.verified && (
            <span className="verified">
              <BadgeCheck size={13} />
              Verified on OpenSea
            </span>
          )}
          <span className="t-muted">
            NFT / {c?.chain ?? "Loading metadata"}
          </span>
        </div>
      </div>
      <dl className="metric-list">
        {[
          ["Floor", `${price(s?.floor)} ETH`],
          ["Best bid", `${eth(b?.bids[0]?.priceWei)} WETH`],
          ["Best ask", `${eth(b?.asks[0]?.priceWei)} ETH`],
          ["Gross spread", bookSpread ? `${(bookSpread.bps / 100).toFixed(2)}%` : "—"],
          ["24h volume", `${price(s?.volume)} ETH`],
          ["24h sales", price(s?.sales)],
          ["Total supply", price(c?.supply)],
          ["Owners", price(s?.owners)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="contract-line">
        <span>CONTRACT</span>
        <code>{c?.contract ?? "Unavailable"}</code>
      </div>
      <div className="t-links">
        <Link href={`/collection/${slug}`}>
          Holder & activity research <ExternalLink size={12} />
        </Link>
        <a
          href={`https://opensea.io/collection/${encodeURIComponent(slug)}`}
          target="_blank"
          rel="noreferrer"
        >
          OpenSea <ExternalLink size={12} />
        </a>
      </div>
    </section>
  );
}
