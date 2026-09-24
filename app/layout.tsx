import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono } from "next/font/google";
import { AppFooter } from "@/components/AppFooter";
import { AppNav } from "@/components/AppNav";
import "./globals.css";
import "./terminal.css";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { PrivyWalletProvider } from "@/components/wallet/PrivyWalletProvider";
import { WatchlistProvider } from "@/lib/watchlist";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nft-analytic-dashboard.vercel.app"),
  title: {
    default: "Mancing NFT | NFT Quant Trading Terminal",
    template: "%s | Mancing NFT",
  },
  openGraph: {
    title: "Mancing NFT",
    description: "NFT Quant Trading Terminal",
    siteName: "Mancing NFT",
    type: "website",
    images: [{ url: "/brand/mancing-nft.png", width: 1254, height: 1254, alt: "Mancing NFT" }],
  },
  description:
    "NFT Quant Trading Terminal. Explore collection liquidity, bid/ask depth, spread and estimated net edge.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${geist.variable} ${plexMono.variable}`} lang="en">
      <body>
        {process.env.NEXT_PUBLIC_PRIVY_APP_ID ? <PrivyWalletProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}>
          <WatchlistProvider><AppNav />{children}<AppFooter /></WatchlistProvider>
        </PrivyWalletProvider> : <WalletProvider>
          <WatchlistProvider><AppNav />{children}<AppFooter /></WatchlistProvider>
        </WalletProvider>}
      </body>
    </html>
  );
}
