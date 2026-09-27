"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Sale = { id: string; timestamp: number; priceUnits: string; decimals: number; symbol: string; tokenId: string | null };
type SalesResponse = { sales: Sale[]; sampled: number; hasMore: boolean; updatedAt: string };

const formatPrice = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 0.001 ? 7 : 5 }).format(value);

export function CollectionSalesAnalytics({ slug, chain, reportedSales, floor, floorSymbol }: { slug: string; chain: string; reportedSales: number | null; floor?: number | null; floorSymbol?: string | null }) {
  const [data, setData] = useState<SalesResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [symbol, setSymbol] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/collections/${encodeURIComponent(slug)}/sales-analytics?chain=${encodeURIComponent(chain)}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw Error(payload.error ?? "Sale data unavailable.");
        if (!controller.signal.aborted) { setData(payload); setError(""); }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Sale data unavailable."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [slug, chain, revision]);
  const symbols = useMemo(() => [...new Set(data?.sales.map((sale) => sale.symbol) ?? [])].sort((a, b) => (data?.sales.filter((sale) => sale.symbol === b).length ?? 0) - (data?.sales.filter((sale) => sale.symbol === a).length ?? 0)), [data]);
  const selectedSymbol = symbols.includes(symbol) ? symbol : symbols[0];
  const observedAt = data ? Date.parse(data.updatedAt) : 0;
  const sample = useMemo(() => (data?.sales ?? []).filter((sale) => sale.symbol === selectedSymbol && sale.timestamp * 1000 >= observedAt - 86_400_000).sort((a, b) => b.timestamp - a.timestamp), [data, selectedSymbol, observedAt]);
  const prices = sample.map((sale) => Number(formatUnits(BigInt(sale.priceUnits), sale.decimals))).filter(Number.isFinite).sort((a, b) => a - b);
  const average = prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : null;
  const comparableFloor = floor != null && floor > 0 && floorSymbol?.toUpperCase() === selectedSymbol?.toUpperCase() ? floor : null;
  const nearFloor = comparableFloor == null ? null : prices.filter((price) => price >= comparableFloor * 0.98 && price <= comparableFloor * 1.02).length;
  const chartPoints = [...sample].reverse().map((sale) => ({ time: sale.timestamp * 1000, price: Number(formatUnits(BigInt(sale.priceUnits), sale.decimals)), tokenId: sale.tokenId }));
  const median = prices.length ? (prices[Math.floor((prices.length - 1) / 2)] + prices[Math.floor(prices.length / 2)]) / 2 : null;
  return <section className="t-panel sales-analytics" aria-label="Collection sales analytics">
    <div className="panel-title"><span>03 / SALES ANALYTICS</span><button type="button" onClick={() => setRevision((value) => value + 1)} disabled={loading}>{loading ? "Updating…" : "Refresh"}</button></div>
    <div className="sales-analytics__intro"><strong>Last 24 hours</strong><span>OpenSea reports {reportedSales == null ? "—" : reportedSales.toLocaleString("en-US")} collection sales</span></div>
    {error && <p className="t-error" role="alert">{error} <button type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button></p>}
    {!data && loading && <p className="t-note" role="status">Loading recent sale events…</p>}
    {data && <>
      {symbols.length > 1 && <label className="sales-analytics__currency">Sale currency <select value={selectedSymbol} onChange={(event) => setSymbol(event.target.value)}>{symbols.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>}
      <div className="sales-analytics__stats"><div><small>IN SAMPLE · 24H</small><strong>{sample.length}</strong></div><div><small>AVG SALE</small><strong>{average == null ? "—" : `${formatPrice(average)} ${selectedSymbol}`}</strong></div><div><small>MEDIAN SALE</small><strong>{median == null ? "—" : `${formatPrice(median)} ${selectedSymbol}`}</strong></div><div><small>SALES NEAR FLOOR ±2%</small><strong>{nearFloor == null ? "—" : `${nearFloor} / ${sample.length}`}</strong></div><div><small>LOW / HIGH</small><strong>{prices.length ? `${formatPrice(prices[0])} / ${formatPrice(prices[prices.length - 1])}` : "—"}</strong></div><div><small>LATEST SALE</small><strong>{sample[0] ? `${formatPrice(Number(formatUnits(BigInt(sample[0].priceUnits), sample[0].decimals)))} ${selectedSymbol}` : "—"}</strong></div></div>
      <div className="sales-analytics__chart" role="img" aria-label={`Interactive sale price line chart for ${selectedSymbol || "selected currency"}; ${chartPoints.length} sampled sales in the last 24 hours`}>
        {chartPoints.length > 1 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartPoints} margin={{ top: 12, right: 18, bottom: 4, left: 0 }}><CartesianGrid stroke="#253744" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(value: number) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} stroke="#8298a8" tickLine={false} minTickGap={40} /><YAxis domain={["auto", "auto"]} width={72} tickFormatter={(value: number) => formatPrice(value)} stroke="#8298a8" tickLine={false} /><Tooltip content={({ active, payload }) => active && payload?.length ? <div className="sales-analytics__tooltip"><strong>{formatPrice(Number(payload[0].value))} {selectedSymbol}</strong><span>{new Date(Number(payload[0].payload.time)).toLocaleString()}</span><span>{payload[0].payload.tokenId ? `NFT #${payload[0].payload.tokenId}` : "Collection sale"}</span></div> : null} />{comparableFloor != null && <ReferenceLine y={comparableFloor} stroke="#49c894" strokeDasharray="5 4" label={{ value: "Floor", fill: "#49c894", fontSize: 10 }} />}<Line dataKey="price" type="linear" stroke="#51c5e3" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <p className="t-note">At least two comparable sales are needed for the price line.</p>}
      </div>
      <div className="sales-analytics__recent">{sample.slice(0, 5).map((sale) => <div key={sale.id}><span>{sale.tokenId ? `#${sale.tokenId}` : "NFT sale"}</span><strong>{formatPrice(Number(formatUnits(BigInt(sale.priceUnits), sale.decimals)))} {sale.symbol}</strong><time dateTime={new Date(sale.timestamp * 1000).toISOString()}>{new Date(sale.timestamp * 1000).toLocaleTimeString()}</time></div>)}{!sample.length && <p className="t-note">No comparable {selectedSymbol || "priced"} sales in the fetched 24-hour sample.</p>}</div>
      <p className="t-note">Analytics use the latest {data.sampled} OpenSea sale events{data.hasMore ? "; older pages were not fetched" : ""}. Sample counts and prices are separate from OpenSea&apos;s reported 24h collection total. Currencies are never combined.</p>
    </>}
  </section>;
}
