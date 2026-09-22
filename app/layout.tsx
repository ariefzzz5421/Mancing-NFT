import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono } from "next/font/google";
import { AppFooter } from "@/components/AppFooter";
import { AppNav } from "@/components/AppNav";
import "./globals.css";
import "./terminal.css";
import { WalletProvider } from "@/components/wallet/WalletProvider";

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
  title: {
    default: "Mancing NFT | NFT Quant Trading Terminal",
    template: "%s | Mancing NFT",
  },
  openGraph: {
    title: "Mancing NFT",
    description: "NFT Quant Trading Terminal",
    siteName: "Mancing NFT",
    type: "website",
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
        <WalletProvider>
          <AppNav />
          {children}
          <AppFooter />
        </WalletProvider>
      </body>
    </html>
  );
}
