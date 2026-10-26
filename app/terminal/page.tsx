"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, ChartNoAxesCombined, Wallet } from "lucide-react";
import { CollectionSearch } from "@/components/terminal/CollectionSearch";
import { recentTerminal } from "@/lib/collection-navigation";

export default function TerminalLanding() {
  const [recent, setRecent] = useState<string | null>(null);
  useEffect(() => { queueMicrotask(() => setRecent(recentTerminal())); }, []);
  return <main className="terminal-page terminal-landing">
    <div className="terminal-heading"><div><span className="eyebrow">COLLECTION RESEARCH</span><h1>Collection terminal</h1></div></div>
    <p className="terminal-landing__intro">Open a collection to review asks, bids, recent activity, and estimated trade costs.</p>
    <section className="t-panel terminal-landing__search" aria-labelledby="terminal-search-title">
      <div className="panel-title" id="terminal-search-title">FIND A COLLECTION</div>
      <div><CollectionSearch />{recent && <Link className="terminal-landing__recent" href={recent}>Continue your last collection <ArrowRight size={16} aria-hidden="true" /></Link>}</div>
    </section>
    <div className="terminal-landing__features" aria-label="Terminal tools">
      <div className="t-panel"><BookOpen size={22} aria-hidden="true" /><h2>Order book</h2><p>Compare available asks and collection-wide bids.</p></div>
      <div className="t-panel"><ChartNoAxesCombined size={22} aria-hidden="true" /><h2>Market history</h2><p>Review price movement and recent sales.</p></div>
      <div className="t-panel"><Wallet size={22} aria-hidden="true" /><h2>Wallet review</h2><p>Check costs and order details before signing.</p></div>
    </div>
  </main>;
}
