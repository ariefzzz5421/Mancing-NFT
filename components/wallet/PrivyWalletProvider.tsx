"use client";
import { useCallback, useEffect, useState } from "react";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, custom, erc20Abi, formatEther, type Address, type EIP1193Provider } from "viem";
import { mainnet } from "viem/chains";
import { WETH } from "@/lib/web3/constants";
import { Context, setPrivyProvider } from "./WalletProvider";

export function PrivyWalletProvider({ children, appId }: { children: React.ReactNode; appId: string }) {
  return (
    <PrivyProvider appId={appId} config={{
      loginMethods: ["wallet"],
      embeddedWallets: { ethereum: { createOnLogin: "off" } },
      appearance: { theme: "dark", accentColor: "#22d3ee" },
    }}>
      <PrivyWalletState>{children}</PrivyWalletState>
    </PrivyProvider>
  );
}

function PrivyWalletState({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const active = authenticated ? wallets[0] : undefined;
  const address = (active?.address as Address | undefined) ?? null;
  const [provider, setProvider] = useState<EIP1193Provider | null>(null);
  const [chain, setChain] = useState<number | null>(null);
  const [balance, setBalance] = useState<{ eth: string | null; weth: string | null }>({ eth: null, weth: null });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    if (!active) {
      queueMicrotask(() => { if (current) { setProvider(null); setPrivyProvider(null); setChain(null); setBalance({ eth: null, weth: null }); } });
      return () => { current = false; };
    }
    active.getEthereumProvider().then((value) => {
      if (!current) return;
      const walletProvider = value as EIP1193Provider;
      setProvider(walletProvider);
      setPrivyProvider(walletProvider);
    }).catch(() => { if (current) setError("Wallet provider unavailable."); });
    return () => { current = false; setPrivyProvider(null); };
  }, [active]);

  const refresh = useCallback(async () => {
    if (!provider || !address) return;
    try {
      const client = createPublicClient({ chain: mainnet, transport: custom(provider) });
      const id = await client.getChainId();
      setChain(id);
      if (id !== 1) { setBalance({ eth: null, weth: null }); return; }
      const [eth, weth] = await Promise.all([
        client.getBalance({ address }),
        client.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
      ]);
      setBalance({ eth: formatEther(eth), weth: formatEther(weth) });
      setError("");
    } catch { setError("Wallet balance unavailable. Check your wallet RPC connection."); }
  }, [address, provider]);

  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);

  return <Context.Provider value={{
    address, chain, ...balance, error, busy,
    userId: authenticated ? (user?.id ?? null) : null,
    getAccessToken,
    connect: async () => { setBusy(true); setError(""); try { await login(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Wallet connection declined."); } finally { setBusy(false); } },
    disconnect: () => { setPrivyProvider(null); void logout(); },
    refresh,
  }}>{ready ? children : <div className="terminal-page">Loading wallet connection…</div>}</Context.Provider>;
}
