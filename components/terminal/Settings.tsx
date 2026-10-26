"use client";
import { useEffect, useState } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";
import type { Health } from "@/types/market";
import { Check, Minus, X } from "lucide-react";
type Config = { supabase: { configured: boolean; operational: boolean }; privy: { configured: boolean }; walletAuth: { configured: boolean }; rpc: { dedicated: boolean }; opensea: { configured: boolean } };
function Status({ okay, label, neutral = false }: { okay: boolean; label: string; neutral?: boolean }) {
  return <span className={`config-status ${okay ? "config-status--okay" : neutral ? "config-status--neutral" : "config-status--missing"}`}>
    {okay ? <Check size={15} aria-hidden="true" /> : neutral ? <Minus size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
    <span>{label}</span>
  </span>;
}
export function Settings() {
  const w = useWallet(),
    [health, setHealth] = useState<Health | null>(null),
    [rpc, setRpc] = useState("Checking…"),
    [coin, setCoin] = useState("Checking…"),
    [config, setConfig] = useState<Config | null>(null),
    [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    const r = await Promise.allSettled([
      fetch("/api/health").then((r) => r.json()),
      fetch("/api/network").then((r) => r.json()),
      fetch("/api/market/prices").then((r) => r.json()),
      fetch("/api/config").then((r) => r.json()),
    ]);
    if (r[0].status === "fulfilled") setHealth(r[0].value);
    setRpc(r[1].status === "fulfilled" ? r[1].value.state : "Offline");
    setCoin(r[2].status === "fulfilled" ? r[2].value.source : "Offline");
    if (r[3].status === "fulfilled") setConfig(r[3].value);
    setBusy(false);
  }
  useEffect(() => {
    queueMicrotask(() => void check());
  }, []);
  const [preferences, setPreferences] = useState({
    expiration: "24",
    slippage: "0.5",
    gas: "wallet",
  });
  useEffect(() => {
    try {
      const s = localStorage.getItem("mancing-preferences");
      if (s) queueMicrotask(() => setPreferences(JSON.parse(s)));
    } catch {}
  }, []);
  function update(key: string, value: string) {
    const p = { ...preferences, [key]: value };
    setPreferences(p);
    localStorage.setItem("mancing-preferences", JSON.stringify(p));
  }
  return (
    <main className="terminal-page">
      <div className="terminal-heading">
        <div>
          <span className="eyebrow">MANCING NFT / PREFERENCES</span>
          <h1>Settings</h1>
        </div>
        <button className="t-button" disabled={busy} onClick={check}>
          {busy ? "Checking…" : "Check services"}
        </button>
      </div>
      <div className="settings-grid">
        <section className="t-panel">
          <div className="panel-title">SYSTEM STATUS</div>
          <dl className="metric-list">
            <div><dt>OpenSea API</dt><dd><Status okay={health?.state === "Operational"} label={health?.state ?? "Checking…"} /></dd></div>
            <div><dt>Supabase</dt><dd><Status okay={config?.supabase.operational === true} neutral={!config?.supabase.configured} label={config?.supabase.operational ? "Connected" : config?.supabase.configured ? "Connection failed" : "Not configured"} /></dd></div>
            <div><dt>Privy</dt><dd><Status okay={config?.privy.configured === true} neutral={!config?.privy.configured} label={config?.privy.configured ? "Configured" : "Not configured"} /></dd></div>
            <div><dt>Wallet sign-in</dt><dd><Status okay={config?.walletAuth.configured === true} neutral={!config?.walletAuth.configured} label={config?.walletAuth.configured ? "Configured" : "Not configured"} /></dd></div>
            <div><dt>RPC</dt><dd><Status okay={rpc === "Operational"} label={rpc === "Operational" ? config?.rpc.dedicated ? "Dedicated RPC online" : "Public RPC online" : rpc} /></dd></div>
            <div><dt>Market prices</dt><dd><Status okay={coin === "coingecko"} neutral={coin === "mixed" || coin === "yahoo"} label={coin === "coingecko" ? "Connected" : coin === "mixed" ? "Partial data" : coin === "yahoo" ? "Yahoo fallback" : "Unavailable"} /></dd></div>
            <div><dt>Wallet</dt><dd><Status okay={Boolean(w.address)} neutral={!w.address} label={w.address ? "Connected" : "Disconnected"} /></dd></div>
          </dl>
          <p className="t-note">
            Order data requires an authenticated OpenSea connection.
          </p>
        </section>
        <section className="t-panel">
          <div className="panel-title">MARKET DATA</div>
          <dl className="metric-list">
            <div>
              <dt>Foreground refresh</dt>
              <dd>60 seconds</dd>
            </div>
            <div>
              <dt>Order-book cache</dt>
              <dd>20 seconds</dd>
            </div>
            <div>
              <dt>Metadata cache</dt>
              <dd>15 minutes</dd>
            </div>
            <div>
              <dt>Statistics cache</dt>
              <dd>45 seconds</dd>
            </div>
            <div>
              <dt>Last successful probe</dt>
              <dd>
                {health?.lastSuccess
                  ? new Date(health.lastSuccess).toLocaleString()
                  : "No successful probe"}
              </dd>
            </div>
            <div>
              <dt>OpenSea request quota</dt>
              <dd>{health?.rateLimit ? `${(health.rateLimit.limit - health.rateLimit.remaining).toLocaleString()} / ${health.rateLimit.limit.toLocaleString()}` : "Not provided by OpenSea"}</dd>
            </div>
            {health?.rateLimit?.resetAt && <div><dt>Quota resets</dt><dd>{new Date(health.rateLimit.resetAt).toLocaleString()}</dd></div>}
          </dl>
          <p className="t-note">
            Quota comes from OpenSea response headers. Hidden tabs pause refresh.
          </p>
        </section>
        <section className="t-panel">
          <div className="panel-title">TRADING DEFAULTS</div>
          <label>
            Default expiration
            <select
              value={preferences.expiration}
              onChange={(e) => update("expiration", e.target.value)}
            >
              {[6, 12, 24, 72, 168].map((h) => (
                <option key={h} value={h}>
                  {h} hours
                </option>
              ))}
            </select>
          </label>
          <label>
            Default slippage / %
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={preferences.slippage}
              onChange={(e) => update("slippage", e.target.value)}
            />
          </label>
          <label>
            Gas preference
            <select
              value={preferences.gas}
              onChange={(e) => update("gas", e.target.value)}
            >
              <option value="wallet">Review in wallet</option>
            </select>
          </label>
          <p className="t-note">
            Wallet confirmation determines final gas costs.
          </p>
        </section>
        <section className="t-panel">
          <div className="panel-title">ADVANCED / DIAGNOSTICS</div>
          <dl className="metric-list">
            <div>
              <dt>Last request status</dt>
              <dd>{health?.lastStatus ?? "—"}</dd>
            </div>
            <div>
              <dt>Last health update</dt>
              <dd>
                {health?.updatedAt
                  ? new Date(health.updatedAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Watchlist / preferences</dt>
              <dd>{w.userId && config?.supabase.operational ? "Supabase · signed wallet" : "This browser"}</dd>
            </div>
            <div>
              <dt>Signing</dt>
              <dd>Wallet · Seaport 1.6 · Ethereum</dd>
            </div>
          </dl>
          <p className="t-note">
            Status resets when the server restarts. Contract-wallet order signatures are not supported.
          </p>
        </section>
      </div>
    </main>
  );
}
