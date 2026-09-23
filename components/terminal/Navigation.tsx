"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fish } from "lucide-react";
import { MarketStatus } from "./MarketStatus";
import { WalletConnect } from "@/components/wallet/WalletProvider";
export function Navigation() {
  const path = usePathname();
  return (
    <header className="terminal-chrome">
      <nav className="terminal-nav" aria-label="Primary navigation">
        <Link className="terminal-brand" href="/">
          <Fish size={30} />
          <span>
            <strong>Mancing NFT</strong>
            <small>NFT Quant Trading Terminal</small>
          </span>
        </Link>
        <div className="terminal-links">
          {[
            ["/", "Overview"],
            ["/terminal/pudgypenguins", "Terminal"],
            ["/scanner", "Scanner"],
            ["/orders", "Orders"],
            ["/positions", "Positions"],
            ["/watchlist", "Watchlist"],
            ["/wallet", "Wallet"],
            ["/settings", "Settings"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                (
                  href === "/"
                    ? path === "/"
                    : href === "/terminal/pudgypenguins"
                      ? path.startsWith("/terminal/")
                    : path === href
                )
                  ? "page"
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </div>
        <WalletConnect />
      </nav>
      <MarketStatus />
    </header>
  );
}
