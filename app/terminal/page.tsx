"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { recentTerminal } from "@/lib/collection-navigation";

export default function TerminalLanding() {
  const router = useRouter();
  useEffect(() => { router.replace(recentTerminal() ?? "/"); }, [router]);
  return <main className="terminal-page"><div className="t-panel t-note" role="status">Opening your last collection…</div></main>;
}
