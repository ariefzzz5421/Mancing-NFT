import { Star } from "lucide-react";
import { eth, price } from "@/lib/quant/book";
import type { Book, Collection, Stats } from "@/types/market";

export function CollectionPriceTape({ collection, stats, book, slug }: { collection: Collection | null; stats: Stats | null; book: Book | null; slug: string }) {
  const name = collection?.name ?? slug;
  const quotes = [
    { label: "FLOOR", value: price(stats?.floor), currency: "ETH", side: "ask" },
    { label: "BEST BID", value: book?.bids[0] ? eth(book.bids[0].priceWei) : "—", currency: "WETH", side: "bid" },
    { label: "BEST ASK", value: book?.asks[0] ? eth(book.asks[0].priceWei) : "—", currency: "ETH", side: "ask" },
    { label: "24H VOL", value: price(stats?.volume), currency: "ETH", side: "neutral" },
    { label: "24H SALES", value: price(stats?.sales), currency: "NFT", side: "neutral" },
  ];
  const series = (duplicate: boolean) => <div className="collection-tape__series" aria-hidden={duplicate}>
    <span className="collection-tape__identity">
      {collection?.image ? (
        // Collection images are third-party OpenSea thumbnails, shown without server proxying.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={collection.image} alt="" width={25} height={25} loading="lazy" />
      ) : <Star size={18} aria-hidden="true" />}
      <strong>{name}</strong>
    </span>
    {quotes.map((quote) => <span key={quote.label} className={`collection-tape__quote collection-tape__quote--${quote.side}`}>
      <small>{quote.label}</small><b>{quote.value}</b><em>{quote.currency}</em>
    </span>)}
  </div>;
  return <div className="collection-tape" aria-label={`Running collection prices for ${name}`}>
    <span className="collection-tape__badge">
      {collection?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={collection.image} alt="" width={23} height={23} loading="lazy" />
      ) : <Star size={17} aria-hidden="true" />}
      <span>MARKET TAPE</span>
    </span>
    <div className="collection-tape__viewport"><div className="collection-tape__track">{series(false)}{series(true)}</div></div>
    <span className="collection-tape__time">{book?.updatedAt ? `BOOK ${new Date(book.updatedAt).toLocaleTimeString()}` : "LOADING"}</span>
  </div>;
}
