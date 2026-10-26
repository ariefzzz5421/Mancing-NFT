import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppFooter } from "@/components/AppFooter";
import { AppNav } from "@/components/AppNav";
import "./globals.css";
import "./terminal.css";
import "./redesign.css";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { PrivyWalletProvider } from "@/components/wallet/PrivyWalletProvider";
import { WatchlistProvider } from "@/lib/watchlist";

const geist = localFont({
  src: "./fonts/geist-latin-wght-normal.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/ibm-plex-mono-latin-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "nft-analytic-dashboard.vercel.app"}`),
  title: {
    default: "Mancing NFT | Collection Market Research",
    template: "%s | Mancing NFT",
  },
  openGraph: {
    title: "Mancing NFT",
    description: "Collection market research and trading tools",
    siteName: "Mancing NFT",
    type: "website",
  },
  description:
    "Research collection rankings, order-book depth, spreads, and costs before wallet-signed NFT trades.",
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
