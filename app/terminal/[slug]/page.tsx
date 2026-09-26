import { Terminal } from "@/components/terminal/Terminal";
import { CollectionTerminalPreview } from "@/components/terminal/CollectionTerminalPreview";
import { request } from "@/lib/opensea/client";
import { normalizeCollection } from "@/lib/opensea/normalize";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ chain?: string | string[] }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const requestedChain = Array.isArray(query.chain) ? query.chain[0] : query.chain;
  if (requestedChain && requestedChain !== "ethereum")
    return <CollectionTerminalPreview key={`${slug}:${requestedChain}`} slug={slug} requestedChain={requestedChain} />;
  let actualChain = requestedChain ?? "unknown";
  try {
    actualChain = normalizeCollection(await request(`/collections/${encodeURIComponent(slug)}`, 300), slug).chain;
  } catch {
    // The client preview has its own retry state. Never assume Ethereum when the network cannot be verified.
  }
  return actualChain === "ethereum"
    ? <Terminal key={slug} slug={slug} />
    : <CollectionTerminalPreview key={`${slug}:${actualChain}`} slug={slug} requestedChain={actualChain} />;
}
