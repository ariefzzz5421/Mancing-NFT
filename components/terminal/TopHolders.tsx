"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

type Holder = { address: string; quantity: number };
export function TopHolders({ slug }: { slug: string }) {
  const [holders, setHolders] = useState<Holder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const target = panelRef.current;
    if (!target) return;
    if (!("IntersectionObserver" in window)) { queueMicrotask(() => setVisible(true)); return; }
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "200px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    fetch(`/api/collections/${encodeURIComponent(slug)}/holders`, { signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw Error(data.error ?? "Holder feed unavailable"); return data; })
      .then((data) => { setHolders(data.holders); setError(""); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Holder feed unavailable"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, visible]);
  return <section className="t-panel top-holders" ref={panelRef}><div className="panel-title"><span>TOP HOLDERS</span><Link href={`/collection/${encodeURIComponent(slug)}#holders`}>FULL LEDGER <ExternalLink size={12} aria-hidden="true" /></Link></div>
    {loading ? <p className="t-note">{visible ? "Loading indexed holders…" : "Scroll to load indexed holders…"}</p> : error ? <p className="t-note">{error}</p> : holders.length ? <ol>{holders.map((holder, index) => <li key={holder.address}><span>{String(index + 1).padStart(2, "0")}</span><a href={`https://etherscan.io/address/${holder.address}`} target="_blank" rel="noreferrer" title={holder.address}>{holder.address.slice(0, 6)}…{holder.address.slice(-4)}</a><strong>{holder.quantity.toLocaleString()} NFTs</strong></li>)}</ol> : <p className="t-note">Holder details unavailable for this collection.</p>}
    <p className="t-note">OpenSea indexed holder snapshot; ranking can change.</p>
  </section>;
}
