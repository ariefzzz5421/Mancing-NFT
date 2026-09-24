import type { MarketSymbol } from "@/lib/types";
import Image from "next/image";

type TokenLogoProps = {
  className?: string;
  symbol: MarketSymbol;
};

const tokenStyles: Record<MarketSymbol, string> = {
  APE: "border-blue-300/30 bg-blue-300/10",
  BNB: "border-amber-300/30 bg-amber-300/10",
  BTC: "border-orange-300/30 bg-orange-300/10",
  ETH: "border-cyan-300/30 bg-cyan-300/10",
  HYPE: "border-emerald-300/30 bg-emerald-300/10",
  SOL: "border-fuchsia-300/30 bg-fuchsia-300/10",
  ZEC: "border-amber-300/30 bg-amber-300/10",
  SP500: "border-red-300/30 bg-red-300/10",
};

const tokenLogoSrc: Record<MarketSymbol, string> = {
  APE: "/token-logos/APE.png",
  BNB: "/token-logos/BNB.png",
  BTC: "/token-logos/BTC.png",
  ETH: "/token-logos/ETH.png",
  HYPE: "/token-logos/HYPE.png",
  SOL: "/token-logos/SOL.png",
  ZEC: "/token-logos/ZEC.png",
  SP500: "/token-logos/SP500.png",
};

export function TokenLogo({ className = "", symbol }: TokenLogoProps) {
  const imageClass =
    symbol === "SOL"
      ? "h-[78%] w-[78%] object-contain"
      : symbol === "ETH"
        ? "h-[86%] w-[86%] object-contain"
        : "h-full w-full object-cover";

  return (
    <span
      aria-label={`${symbol} logo`}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border ${tokenStyles[symbol]} ${className}`}
      title={symbol}
    >
      <Image alt="" className={imageClass} src={tokenLogoSrc[symbol]} width={28} height={28} />
    </span>
  );
}
