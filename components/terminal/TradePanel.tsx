"use client";
import { useState, useEffect } from "react";
import { BuyExecution } from "./BuyExecution";
import { FlipOfferStatus } from "./FlipOfferStatus";
import type { Collection, Book } from "@/types/market";
import { eth, wei, edge, spread } from "@/lib/quant/book";
import {
  useWallet,
  injected,
  WalletConnect,
} from "@/components/wallet/WalletProvider";
import type {
  CreateOrderAction,
  OrderUseCase,
} from "@opensea/seaport-js/lib/types";
type NFT = {
  tokenId: string;
  contract: string;
  name: string;
  standard: string;
};
export type TradeMode = "BUY" | "OFFER" | "LIST" | "FLIP";
export function TradePanel({
  collection,
  slug,
  entry,
  exit,
  setEntry,
  setExit,
  quantity,
  setQuantity,
  mode,
  setMode,
  book,
  selectedOrder,
  ethUsd,
}: {
  collection: Collection | null;
  slug: string;
  entry: string;
  exit: string;
  setEntry: (s: string) => void;
  setExit: (s: string) => void;
  quantity: number;
  setQuantity: (n: number) => void;
  mode: TradeMode;
  setMode: (s: TradeMode) => void;
  book: Book | null;
  selectedOrder: string | null;
  ethUsd: number | null;
}) {
  const wallet = useWallet(),
    [hours, setHours] = useState(24),
    [royalty, setRoyalty] = useState(true),
    [flipStrategy, setFlipStrategy] = useState<"MATCH" | "TICK" | "CUSTOM">("MATCH"),
    [nfts, setNfts] = useState<NFT[]>([]),
    [nftCursor, setNftCursor] = useState<string | null>(null),
    [token, setToken] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [prepared, setPrepared] = useState<{
      useCase: OrderUseCase<CreateOrderAction>;
      criteria: unknown;
      account: string;
      fingerprint: string;
      createdAt: number;
      fees: { basisPoints: number; recipient: string }[];
    } | null>(null);
  useEffect(() => {
    queueMicrotask(() => setPrepared(null));
  }, [
    entry,
    exit,
    quantity,
    mode,
    hours,
    royalty,
    token,
    wallet.address,
    wallet.chain,
  ]);
  useEffect(() => {
    if (!wallet.address || mode !== "LIST") return;
    const controller = new AbortController();
    fetch(
      `/api/account/${wallet.address}?kind=nfts&collection=${encodeURIComponent(slug)}`,
      {
        signal: controller.signal,
      },
    )
      .then((r) => r.json())
      .then((d) => {
        setNftCursor(d.next ?? null);
        if (d.error) setStatus(d.error);
        else
          setNfts(
            d.rows.filter(
              (n: NFT) =>
                n.contract.toLowerCase() ===
                  collection?.contract?.toLowerCase() &&
                n.standard === "erc721",
            ),
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [wallet.address, mode, collection?.contract, slug]);
  async function moreNFTs() {
    if (!nftCursor || !wallet.address) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/account/${wallet.address}?kind=nfts&collection=${encodeURIComponent(slug)}&cursor=${encodeURIComponent(nftCursor)}`,
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setNfts((n) => [
        ...n,
        ...d.rows.filter(
          (x: NFT) =>
            x.standard === "erc721" &&
            x.contract.toLowerCase() === collection?.contract?.toLowerCase(),
        ),
      ]);
      setNftCursor(d.next ?? null);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "NFT loading failed");
    } finally {
      setBusy(false);
    }
  }
  const p = wei(mode === "LIST" ? exit : entry),
    total =
      p && Number.isSafeInteger(quantity) && quantity > 0
        ? p * BigInt(mode === "LIST" ? 1 : quantity)
        : null;
  const totalUsd = total && ethUsd ? (Number(total) / 1e18) * ethUsd : null;
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("mancing-preferences") ?? "{}");
      if ([6, 12, 24, 72, 168].includes(Number(p.expiration)))
        queueMicrotask(() => setHours(Number(p.expiration)));
    } catch {}
  }, []);
  const fingerprint = JSON.stringify({
    entry,
    exit,
    quantity,
    mode,
    hours,
    royalty,
    token,
    address: wallet.address,
    chain: wallet.chain,
  });
  async function prepare() {
    setBusy(true);
    setStatus("");
    setPrepared(null);
    try {
      if (!wallet.address || !injected())
        throw Error("Connect a wallet first.");
      if (wallet.chain !== 1)
        throw Error("Switch your wallet to Ethereum mainnet.");
      if (!total) throw Error("Enter a valid price and quantity.");
      if (
        (mode === "OFFER" || mode === "FLIP") &&
        (wallet.weth === null || (wei(wallet.weth) ?? 0n) < total)
      )
        throw Error(
          "Insufficient WETH or balance unavailable. Wrap ETH in your wallet first.",
        );
      const r = await fetch("/api/trading/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: wallet.address,
          slug,
          mode: mode === "FLIP" ? "OFFER" : mode,
          price: mode === "LIST" ? exit : entry,
          quantity: mode === "LIST" ? 1 : quantity,
          hours,
          includeRoyalty: royalty,
          tokenId: token,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      const { prepareWalletOrder } = await import("@/lib/web3/trade");
      const useCase = await prepareWalletOrder(
        injected()!,
        d.input,
        wallet.address,
      );
      setPrepared({
        useCase,
        criteria: d.criteria,
        account: wallet.address,
        fingerprint,
        createdAt: Date.now(),
        fees: d.fees,
      });
      setStatus(
        "Order prepared. Review fees and approvals below before signing.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Order preparation failed");
    } finally {
      setBusy(false);
    }
  }
  async function sign() {
    if (!prepared) return;
    if (
      prepared.fingerprint !== fingerprint ||
      Date.now() - prepared.createdAt > 60000
    ) {
      setPrepared(null);
      setStatus("Order review changed or expired. Prepare again.");
      return;
    }
    setBusy(true);
    try {
      const provider = injected();
      if (!provider || wallet.address !== prepared.account)
        throw Error("Wallet changed. Prepare again.");
      const accounts = await provider.request({ method: "eth_accounts" });
      const chain = await provider.request({ method: "eth_chainId" });
      if (
        accounts[0]?.toLowerCase() !== prepared.account.toLowerCase() ||
        Number(chain) !== 1
      )
        throw Error("Wallet account or network changed. Prepare again.");
      const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
      const session = await sessionResponse.json();
      if (session.address?.toLowerCase() !== prepared.account.toLowerCase()) {
        setStatus("Sign in with this wallet to store and submit your order.");
        await wallet.signIn();
      }
      setStatus(
        "Confirm required approvals and the order signature in your wallet.",
      );
      const order = await prepared.useCase.executeAllActions();
      setStatus("Submitting signed order to OpenSea…");
      const r = await fetch("/api/trading/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          { mode: mode === "FLIP" ? "OFFER" : mode, slug, order, criteria: prepared.criteria },
          (_, v) => (typeof v === "bigint" ? v.toString() : v),
        ),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      let backupSaved = false;
      if (d.order_hash && wallet.address) {
        try {
          const { saveOrder } = await import("@/lib/web3/order-history");
          saveOrder(wallet.address, {
            hash: d.order_hash,
            collection: slug,
            side: mode === "FLIP" ? "OFFER" : mode,
            price: mode === "LIST" ? exit : entry,
            quantity: mode === "LIST" ? 1 : quantity,
            created: Date.now(),
            expiration: Number(order.parameters.endTime) * 1000,
            status: "ACTIVE",
          });
          backupSaved = true;
        } catch { /* The OpenSea submission already succeeded; report storage separately. */ }
      }
      setStatus(`Order submitted: ${d.order_hash ?? "Accepted by OpenSea"}${d.historySaved === false ? backupSaved ? ". Cloud history unavailable; browser backup saved." : ". History could not be saved; copy the order hash." : ""}`);
      setPrepared(null);
      void wallet.refresh();
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : "Signing or submission failed",
      );
    } finally {
      setBusy(false);
    }
  }
  const bestBid = book?.bids[0]?.priceWei;
  const bestAsk = book?.asks[0]?.priceWei;
  const flipGross = spread(bestBid, bestAsk);
  const flipEntry = wei(entry);
  const flipExit = wei(exit);
  const feeBps = collection?.fees.filter((fee) => fee.required).reduce((sum, fee) => sum + fee.bps, 0) ?? 0;
  const royaltyBps = royalty ? collection?.fees.filter((fee) => !fee.required).reduce((sum, fee) => sum + fee.bps, 0) ?? 0 : 0;
  const flipEdge = flipEntry && flipExit ? edge(flipEntry, flipExit, 1, feeBps, royaltyBps, 500000000000000n, 50) : null;
  function chooseStrategy(strategy: typeof flipStrategy) {
    setFlipStrategy(strategy);
    if (!bestBid || strategy === "CUSTOM") return;
    setEntry(eth(BigInt(bestBid) + (strategy === "TICK" ? 100000000000000n : 0n)));
  }
  return (
    <section className="t-panel trade-panel">
      <div className="panel-title">
        <span>03 / EXECUTION</span>
        <span>NON-CUSTODIAL</span>
      </div>
      <div className="trade-tabs">
        {(["BUY", "OFFER", "LIST", "FLIP"] as const).map((t) => (
          <button key={t} aria-pressed={mode === t} onClick={() => { if (t === "FLIP") { setQuantity(1); if (bestBid && flipStrategy === "MATCH") setEntry(eth(bestBid)); } setMode(t); }}>
            {t === "FLIP" ? "FLIP FLOP" : t}
          </button>
        ))}
      </div>
      <div className="trade-body">
        <h2>
          {mode === "FLIP"
            ? "Flip Flop · offer to inventory"
            : mode === "OFFER"
            ? "Place collection offer"
            : mode === "LIST"
              ? "List your NFT"
              : "Buy / list comparison"}
        </h2>
        <p className="t-muted">{collection?.name ?? slug}</p>
        {mode === "FLIP" && <div className="flip-workflow">
          <div className="flip-workflow__steps">OFFER <span>→</span> FILL <span>→</span> VERIFY NFT <span>→</span> LIST <span>→</span> EXIT</div>
          <div className="flip-strategies" role="group" aria-label="Offer pricing strategy">
            {(["MATCH", "TICK", "CUSTOM"] as const).map((strategy) => <button key={strategy} type="button" aria-pressed={flipStrategy === strategy} onClick={() => chooseStrategy(strategy)}>{strategy === "MATCH" ? "Match best bid" : strategy === "TICK" ? "Bid + 0.0001 Ξ" : "Custom bid"}</button>)}
          </div>
          <dl className="metric-list flip-metrics">
            <div><dt>Best bid</dt><dd>{eth(bestBid)} WETH</dd></div>
            <div><dt>Current ask</dt><dd>{eth(bestAsk)} ETH</dd></div>
            <div><dt>Gross spread</dt><dd>{flipGross ? `${eth(flipGross.absolute)} ETH · ${(flipGross.bps / 100).toFixed(2)}%` : "—"}</dd></div>
            <div><dt>Marketplace fee</dt><dd>{flipEdge ? `−${eth(flipEdge.fees)} ETH` : "—"}</dd></div>
            <div><dt>Creator royalty</dt><dd>{flipEdge ? `−${eth(flipEdge.royalty)} ETH` : "—"}</dd></div>
            <div><dt>Gas + slippage assumption</dt><dd>{flipEdge ? `−${eth(500000000000000n + flipEdge.slippage)} ETH` : "—"}</dd></div>
          </dl>
          <div className="flip-result"><span>ESTIMATED NET</span><strong className={flipEdge && flipEdge.net >= 0n ? "positive" : "negative"}>{flipEdge ? `${eth(flipEdge.net)} ETH` : "—"}</strong><span>ROI {flipEdge ? `${(flipEdge.roiBps / 100).toFixed(2)}%` : "—"}</span></div>
          <p className="t-note">Estimate for one NFT using collection fees, 0.0005 ETH gas and 0.5% slippage. A listing is not a guaranteed exit. Fills and token ownership must be verified before listing.</p>
        </div>}
        {mode === "FLIP" && <FlipOfferStatus slug={slug} collection={collection} bestAsk={bestAsk} onList={(tokenId, listPrice) => { setToken(tokenId); setExit(listPrice); setMode("LIST"); }} />}
        {mode === "LIST" && (
          <label className="t-field">
            Owned NFT (paginated collection assets)
            <select value={token} onChange={(e) => setToken(e.target.value)}>
              <option value="">Select owned ERC-721</option>
              {token && !nfts.some((n) => n.tokenId === token) && <option value={token}>NFT #{token} · verified fill (check wallet ownership)</option>}
              {nfts.map((n) => (
                <option key={n.tokenId} value={n.tokenId}>
                  {n.name} / #{n.tokenId}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === "LIST" && nftCursor && (
          <button className="t-button" disabled={busy} onClick={moreNFTs}>
            Load more owned NFTs
          </button>
        )}
        <label className="t-field">
          {mode === "LIST"
            ? "Listing price / ETH"
            : mode === "OFFER" || mode === "FLIP"
              ? "Offer price / WETH"
              : "Buy price / ETH"}
          <input
            inputMode="decimal"
            value={mode === "LIST" ? exit : entry}
            onChange={(e) => {
              if (mode === "FLIP") setFlipStrategy("CUSTOM");
              (mode === "LIST" ? setExit : setEntry)(e.target.value);
            }}
            placeholder="0.013"
          />
        </label>
        {mode !== "LIST" && (
          <div className="trade-input-row">
            <label className="t-field">
              Quantity
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={quantity}
                disabled={mode === "FLIP"}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
            <label className="t-field">
              Expected exit / ETH
              <input
                inputMode="decimal"
                value={exit}
                onChange={(e) => setExit(e.target.value)}
                placeholder="0.0145"
              />
            </label>
          </div>
        )}
        <label className="t-field">
          Expiration
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            {[6, 12, 24, 72, 168].map((h) => (
              <option value={h} key={h}>
                {h < 48 ? `${h} Hours` : `${h / 24} Days`}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={royalty}
            onChange={(e) => setRoyalty(e.target.checked)}
          />
          Include optional creator royalties
        </label>
        <dl className="metric-list">
          <div>
            <dt>Wallet ETH</dt>
            <dd>{wallet.eth ?? "—"}</dd>
          </div>
          <div>
            <dt>Wallet WETH</dt>
            <dd>{wallet.weth ?? "—"}</dd>
          </div>
          <div>
            <dt>Estimated total</dt>
            <dd>{eth(total)} {mode === "OFFER" || mode === "FLIP" ? "WETH" : "ETH"}<small className="execution-usd">{totalUsd === null ? "USD —" : `≈ $${totalUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}</small></dd>
          </div>
          <div>
            <dt>Gas</dt>
            <dd>Quoted by wallet</dd>
          </div>
        </dl>
        {!wallet.address ? (
          <WalletConnect />
        ) : mode === "BUY" ? (
          <>
            <p className="t-note">
              {selectedOrder
                ? `Selected ${selectedOrder.slice(0, 12)}…`
                : `Select an ask to compare its buy price with your resale target.`}{" "}
              Buy execution requires an up-to-date fulfillment quote.
            </p>
            <BuyExecution
              key={`${selectedOrder}:${wallet.address}:${wallet.chain}:${royalty}`}
              hash={selectedOrder}
              royalty={royalty}
              contract={collection?.contract ?? null}
            />
          </>
        ) : (
          <button
            className="t-button t-primary"
            disabled={
              busy ||
              wallet.chain !== 1 ||
              collection?.chain !== "ethereum" ||
              (mode === "LIST" && !token) ||
              !book ||
              book.errors.length > 0
            }
            onClick={prepare}
          >
            {busy
              ? "Preparing…"
              : mode === "OFFER" || mode === "FLIP"
                ? "Review offer · wallet signature required"
                : "Review listing"}
          </button>
        )}
        {wallet.chain && wallet.chain !== 1 && (
          <p className="t-error">Switch wallet to Ethereum mainnet.</p>
        )}
        {wallet.error && (
          <p className="t-error" role="alert">
            {wallet.error}
          </p>
        )}
        {book?.errors.length !== 0 && (
          <p className="t-note">
            Trading requires operational market data and a fresh order review.
          </p>
        )}
        {prepared && prepared.fingerprint === fingerprint && (
          <div className="order-review">
            <h3>Review before signing</h3>
            <p>
              Price: {mode === "LIST" ? exit : entry} · Quantity:{" "}
              {mode === "LIST" ? 1 : quantity}
            </p>
            {prepared.fees.map((f) => (
              <p key={f.recipient}>
                Fee {f.basisPoints / 100}% → {f.recipient.slice(0, 10)}…
              </p>
            ))}
            <p>
              Estimated proceeds:{" "}
              {mode === "LIST" && total
                ? eth(
                    total -
                      (total *
                        BigInt(
                          prepared.fees.reduce((s, f) => s + f.basisPoints, 0),
                        )) /
                        10000n,
                  )
                : "Offer capital committed until filled, cancelled or expired"}
            </p>
            <p>
              {
                prepared.useCase.actions.filter((a) => a.type === "approval")
                  .length
              }{" "}
              approval transaction(s) required. Wallet shows gas before each
              transaction.
            </p>
            <button
              className="t-button t-primary"
              disabled={busy}
              onClick={sign}
            >
              {busy ? "Waiting for wallet…" : "Approve & sign order"}
            </button>
          </div>
        )}
        {status && (
          <p role="status" className="t-note">
            {status}
          </p>
        )}
        <p className="t-note">
          You control your wallet. No private keys are requested or stored. An
          offer signature can create a binding order.
        </p>
      </div>
    </section>
  );
}
