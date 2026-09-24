import { Terminal } from "@/components/terminal/Terminal";
import { CollectionTerminalPreview } from "@/components/terminal/CollectionTerminalPreview";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ chain?: string | string[] }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const requestedChain = Array.isArray(query.chain) ? query.chain[0] : query.chain;
  return requestedChain && requestedChain !== "ethereum"
    ? <CollectionTerminalPreview key={`${slug}:${requestedChain}`} slug={slug} requestedChain={requestedChain} />
    : <Terminal key={slug} slug={slug} />;
}
