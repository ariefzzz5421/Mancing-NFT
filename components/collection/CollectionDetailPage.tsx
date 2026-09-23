"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw, Star } from "lucide-react";
import { ActivityTable } from "@/components/collection/ActivityTable";
import { BidSupportCard } from "@/components/BidSupportCard";
import { CollectionSummary } from "@/components/CollectionSummary";
import { CreatorActivityCard } from "@/components/CreatorActivityCard";
import { EthUsdValue } from "@/components/EthUsdValue";
import { EthUsdConverter } from "@/components/EthUsdConverter";
import { ErrorState } from "@/components/ErrorState";
import { HolderAnalysisCard } from "@/components/HolderAnalysisCard";
import { HolderDistributionChart } from "@/components/HolderDistributionChart";
import { ListingDistributionChart } from "@/components/ListingDistributionChart";
import { LoadingState } from "@/components/LoadingState";
import { NetworkBadge } from "@/components/NetworkBadge";
import { RefreshRateControl } from "@/components/RefreshRateControl";
import { SweepCostChart } from "@/components/SweepCostChart";
import { SweepLadderTable } from "@/components/SweepLadderTable";
import { useLiveAssetPrice, useLiveEthPrice } from "@/components/useLiveEthPrice";
import { TrackedWalletsPanel } from "@/components/wallets/TrackedWalletsPanel";
import { formatDateTime, formatUsd } from "@/lib/format";
import {
  getWatchlistKey,
  type SupportedChain,
} from "@/lib/chains";
import {
  calculateSweepLadder,
  DEFAULT_TARGET_FLOORS,
  generateSmartTargets,
  sanitizeTargets,
} from "@/lib/sweep";
import type { ApiErrorResponse, SweepApiResponse, WalletApiResponse } from "@/lib/types";
import { getDefaultWatchlistItem, useWatchlist } from "@/lib/watchlist";

type CollectionDetailPageProps = {
  chain: SupportedChain;
  slug: string;
};

type TargetMode = "custom" | "range";

async function fetchSweep(slug: string, chain: SupportedChain) {
  const params = new URLSearchParams({ chain });
  const response = await fetch(`/api/sweep/${encodeURIComponent(slug)}?${params.toString()}`);
  const payload = (await response.json()) as SweepApiResponse | ApiErrorResponse;

  if (!response.ok) {
    throw new Error("error" in payload ? payload.error : "Failed to analyze collection.");
  }

  return payload as SweepApiResponse;
}

function parseTargetInput(value: string) {
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((target) => Number.isFinite(target) && target > 0);
}

function uniqueTargets(targets: number[]) {
  return [...new Set(targets)].sort((left, right) => left - right);
}

function isDefaultTargetSet(targets: number[]) {
  return (
    targets.length === DEFAULT_TARGET_FLOORS.length &&
    targets.every((target, index) => target === DEFAULT_TARGET_FLOORS[index])
  );
}

function buildRangeTargets(start: number, end: number, step: number) {
  const targets: number[] = [];

  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step <= 0) {
    return targets;
  }

  for (let target = start; target <= end + step / 1000; target += step) {
    targets.push(Number(target.toFixed(8)));

    if (targets.length > 50) {
      break;
    }
  }

  return targets;
}

const quickTargets = [0.1, 0.5, 1];

export function CollectionDetailPage({ chain, slug }: CollectionDetailPageProps) {
  const {
    addWallet,
    byKey,
    hydrated,
    removeItem,
    removeWallet,
    updateTargetFloors,
    upsertItem,
  } = useWatchlist();
  const watchlistItem = byKey.get(getWatchlistKey(slug, chain));
  const [data, setData] = useState<SweepApiResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [targetMode, setTargetMode] = useState<TargetMode>("custom");
  const [targetInput, setTargetInput] = useState("");
  const [targetError, setTargetError] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeStep, setRangeStep] = useState("");
  const [filterMin, setFilterMin] = useState("");
  const [filterMax, setFilterMax] = useState("");
  const [localTargets, setLocalTargets] = useState<number[]>([]);
  const [walletData, setWalletData] = useState<Record<string, WalletApiResponse | null>>({});
  const [refreshSeconds, setRefreshSeconds] = useState(60);
  const liveNativePrice = useLiveAssetPrice(
    data?.nativeCurrency.symbol ?? (chain === "ape_chain" ? "APE" : "ETH"),
    data?.nativeUsd,
  );
  const liveEthPrice = useLiveEthPrice();
  const activeNativeUsd = liveNativePrice.priceUsd ?? data?.nativeUsd ?? null;
  const nativeSymbol = data?.nativeCurrency.symbol ?? (chain === "ape_chain" ? "APE" : "ETH");

  const activeItem = watchlistItem ?? getDefaultWatchlistItem(slug, chain);
  const currentFloor = data?.collection.floor ?? null;
  const smartTargets = useMemo(
    () => generateSmartTargets(currentFloor ?? 0),
    [currentFloor],
  );
  const storedTargets =
    watchlistItem && !isDefaultTargetSet(activeItem.targetFloors) ? activeItem.targetFloors : [];
  const activeTargets = storedTargets.length ? storedTargets : localTargets.length ? localTargets : smartTargets;
  const filteredTargets = useMemo(() => {
    const min = filterMin.trim() ? Number(filterMin) : null;
    const max = filterMax.trim() ? Number(filterMax) : null;

    return sanitizeTargets(activeTargets, currentFloor).filter((target) => {
      if (min !== null && Number.isFinite(min) && target < min) {
        return false;
      }

      if (max !== null && Number.isFinite(max) && target > max) {
        return false;
      }

      return true;
    });
  }, [activeTargets, currentFloor, filterMax, filterMin]);
  const visibleTargets = sanitizeTargets(activeTargets, currentFloor);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetchSweep(slug, chain);
      setData(response);

      if (
        watchlistItem &&
        (watchlistItem.name !== response.collection.name ||
          watchlistItem.imageUrl !== response.collection.imageUrl)
      ) {
        upsertItem({
          ...watchlistItem,
          imageUrl: response.collection.imageUrl,
          name: response.collection.name,
        });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to analyze collection.");
    } finally {
      setLoading(false);
    }
  }, [chain, setData, setError, setLoading, slug, upsertItem, watchlistItem]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refresh]);

  useEffect(() => {
    if (refreshSeconds <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, refreshSeconds * 1000);

    return () => window.clearInterval(interval);
  }, [refresh, refreshSeconds]);

  const ladder = useMemo(() => {
    if (!data) {
      return [];
    }

    return calculateSweepLadder(data.listings, filteredTargets, activeNativeUsd ?? data.nativeUsd, currentFloor);
  }, [activeNativeUsd, currentFloor, data, filteredTargets]);

  const smartLadder = useMemo(() => {
    if (!data) {
      return [];
    }

    return calculateSweepLadder(data.listings, smartTargets, activeNativeUsd ?? data.nativeUsd, currentFloor);
  }, [activeNativeUsd, currentFloor, data, smartTargets]);

  const nextMeaningfulTarget = smartLadder[0] ?? null;

  const treasuryBalanceEth = useMemo(() => {
    const balances = Object.values(walletData)
      .map((wallet) => wallet?.balanceEth)
      .filter((balance): balance is number => typeof balance === "number" && Number.isFinite(balance));

    return balances.length > 0
      ? balances.reduce((total, balance) => total + balance, 0)
      : null;
  }, [walletData]);

  const primaryCoverage = useMemo(() => {
    const row = ladder.find((candidate) => candidate.costEth > 0);

    if (!row || treasuryBalanceEth === null) {
      return null;
    }

    return {
      coverage: treasuryBalanceEth / row.costEth,
      targetFloor: row.targetFloor,
    };
  }, [ladder, treasuryBalanceEth]);

  const handleWalletData = useCallback((address: string, wallet: WalletApiResponse | null) => {
    setWalletData((current) => ({ ...current, [address.toLowerCase()]: wallet }));
  }, [setWalletData]);

  function saveTargets(targets: number[]) {
    const nextTargets = sanitizeTargets(uniqueTargets(targets), currentFloor);

    if (nextTargets.length === 0) {
      setTargetError("Targets must be numbers greater than the current floor.");
      return false;
    }

    if (watchlistItem) {
      updateTargetFloors(slug, nextTargets, chain);
    } else {
      setLocalTargets(nextTargets);
    }

    setTargetError("");
    return true;
  }

  function addTargets(event: FormEvent) {
    event.preventDefault();
    const parsedTargets = parseTargetInput(targetInput);

    if (parsedTargets.length === 0) {
      setTargetError("Enter at least one numeric target.");
      return;
    }

    if (saveTargets([...activeTargets, ...parsedTargets])) {
      setTargetInput("");
    }
  }

  function applyRange(event: FormEvent) {
    event.preventDefault();
    const start = Number(rangeStart);
    const end = Number(rangeEnd);
    const step = Number(rangeStep);
    const rangeTargets = buildRangeTargets(start, end, step);

    if (rangeTargets.length === 0) {
      setTargetError("Range start, end, and step must be valid positive numbers.");
      return;
    }

    if (saveTargets(rangeTargets)) {
      setRangeStart("");
      setRangeEnd("");
      setRangeStep("");
    }
  }

  function resetToSmartTargets() {
    setTargetError("");

    if (watchlistItem) {
      updateTargetFloors(slug, DEFAULT_TARGET_FLOORS, chain);
    } else {
      setLocalTargets([]);
    }
  }

  function removeTarget(target: number) {
    const nextTargets = activeTargets.filter((candidate) => candidate !== target);

    if (watchlistItem) {
      updateTargetFloors(slug, nextTargets.length ? nextTargets : smartTargets, chain);
    } else {
      setLocalTargets(nextTargets);
    }
  }

  function toggleWatchlist() {
    if (watchlistItem) {
      removeItem(slug, chain);
      return;
    }

    upsertItem({
      chain,
      imageUrl: data?.collection.imageUrl,
      name: data?.collection.name,
      slug,
      targetFloors: activeTargets,
    });
  }

  return (
    <main className="app-main text-slate-100">
      <div className="app-frame collection-shell">
        <header className="collection-toolbar">
          <div className="collection-toolbar__topline">
            <div className="collection-toolbar__identity">
              <p><Link href="/">Dashboard</Link> / Collection</p>
              <div className="collection-toolbar__titleline">
                <h1>{data?.collection.name ?? activeItem.name ?? slug}</h1>
                <NetworkBadge chain={chain} />
              </div>
              <span>{slug}</span>
            </div>

            <div className="collection-toolbar__actions">
              <RefreshRateControl compact onChange={setRefreshSeconds} />
              <a
                className="button button--secondary"
                href={`https://opensea.io/collection/${slug}`}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink size={15} aria-hidden="true" />
                OpenSea
              </a>
              <button
                className="button button--secondary"
                onClick={refresh}
                type="button"
              >
                <RefreshCw size={15} aria-hidden="true" />
                Refresh
              </button>
              {hydrated ? (
                <button
                  className="button button--primary"
                  onClick={toggleWatchlist}
                  type="button"
                >
                  <Star size={15} fill={watchlistItem ? "currentColor" : "none"} aria-hidden="true" />
                  {watchlistItem ? "Watchlisted" : "Watch collection"}
                </button>
              ) : null}
            </div>
          </div>
          <div className="collection-toolbar__meta">
            <span>Last updated: {formatDateTime(data?.lastUpdated)}</span>
            {treasuryBalanceEth !== null ? (
              <span>
                Tracked balance:{" "}
                <EthUsdValue
                  ethUsd={activeNativeUsd}
                  label="Tracked balance"
                  symbol={nativeSymbol}
                  value={treasuryBalanceEth}
                />
              </span>
            ) : null}
          </div>
          <nav aria-label="Collection analysis" className="collection-tabs">
            <a className="collection-tabs__active" href="#depth">Depth</a>
            <a href="#holders">Holders</a>
            <a href="#activity">Activity</a>
            <a href="#wallets">Wallet tracking</a>
          </nav>
        </header>

        {error ? <ErrorState message={error} onRetry={refresh} /> : null}
        {loading ? <LoadingState /> : null}

        {data && !loading ? (
          <>
            <CollectionSummary
              chain={data.chain}
              collection={data.collection}
              ethUsd={activeNativeUsd}
              slug={data.slug}
              symbol={nativeSymbol}
            />

            <section className="execution-strip" aria-label="Next floor execution estimate">
              <div>
                <p>Current floor</p>
                <strong>
                  <EthUsdValue
                    ethUsd={activeNativeUsd}
                    label="Current floor"
                    showInlineUsd
                    symbol={nativeSymbol}
                    value={data.collection.floor}
                  />
                </strong>
              </div>
              <div>
                <p>Selected target</p>
                <strong>
                  <EthUsdValue
                    ethUsd={activeNativeUsd}
                    label="Selected target"
                    showInlineUsd
                    symbol={nativeSymbol}
                    value={nextMeaningfulTarget?.targetFloor ?? null}
                  />
                </strong>
              </div>
              <div>
                <p>NFTs below target</p>
                <strong>{nextMeaningfulTarget?.itemsToSweep ?? 0}</strong>
              </div>
              <div className="execution-strip__capital">
                <p>Capital required</p>
                <strong>
                  <EthUsdValue
                    ethUsd={activeNativeUsd}
                    label="Capital required"
                    showInlineUsd
                    symbol={nativeSymbol}
                    value={nextMeaningfulTarget?.costEth ?? null}
                  />
                </strong>
              </div>
            </section>

            <section className="sweep-workspace" id="depth">
              <div className="sweep-workspace__primary">
                <div className="mb-4 flex flex-col gap-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">Sweep Ladder</h2>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                        Sweep cost means the estimated total cost to buy every listed NFT below the selected target floor.
                      </p>
                    </div>
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-md border border-slate-700 px-3 text-sm text-slate-200 transition hover:border-cyan-400/50"
                      onClick={resetToSmartTargets}
                      type="button"
                    >
                      Reset smart targets
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="rounded-md border border-slate-800 bg-slate-950/70 p-3">
                      <div className="mb-3 flex flex-wrap gap-2">
                        <button
                          className={`rounded-md border px-3 py-1.5 text-sm transition ${
                            targetMode === "custom"
                              ? "border-cyan-300 bg-cyan-300 text-slate-950"
                              : "border-slate-700 text-slate-300 hover:border-cyan-400/50"
                          }`}
                          onClick={() => setTargetMode("custom")}
                          type="button"
                        >
                          Custom targets
                        </button>
                        <button
                          className={`rounded-md border px-3 py-1.5 text-sm transition ${
                            targetMode === "range"
                              ? "border-cyan-300 bg-cyan-300 text-slate-950"
                              : "border-slate-700 text-slate-300 hover:border-cyan-400/50"
                          }`}
                          onClick={() => setTargetMode("range")}
                          type="button"
                        >
                          Range builder
                        </button>
                      </div>

                      {targetMode === "custom" ? (
                        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={addTargets}>
                          <input
                            className="h-10 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
                            inputMode="decimal"
                            onChange={(event) => setTargetInput(event.target.value)}
                            placeholder="0.002, 0.003, 0.1, 0.5, 1"
                            value={targetInput}
                          />
                          <button
                            className="inline-flex h-10 items-center justify-center rounded-md border border-cyan-400/30 px-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300"
                            type="submit"
                          >
                            Add targets
                          </button>
                        </form>
                      ) : (
                        <form className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={applyRange}>
                          <input
                            className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
                            inputMode="decimal"
                            onChange={(event) => setRangeStart(event.target.value)}
                            placeholder="Start"
                            value={rangeStart}
                          />
                          <input
                            className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
                            inputMode="decimal"
                            onChange={(event) => setRangeEnd(event.target.value)}
                            placeholder="End"
                            value={rangeEnd}
                          />
                          <input
                            className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
                            inputMode="decimal"
                            onChange={(event) => setRangeStep(event.target.value)}
                            placeholder="Step"
                            value={rangeStep}
                          />
                          <button
                            className="inline-flex h-10 items-center justify-center rounded-md border border-cyan-400/30 px-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300"
                            type="submit"
                          >
                            Apply range
                          </button>
                        </form>
                      )}

                      {targetError ? (
                        <p className="mt-2 text-sm text-red-200">{targetError}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          Quick target
                        </span>
                        {quickTargets.map((target) => (
                          <button
                            className="rounded-md border border-slate-700 px-3 py-1.5 font-mono text-xs text-slate-200 transition hover:border-cyan-400/50 hover:text-cyan-100"
                            key={target}
                            onClick={() => saveTargets([...activeTargets, target])}
                            type="button"
                          >
                            {target} {nativeSymbol}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="target-capital-panel">
                      <p>Capital required</p>
                      {nextMeaningfulTarget ? (
                        <div>
                          <p className="target-capital-panel__floor">
                            <EthUsdValue
                              ethUsd={activeNativeUsd}
                              label="Next target floor"
                              showInlineUsd
                              symbol={nativeSymbol}
                              value={nextMeaningfulTarget.targetFloor}
                            />
                          </p>
                          <p className="target-capital-panel__cost">
                            <EthUsdValue
                              ethUsd={activeNativeUsd}
                              label="Next target cost"
                              symbol={nativeSymbol}
                              value={nextMeaningfulTarget.costEth}
                            />
                          </p>
                          <p className="target-capital-panel__usd">{formatUsd(nextMeaningfulTarget.costUsd)}</p>
                          <p className="target-capital-panel__items">Buy {nextMeaningfulTarget.itemsToSweep} listed NFTs</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-400">No higher target selected.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {visibleTargets.length ? (
                      visibleTargets.map((target) => (
                        <button
                          className="rounded-md border border-slate-700 bg-slate-900/80 px-3 py-1.5 font-mono text-xs text-slate-200 transition hover:border-red-300/50 hover:text-red-100"
                          key={target}
                          onClick={() => removeTarget(target)}
                          type="button"
                        >
                          <EthUsdValue ethUsd={activeNativeUsd} label="Target floor" showInlineUsd symbol={nativeSymbol} value={target} />
                        </button>
                      ))
                    ) : (
                      <span className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-400">
                        Smart targets active
                      </span>
                    )}
                  </div>
                  <div className="grid gap-3 rounded-md border border-slate-800 bg-slate-950/70 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="text-sm text-slate-300">
                      Filter min target floor
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
                        inputMode="decimal"
                        onChange={(event) => setFilterMin(event.target.value)}
                        placeholder="0.001"
                        value={filterMin}
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      Filter max target floor
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
                        inputMode="decimal"
                        onChange={(event) => setFilterMax(event.target.value)}
                        placeholder="0.05"
                        value={filterMax}
                      />
                    </label>
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-md border border-slate-700 px-3 text-sm text-slate-200 transition hover:border-cyan-400/50"
                      onClick={() => {
                        setFilterMin("");
                        setFilterMax("");
                      }}
                      type="button"
                    >
                      Clear filter
                    </button>
                  </div>
                </div>
                {primaryCoverage ? (
                  <p className="mt-3 rounded-md border border-emerald-400/20 bg-emerald-400/8 px-3 py-2 text-sm text-emerald-100">
                    Tracked wallet balance can cover{" "}
                    {Math.round(primaryCoverage.coverage * 100)}% of cost to{" "}
                    <EthUsdValue
                      ethUsd={activeNativeUsd}
                      label="Coverage target floor"
                      showInlineUsd
                      symbol={nativeSymbol}
                      value={primaryCoverage.targetFloor}
                    />
                    .
                  </p>
                ) : null}
                {ladder.length > 0 ? (
                  <SweepLadderTable
                    ethUsd={activeNativeUsd}
                    ladder={ladder}
                    symbol={nativeSymbol}
                    treasuryBalanceEth={treasuryBalanceEth}
                  />
                ) : (
                  <div className="rounded-md border border-dashed border-slate-700 p-5 text-sm text-slate-400">
                    No higher target selected.
                  </div>
                )}
              </div>

              <BidSupportCard collection={data.collection} ethUsd={activeNativeUsd} risk={data.risk} symbol={nativeSymbol} />
            </section>

            <section className="market-structure" id="holders">
              <header className="market-structure__header">
                <div>
                  <p className="terminal-kicker">Collection structure</p>
                  <h2>Ownership and sell-side liquidity</h2>
                </div>
                <p>Holder concentration and active listing prices for this collection.</p>
              </header>
              <div className="chart-pair">
                <HolderDistributionChart data={data.holderAnalysis} />
                <ListingDistributionChart data={data.listingDistribution} symbol={nativeSymbol} />
              </div>
            </section>

            <HolderAnalysisCard data={data} />

            <section className="depth-cost-chart">
              <SweepCostChart data={ladder} symbol={nativeSymbol} />
            </section>

            <div id="activity"><CreatorActivityCard data={data} ethUsd={activeNativeUsd} /></div>

            <ActivityTable chain={chain} slug={slug} />

            <div id="wallets">
              <TrackedWalletsPanel
                addWallet={(wallet) => {
                if (!watchlistItem) {
                  upsertItem({
                    chain,
                    imageUrl: data.collection.imageUrl,
                    name: data.collection.name,
                    slug,
                    targetFloors: activeTargets,
                  });
                }
                addWallet(slug, wallet, chain);
              }}
                chain={chain}
                ethUsd={activeNativeUsd ?? data.nativeUsd}
                onWalletData={handleWalletData}
                removeWallet={(address) => removeWallet(slug, address, chain)}
                wallets={activeItem.devWallets}
              />
            </div>

            <EthUsdConverter
              ethUsd={liveEthPrice.priceUsd}
              lastUpdated={liveEthPrice.lastUpdated ?? data.lastUpdated}
              source={liveEthPrice.source}
            />
          </>
        ) : null}

        <div className="pb-4 text-center text-xs text-slate-500">
          <Link className="text-cyan-200 hover:text-cyan-100" href="/">
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
