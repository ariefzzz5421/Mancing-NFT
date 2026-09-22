"use client";
import { useEffect, useState } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";
import type { Health } from "@/types/market";
export function Settings() {
  const w = useWallet(),
    [health, setHealth] = useState<Health | null>(null),
    [rpc, setRpc] = useState("Checking…"),
    [coin, setCoin] = useState("Checking…"),
    [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    const r = await Promise.allSettled([
      fetch("/api/health").then((r) => r.json()),
      fetch("/api/network").then((r) => r.json()),
      fetch("/api/market/prices").then((r) => r.json()),
    ]);
    if (r[0].status === "fulfilled") setHealth(r[0].value);
    setRpc(r[1].status === "fulfilled" ? r[1].value.state : "Offline");
    setCoin(r[2].status === "fulfilled" ? r[2].value.source : "Offline");
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
          <h1>Settings.</h1>
        </div>
        <button className="t-button" disabled={busy} onClick={check}>
          {busy ? "Checking…" : "Check services"}
        </button>
      </div>
      <div className="settings-grid">
        <section className="t-panel">
          <div className="panel-title">SYSTEM STATUS</div>
          <dl className="metric-list">
            {[
              ["OpenSea API", health?.state ?? "Checking…"],
              ["RPC", rpc],
              ["ETH price source", coin],
              ["Wallet", w.address ? "Connected" : "Disconnected"],
            ].map(([l, v]) => (
              <div key={l}>
                <dt>{l}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="t-note">
            OpenSea health probes an authenticated order endpoint. Successful
            metadata alone does not establish trading access.
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
          </dl>
          <p className="t-note">
            Hidden tabs pause market refresh. Rate-limit and authentication
            errors trigger a 30-second cooldown per server instance.
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
            Applied when opening a new terminal. Wallet confirmation determines
            execution gas.
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
              <dd>This browser</dd>
            </div>
            <div>
              <dt>Signing</dt>
              <dd>Wallet · Seaport 1.6 · Ethereum</dd>
            </div>
          </dl>
          <p className="t-note">
            Health history is scoped to this server instance. Credentials remain
            server-side. Contract-wallet order signatures are not yet supported
            by the submit verifier.
          </p>
        </section>
      </div>
    </main>
  );
}
