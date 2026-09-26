"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Activity, Bookmark, ChartNoAxesCombined, Fish, LayoutDashboard, ListOrdered, Menu, ScanSearch, Settings2, Wallet, X } from "lucide-react";
import { MarketStatus } from "./MarketStatus";
import { CollectionSearch } from "./CollectionSearch";
import { WalletConnect, useWallet } from "@/components/wallet/WalletProvider";

const routes = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/terminal/pudgypenguins", label: "Terminal", icon: ChartNoAxesCombined },
  { href: "/scanner", label: "Scanner", icon: ScanSearch },
  { href: "/orders", label: "Orders", icon: ListOrdered },
  { href: "/positions", label: "Positions", icon: Activity },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/wallets", label: "Wallet Tracker", icon: Fish },
  { href: "/settings", label: "Settings", icon: Settings2 },
] as const;

export function Navigation() {
  const path = usePathname();
  const wallet = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const active = (href: string) => href === "/" ? path === "/" : href.startsWith("/terminal/") ? path.startsWith("/terminal/") : path === href || path.startsWith(`${href}/`);
  const links = routes.map(({ href, label, icon: Icon }) => <Link key={href} href={href} title={label} aria-label={label} aria-current={active(href) ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon size={19} aria-hidden="true" /><span>{label}</span></Link>);
  return <>
    <header className="terminal-chrome">
      <div className="terminal-nav">
        <Link className="terminal-brand" href="/"><span className="terminal-brand__logo"><Image src="/icon.svg" alt="" width={52} height={52} priority /></span><span><strong>Mancing NFT</strong><small>NFT Quant Execution Terminal</small></span></Link>
        <div className="terminal-nav__search"><CollectionSearch /></div>
        {wallet.address && <div className="terminal-nav__balances"><span>ETH <b>{wallet.eth ?? "—"}</b></span><span>WETH <b>{wallet.weth ?? "—"}</b></span></div>}
        <WalletConnect />
      </div>
      <MarketStatus />
    </header>
    <nav className="app-sidebar" aria-label="Primary navigation"><Link className="app-sidebar__mark" href="/" aria-label="Mancing NFT overview"><Image src="/icon.svg" alt="" width={42} height={42} /></Link>{links}</nav>
    <nav className="mobile-dock" aria-label="Mobile navigation">
      {routes.slice(0, 3).map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}><Icon size={19} /><span>{label}</span></Link>)}
      <Link href="/watchlist" aria-current={active("/watchlist") ? "page" : undefined}><Bookmark size={19} /><span>Watchlist</span></Link>
      <button type="button" aria-label="Open all pages" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={19} /><span>More</span></button>
    </nav>
    {menuOpen && <div className="mobile-nav-backdrop" onClick={() => setMenuOpen(false)}><nav className="mobile-nav-drawer" aria-label="All pages" onClick={(event) => event.stopPropagation()}><div><strong>Pages</strong><button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>{links}</nav></div>}
  </>;
}
