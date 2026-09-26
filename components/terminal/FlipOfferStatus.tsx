"use client";
import { useCallback, useEffect, useState } from "react";
import { edge, eth, wei } from "@/lib/quant/book";
import { useWallet } from "@/components/wallet/WalletProvider";
import type { Collection } from "@/types/market";

type Offer = { order_hash: string; collection_slug: string; side: string; price_wei: string; status: string };
type Inventory = { tokenId: string; entryPriceWei: string; floorWei: string | null; txHash: string };

export function FlipOfferStatus({ slug, collection, bestAsk, onList }: {
  slug: string; collection: Collection | null; bestAsk: string | undefined;
  onList: (tokenId: string, price: string) => void;
}) {
  const wallet = useWallet();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const check = useCallback(async () => {
    if (!wallet.userId) return;
    try {
      const response = await fetch("/api/trade-orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Trade history unavailable");
      const latest = (data.rows as Offer[]).find((row) => row.collection_slug === slug && row.side === "OFFER" && ["ACTIVE", "FILLED", "FULFILLED"].includes(row.status));
      setOffer(latest ?? null);
      if (!latest || inventory) return;
      const verification = await fetch("/api/flip/reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash: latest.order_hash }) });
      const result = await verification.json();
      if (!verification.ok) throw Error(result.error ?? "Fill verification unavailable");
      if (result.verified) {
        const statsResponse = await fetch(`/api/collections/${encodeURIComponent(slug)}/stats`, { cache: "no-store" });
        const stats = statsResponse.ok ? await statsResponse.json() : null;
        setInventory({ tokenId: result.tokenId, entryPriceWei: result.entryPriceWei, floorWei: stats?.floor != null ? (wei(String(stats.floor))?.toString() ?? null) : null, txHash: result.txHash });
        setMessage("Offer fill and NFT ownership verified on Ethereum. Review a listing price and sign with your wallet.");
      } else if (result.status === "FILLED") setMessage(result.message ?? "Fill reported; waiting for Ethereum verification.");
      else setMessage("Offer active. Checking for a confirmed fill while this panel is open.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Fill check unavailable"); }
  }, [wallet.userId, slug, inventory]);
  useEffect(() => {
    if (!wallet.userId) return;
    const kickoff = window.setTimeout(() => void check(), 0);
    const interval = window.setInterval(() => { if (!document.hidden) void check(); }, 120000);
    return () => { window.clearTimeout(kickoff); window.clearInterval(interval); };
  }, [check, wallet.userId]);
  const floor = inventory?.floorWei ?? bestAsk ?? null;
  const fees = collection?.fees.filter((fee) => fee.required).reduce((sum, fee) => sum + fee.bps, 0) ?? 0;
  const royalties = collection?.fees.filter((fee) => !fee.required).reduce((sum, fee) => sum + fee.bps, 0) ?? 0;
  const net = inventory && floor ? edge(BigInt(inventory.entryPriceWei), BigInt(floor), 1, fees, royalties, 500000000000000n, 50) : null;
  function list(multiplier: bigint) {
    if (!inventory || !floor) return;
    onList(inventory.tokenId, eth(BigInt(floor) * multiplier / 1000n));
  }
  return <div className="flip-status">
    <div className="panel-title"><span>FLIP FLOP STATUS</span><button type="button" disabled={busy || !wallet.userId} onClick={async () => { setBusy(true); await check(); setBusy(false); }}>Verify now</button></div>
    {!wallet.userId ? <p className="t-note">Sign in with your connected wallet to monitor offer fills.</p> : inventory ? <div className="flip-status__body">
      <strong className="positive">OFFER FILLED · NFT #{inventory.tokenId} VERIFIED</strong>
      <dl className="metric-list"><div><dt>Entry</dt><dd>{eth(inventory.entryPriceWei)} WETH</dd></div><div><dt>{inventory.floorWei ? "Fresh reported floor" : "Latest book ask (floor unavailable)"}</dt><dd>{eth(floor)} ETH</dd></div><div><dt>Estimated net edge</dt><dd className={net && net.net >= 0n ? "positive" : "negative"}>{net ? `${eth(net.net)} ETH · ${(net.roiBps / 100).toFixed(2)}%` : "—"}</dd></div></dl>
      <div className="flip-status__actions"><button className="t-button t-primary" disabled={!floor} onClick={() => list(1000n)}>LIST @ FLOOR</button><button className="t-button" disabled={!floor} onClick={() => list(999n)}>LIST −0.1%</button><button className="t-button" disabled={!floor} onClick={() => list(1001n)}>LIST +0.1%</button><button className="t-button" onClick={() => onList(inventory.tokenId, floor ? eth(floor) : "")}>CUSTOM</button></div>
      <p className="t-note">Listing remains a separate wallet-signed order. Floor is a reported snapshot, not an executable sale.</p>
    </div> : <div className="flip-status__body"><span>{offer ? `Offer ${offer.order_hash.slice(0, 12)}…` : "No cloud-recorded collection offer yet."}</span><p className="t-note">{message || "Checking offer state and Ethereum ownership…"}</p></div>}
  </div>;
}
