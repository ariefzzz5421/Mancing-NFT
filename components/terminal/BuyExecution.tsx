"use client";
import { useState } from "react";
import { createWalletClient, createPublicClient, custom, type Hex } from "viem";
import { mainnet } from "viem/chains";
import { injected, useWallet } from "@/components/wallet/WalletProvider";
import { eth } from "@/lib/quant/book";
import { SEAPORT } from "@/lib/web3/constants";
type Quote = {
  to: typeof SEAPORT;
  data: Hex;
  value: string;
  tokenId: string;
  expiresAt: number;
};
export function BuyExecution({
  hash,
  royalty,
}: {
  hash: string | null;
  royalty: boolean;
}) {
  const w = useWallet(),
    [quote, setQuote] = useState<Quote | null>(null),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  async function review() {
    setBusy(true);
    setQuote(null);
    try {
      if (!hash || !w.address)
        throw Error("Select an ask and connect your wallet.");
      const r = await fetch("/api/trading/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hash,
          address: w.address,
          includeRoyalty: royalty,
        }),
      });
      const q = await r.json();
      if (!r.ok) throw Error(q.error);
      setQuote(q);
      setStatus(
        "Fresh quote ready. Review the full purchase value before confirming.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Quote unavailable");
    } finally {
      setBusy(false);
    }
  }
  async function buy() {
    setBusy(true);
    try {
      const p = injected();
      if (!quote || !p || !w.address || Date.now() > quote.expiresAt)
        throw Error("Quote expired. Request a new quote.");
      const wallet = createWalletClient({
          chain: mainnet,
          transport: custom(p),
        }),
        publicClient = createPublicClient({
          chain: mainnet,
          transport: custom(p),
        });
      const accounts = await wallet.getAddresses();
      if (
        (await wallet.getChainId()) !== 1 ||
        accounts[0]?.toLowerCase() !== w.address.toLowerCase()
      )
        throw Error("Wallet changed. Review a fresh quote.");
      const tx = {
        account: w.address,
        to: quote.to,
        data: quote.data,
        value: BigInt(quote.value),
      };
      await publicClient.call(tx);
      const gas = await publicClient.estimateGas(tx);
      const txHash = await wallet.sendTransaction({ ...tx, gas });
      setStatus(`Transaction submitted: ${txHash}`);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      if (receipt.status !== "success")
        throw Error("Purchase transaction reverted");
      setStatus(`Purchase confirmed: ${txHash}`);
      setQuote(null);
      void w.refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        className="t-button t-primary"
        disabled={busy || !hash || w.chain !== 1}
        onClick={review}
      >
        {busy ? "Working…" : "Review purchase quote"}
      </button>
      {quote && (
        <div className="order-review">
          <h3>Buy NFT #{quote.tokenId}</h3>
          <p>Total including quoted fees: {eth(quote.value)} ETH</p>
          <p>
            Gas is additional and displayed in your wallet. Quote expires after
            45 seconds.
          </p>
          <button className="t-button t-primary" disabled={busy} onClick={buy}>
            Confirm purchase in wallet
          </button>
        </div>
      )}
      {status && (
        <p className="t-note" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
