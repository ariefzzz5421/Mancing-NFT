type ChainLogoProps = { chain: string; className?: string };
const logos: Record<string, string> = {
  ethereum: "/token-logos/ETH.png",
  eth: "/token-logos/ETH.png",
  ape_chain: "/chain-logos/ape_chain.png",
  apechain: "/chain-logos/ape_chain.png",
  solana: "/chain-logos/solana.svg",
  base: "/chain-logos/base.png",
  polygon: "/chain-logos/polygon.svg",
  matic: "/chain-logos/polygon.svg",
  arbitrum: "/chain-logos/arbitrum.ico",
  avalanche: "/chain-logos/avalanche.svg",
  bsc: "/token-logos/BNB.png",
  bnb: "/token-logos/BNB.png",
  hyperliquid: "/token-logos/HYPE.png",
  hyperevm: "/token-logos/HYPE.png",
  robinhood: "/chain-logos/robinhood.png",
  arc: "/chain-logos/arc.jpg",
};
export function ChainLogo({ chain, className = "" }: ChainLogoProps) {
  const name = chain === "robinhood" ? "Robinhood Chain" : chain.replaceAll("_", " ");
  const src = logos[chain.toLowerCase()];
  return src ? <span className={`chain-logo ${className}`} title={`${name} network`}>
    {/* Locally served network artwork is used where available. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={`${name} network`} width={18} height={18} loading="lazy" />
  </span> : <span className={`chain-logo chain-logo--text ${className}`} title={`${name} network`} aria-label={`${name} network`}>{chain.slice(0, 2).toUpperCase()}</span>;
}
