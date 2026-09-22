"use client";
import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

type Point = { id: string; timestamp: number; priceEth: number; currency: string };
type History = { points: Point[]; excluded: number; updatedAt: string; coverage: string };

export function PriceHistoryChart({ slug, floor }: { slug: string; floor: number | null }) {
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setChartSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [loading, history]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/collections/${encodeURIComponent(slug)}/history`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw Error(data.error ?? "Recent sales unavailable.");
        setHistory(data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Recent sales unavailable.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [slug, revision]);
  const points = history?.points ?? [];
  const last = points.at(-1);
  return <section className="t-panel price-history" aria-label="Recent sale price chart">
    <div className="panel-title"><span>04 / RECENT SALE PRICES</span><span>ETH · WETH</span></div>
    <div className="price-history__summary">
      <div><small>LATEST INCLUDED SALE</small><strong>{last ? `${last.priceEth.toLocaleString("en-US", { maximumFractionDigits: 6 })} ETH` : "—"}</strong></div>
      <div><small>CURRENT REPORTED FLOOR</small><strong>{floor == null ? "—" : `${floor.toLocaleString("en-US", { maximumFractionDigits: 6 })} ETH`}</strong></div>
      <div><small>OBSERVATIONS</small><strong>{points.length}</strong></div>
    </div>
    {loading && !history ? <div className="price-history__state" role="status">Loading recent sales…</div> : error ?
      <div className="price-history__state t-error" role="alert">{error} <button onClick={() => setRevision((value) => value + 1)}>Retry</button></div> : points.length < 2 ?
      <div className="price-history__state">No comparable ETH/WETH sales returned for this collection.</div> :
      <div className="price-history__chart" ref={chartRef}>
        {chartSize.width > 0 && chartSize.height > 0 &&
          <LineChart width={chartSize.width} height={chartSize.height} data={points} margin={{ top: 10, right: 14, bottom: 6, left: 2 }}>
            <CartesianGrid stroke="var(--color-chart-grid)" vertical={false} strokeDasharray="2 4" />
            <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(value: number) => new Date(value * 1000).toLocaleDateString()} stroke="var(--color-chart-axis)" tickLine={false} minTickGap={36} />
            <YAxis domain={["auto", "auto"]} width={64} tickFormatter={(value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 3 })} stroke="var(--color-chart-axis)" tickLine={false} />
            <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="chart-tooltip"><strong>{Number(payload[0].value).toLocaleString("en-US", { maximumFractionDigits: 8 })} ETH</strong><span>{new Date(Number(payload[0].payload.timestamp) * 1000).toLocaleString()}</span></div> : null} />
            {floor != null && <ReferenceLine y={floor} stroke="var(--color-chart-positive)" strokeDasharray="5 4" />}
            <Line dataKey="priceEth" type="linear" stroke="var(--color-chart-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>}
      </div>}
    <p className="t-note">Actual recent OpenSea sales, ordered by time. The dashed line is the latest reported floor snapshot, not a historical floor series. {history?.excluded ? `${history.excluded} unsupported-currency or multi-item events excluded. ` : ""}This is not a continuously traded spot price.</p>
  </section>;
}
