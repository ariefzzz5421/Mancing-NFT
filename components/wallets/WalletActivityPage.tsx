"use client";
import Link from "next/link";
import { useWatchlist } from "@/lib/watchlist";
import { parseSupportedChain } from "@/lib/chains";
import { WalletActivityFeed } from "./WalletActivityFeed";

export function WalletActivityPage({ address, chainParam }: { address: string; chainParam?: string }) {
  const chain = parseSupportedChain(chainParam);
  const { items } = useWatchlist();
  const labels = items.flatMap((item) => item.chain === chain ? item.devWallets.filter((wallet) => wallet.address.toLowerCase() === address.toLowerCase()).map((wallet) => ({ ...wallet, collection: item.name ?? item.slug })) : []);
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return <main className="terminal-page"><p className="t-error">Invalid wallet address.</p></main>;
  return <main className="terminal-page wallet-activity-page"><div className="terminal-heading"><div><span className="eyebrow">WALLET TRACKER / {chain.toUpperCase()}</span><h1>{labels[0]?.label ?? "Tracked wallet"}<span className="heading-dot">.</span></h1><p className="t-muted wallet-activity-page__address">{address}</p></div><Link className="t-button" href="/wallets">All tracked wallets</Link></div>
    {labels.length ? <p className="t-note">Saved with {labels.map((label) => label.collection).join(", ")} in your watchlist.</p> : <p className="t-note">This wallet is not saved in your current watchlist. Add it from Wallet Tracker to keep its label.</p>}
    <WalletActivityFeed address={address} chain={chain} />
  </main>;
}
