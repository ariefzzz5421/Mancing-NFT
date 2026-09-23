import { WalletActivityPage } from "@/components/wallets/WalletActivityPage";
export default async function Page({ params, searchParams }: { params: Promise<{ address: string }>; searchParams: Promise<{ chain?: string }> }) {
  const { address } = await params;
  const { chain } = await searchParams;
  return <WalletActivityPage address={address} chainParam={chain} />;
}
