import { eth, spread } from "@/lib/quant/book";
import Image from "next/image";
export function SpreadPanel({ bid, ask }: { bid?: string; ask?: string }) {
  const s = spread(bid, ask);
  return (
    <div className="spread-strip">
      {[
        ["BEST BID", eth(bid), "positive"],
        ["BEST ASK", eth(ask), "negative"],
        ["SPREAD", eth(s?.absolute), ""],
        ["GROSS SPREAD", s ? `${(s.bps / 100).toFixed(2)}%` : "—", ""],
      ].map(([label, value, color]) => (
        <div key={label}>
          <span>{label}</span>
          <strong className={color}>{value}</strong>
          <small>
            {label === "GROSS SPREAD" ? "Before trading costs" : <><Image src="/token-logos/ETH.png" alt="" width={13} height={13} /> ETH</>}
          </small>
        </div>
      ))}
    </div>
  );
}
