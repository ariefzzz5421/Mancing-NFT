"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Activity, Bookmark, ChartNoAxesCombined, Fish, LayoutDashboard, ListOrdered, Menu, ScanSearch, Settings2, Wallet, X } from "lucide-react";
import { MarketStatus } from "./MarketStatus";
import { CollectionSearch } from "./CollectionSearch";
import { WalletConnect, useWallet } from "@/components/wallet/WalletProvider";

const marketRoutes = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/terminal", label: "Terminal", icon: ChartNoAxesCombined },
  { href: "/scanner", label: "Scanner", icon: ScanSearch },
] as const;

const accountRoutes = [
  { href: "/orders", label: "Orders", icon: ListOrdered },
  { href: "/positions", label: "Positions", icon: Activity },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/wallets", label: "Wallet Tracker", icon: Fish },
] as const;

const preferenceRoutes = [
  { href: "/settings", label: "Settings", icon: Settings2 },
] as const;
const routes = [...marketRoutes, ...accountRoutes, ...preferenceRoutes];

export function Navigation() {
  const path = usePathname();
  const wallet = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const active = (href: string) => href === "/" ? path === "/" : href === "/terminal" ? path.startsWith("/terminal") || path.startsWith("/collection/") : path === href || path.startsWith(`${href}/`);
  const currentPage = routes.find((route) => active(route.href))?.label ?? "Collection";
  const links = (group: ReadonlyArray<(typeof routes)[number]>) => group.map(({ href, label, icon: Icon }) => <Link key={href} href={href} title={label} aria-current={active(href) ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon size={19} aria-hidden="true" /><span>{label}</span></Link>);
  useEffect(() => {
    if (!menuOpen) return;
    closeButton.current?.focus();
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [menuOpen]);
  return <>
    <header className="terminal-chrome">
      <div className="terminal-nav">
        <Link className="terminal-brand" href="/"><span className="terminal-brand__logo"><Image src="/icon.svg" alt="" width={52} height={52} priority /></span><span><strong>Mancing NFT</strong><small>Collection markets</small></span></Link>
        <div className="terminal-nav__context"><span>WORKSPACE</span><strong>{currentPage}</strong></div>
        {!(["/", "/terminal", "/watchlist"].includes(path)) && <div className="terminal-nav__search"><CollectionSearch /></div>}
        {wallet.address && <div className="terminal-nav__balances"><span>ETH <b>{wallet.eth ?? "—"}</b></span><span>WETH <b>{wallet.weth ?? "—"}</b></span></div>}
        <WalletConnect />
      </div>
      {wallet.error && <div className="terminal-wallet-error" role="alert">Wallet: {wallet.error}</div>}
      <MarketStatus />
    </header>
    <nav className="app-sidebar" aria-label="Primary navigation">
      <Link className="app-sidebar__mark" href="/" aria-label="Mancing NFT overview"><Image src="/icon.svg" alt="" width={42} height={42} /><strong>Mancing NFT</strong></Link>
      <div className="app-sidebar__group"><span className="app-sidebar__label">MARKETS</span>{links(marketRoutes)}</div>
      <div className="app-sidebar__group"><span className="app-sidebar__label">ACCOUNT</span>{links(accountRoutes)}</div>
      <div className="app-sidebar__group app-sidebar__group--last"><span className="app-sidebar__label">PREFERENCES</span>{links(preferenceRoutes)}</div>
    </nav>
    <nav className="mobile-dock" aria-label="Mobile navigation">
      {marketRoutes.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}><Icon size={19} aria-hidden="true" /><span>{label}</span></Link>)}
      <Link href="/watchlist" aria-current={active("/watchlist") ? "page" : undefined}><Bookmark size={19} /><span>Watchlist</span></Link>
      <button ref={menuButton} type="button" aria-label="Open all pages" aria-expanded={menuOpen} aria-controls="mobile-all-pages" onClick={() => setMenuOpen(true)}><Menu size={19} aria-hidden="true" /><span>More</span></button>
    </nav>
    {menuOpen && <div className="mobile-nav-backdrop"><button className="mobile-nav-dismiss" type="button" aria-label="Close pages menu" onClick={() => setMenuOpen(false)} /><nav id="mobile-all-pages" className="mobile-nav-drawer" aria-label="All pages"><div><strong>All pages</strong><button ref={closeButton} type="button" aria-label="Close menu" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }}><X size={20} /></button></div><span className="mobile-nav-drawer__label">MARKETS</span>{links(marketRoutes)}<span className="mobile-nav-drawer__label">ACCOUNT</span>{links(accountRoutes)}<span className="mobile-nav-drawer__label">PREFERENCES</span>{links(preferenceRoutes)}</nav></div>}
  </>;
}
