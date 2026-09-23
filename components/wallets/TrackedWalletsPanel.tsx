"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatAddress, formatDateTime, formatNative, formatUsd } from "@/lib/format";
import {
  getAddressExplorerUrl,
  getChainConfig,
  type SupportedChain,
} from "@/lib/chains";
import type { ApiErrorResponse, TrackedWallet, WalletApiResponse } from "@/lib/types";

type TrackedWalletsPanelProps = {
  addWallet: (wallet: TrackedWallet) => void;
  chain: SupportedChain;
  ethUsd?: number;
  onWalletData?: (address: string, wallet: WalletApiResponse | null) => void;
  removeWallet: (address: string) => void;
  wallets: TrackedWallet[];
};

async function fetchWallet(address: string, chain: SupportedChain) {
  const params = new URLSearchParams({ chain });
  const response = await fetch(`/api/wallet/${encodeURIComponent(address)}?${params.toString()}`);
  const payload = (await response.json()) as WalletApiResponse | ApiErrorResponse;

  if (!response.ok) {
    throw new Error("error" in payload ? payload.error : "Failed to load wallet.");
  }

  return payload as WalletApiResponse;
}

function normalizeAddress(address: string) {
  return address.trim();
}

function WalletCard({
  onData,
  onRemove,
  chain,
  wallet,
}: {
  onData?: (address: string, wallet: WalletApiResponse | null) => void;
  onRemove: (address: string) => void;
  chain: SupportedChain;
  wallet: TrackedWallet;
}) {
  const [data, setData] = useState<WalletApiResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const target = cardRef.current;
    if (!target) return;
    if (!("IntersectionObserver" in window)) { queueMicrotask(() => setVisible(true)); return; }
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "200px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    void Promise.resolve()
      .then(async () => {
        setLoading(true);
        setError("");
        return fetchWallet(wallet.address, chain);
      })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setData(response);
        onData?.(wallet.address, response);
      })
      .catch((cause) => {
        if (cancelled) {
          return;
        }

        setData(null);
        onData?.(wallet.address, null);
        setError(cause instanceof Error ? cause.message : "Failed to load wallet.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chain, onData, visible, wallet.address]);

  const chainConfig = getChainConfig(chain);

  return (
    <article className="wallet-ledger__row" ref={cardRef}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-white">{wallet.label}</h3>
          <p className="mt-1 font-mono text-sm text-cyan-200">{formatAddress(wallet.address)}</p>
          {wallet.notes ? <p className="mt-2 text-sm text-slate-400">{wallet.notes}</p> : null}
        </div>
        <button
          className="icon-button icon-button--danger"
          onClick={() => onRemove(wallet.address)}
          type="button"
        >
          <Trash2 size={15} aria-hidden="true" />
          <span className="sr-only">Remove wallet</span>
        </button>
      </div>

      {loading && visible ? (
        <div className="mt-4 grid gap-2">
          <div className="h-4 w-2/3 rounded bg-slate-800" />
          <div className="h-4 w-1/2 rounded bg-slate-800" />
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-md border border-amber-400/20 bg-amber-400/8 p-3 text-sm text-amber-100">
          {error === "Missing ETHERSCAN_API_KEY"
            ? "Add ETHERSCAN_API_KEY to enable wallet tracking."
            : error}
        </div>
      ) : null}

      {data ? (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{data.currencySymbol} balance</p>
            <p className="mt-1 font-mono text-slate-100">{formatNative(data.balanceEth, data.currencySymbol)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">USD balance</p>
            <p className="mt-1 font-mono text-slate-100">{formatUsd(data.balanceUsd)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Recent tx count</p>
            <p className="mt-1 font-mono text-slate-100">{data.txCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Net {data.currencySymbol} flow</p>
            <p className="mt-1 font-mono text-slate-100">{formatNative(data.netEthFlow, data.currencySymbol)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Last transaction</p>
            <p className="mt-1 font-mono text-slate-100">{formatDateTime(data.lastTxAt)}</p>
          </div>
        </div>
      ) : null}

      <a
        className="button button--secondary mt-4"
        href={getAddressExplorerUrl(chain, wallet.address)}
        rel="noreferrer"
        target="_blank"
      >
        <ExternalLink size={14} aria-hidden="true" />
        Open {chainConfig.explorerName}
      </a>
      <Link className="button button--secondary mt-2" href={`/wallets/${encodeURIComponent(wallet.address)}?chain=${chain}`}>
        View NFT activity feed
      </Link>
    </article>
  );
}

export function TrackedWalletsPanel({
  addWallet,
  chain,
  onWalletData,
  removeWallet,
  wallets,
}: TrackedWalletsPanelProps) {
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanAddress = normalizeAddress(address);
    const cleanLabel = label.trim();

    if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
      setFormError("Enter a valid EVM wallet address.");
      return;
    }

    if (!cleanLabel) {
      setFormError("Add a wallet label.");
      return;
    }

    addWallet({
      address: cleanAddress,
      label: cleanLabel,
      notes: notes.trim() || undefined,
    });
    setAddress("");
    setLabel("");
    setNotes("");
    setFormError("");
  }

  return (
    <section className="tracked-wallets">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">Tracked wallets</h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Tracked wallet balance does not prove intent to sweep. It only shows capacity.
        </p>
      </div>

      <form className="tracked-wallets__form" onSubmit={handleSubmit}>
        <input
          className="field field--mono"
          onChange={(event) => setAddress(event.target.value)}
          placeholder="0x wallet address"
          value={address}
        />
        <input
          className="field"
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Creator wallet"
          value={label}
        />
        <input
          className="field"
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes"
          value={notes}
        />
        <button
          className="button button--primary"
          type="submit"
        >
          <Plus size={15} aria-hidden="true" />
          Add
        </button>
      </form>

      {formError ? <p className="mt-2 text-sm text-red-200">{formError}</p> : null}

      {wallets.length === 0 ? (
        <div className="empty-state empty-state--compact">
          Add labels like Creator wallet, Mint receiver, Deployer, Treasury, or Sweeper wallet.
        </div>
      ) : (
        <div className="wallet-ledger">
          {wallets.map((wallet) => (
            <WalletCard
              key={wallet.address}
              chain={chain}
              onData={onWalletData}
              onRemove={removeWallet}
              wallet={wallet}
            />
          ))}
        </div>
      )}
    </section>
  );
}
