import { ExternalLink } from "lucide-react";

export function OpenSeaDetailsLink({ slug, name, className = "" }: { slug: string; name: string; className?: string }) {
  return <a
    className={`opensea-details-link ${className}`}
    href={`https://opensea.io/collection/${encodeURIComponent(slug)}`}
    target="_blank"
    rel="noopener noreferrer"
    title={`View ${name} on OpenSea`}
    aria-label={`View ${name} on OpenSea`}
  ><ExternalLink size={14} aria-hidden="true" /></a>;
}
