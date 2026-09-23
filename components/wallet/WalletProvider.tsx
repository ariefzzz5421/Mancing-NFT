"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  createWalletClient,
  createPublicClient,
  custom,
  erc20Abi,
  formatEther,
  type EIP1193Provider,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import { WETH } from "@/lib/web3/constants";
import { signInWatchlist, signOutWatchlist } from "@/lib/web3/watchlist-auth";
type Provider = EIP1193Provider & {
  on?: (event: string, fn: (value: unknown) => void) => void;
  removeListener?: (event: string, fn: (value: unknown) => void) => void;
};
let privyProvider: EIP1193Provider | null = null;
export function setPrivyProvider(provider: EIP1193Provider | null) {
  privyProvider = provider;
}
export function injected() {
  return privyProvider ?? (window as unknown as { ethereum?: Provider }).ethereum;
}
export type Wallet = {
  address: Address | null;
  chain: number | null;
  eth: string | null;
  weth: string | null;
  error: string;
  busy: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  userId: string | null;
  getAccessToken: () => Promise<string | null>;
  signIn: () => Promise<void>;
};
export const Context = createContext<Wallet | null>(null);
const noAccessToken = async () => null;
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null),
    [chain, setChain] = useState<number | null>(null),
    [balance, setBalance] = useState<{
      eth: string | null;
      weth: string | null;
    }>({ eth: null, weth: null }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [userId, setUserId] = useState<string | null>(null);
  const signIn = useCallback(async () => {
    const provider = injected();
    if (!provider || !address) throw Error("Connect your wallet first.");
    setBusy(true);
    setError("");
    try { setUserId(await signInWatchlist(address, provider)); }
    catch (cause) {
      setUserId(null);
      const message = cause instanceof Error ? cause.message : "Wallet sign-in declined.";
      setError(message);
      throw Error(message);
    } finally { setBusy(false); }
  }, [address]);
  const refresh = useCallback(async () => {
    const provider = injected();
    if (!provider || !address) return;
    try {
      const client = createPublicClient({
        chain: mainnet,
        transport: custom(provider),
      });
      const id = await client.getChainId();
      setChain(id);
      if (id !== 1) {
        setBalance({ eth: null, weth: null });
        return;
      }
      const [eth, weth] = await Promise.all([
        client.getBalance({ address }),
        client.readContract({
          address: WETH,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        }),
      ]);
      setBalance({ eth: formatEther(eth), weth: formatEther(weth) });
    } catch {
      setError("Wallet balance unavailable. Check your wallet RPC connection.");
    }
  }, [address]);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const provider = injected();
      if (!provider)
        throw Error(
          "No browser wallet detected. Open this site in your wallet browser or install an Ethereum wallet.",
        );
      const client = createWalletClient({ transport: custom(provider) });
      const [a] = await client.requestAddresses();
      setAddress(a ?? null);
      setChain(await client.getChainId());
      if (a) {
        try { setUserId(await signInWatchlist(a, provider)); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Wallet sign-in declined. Connect again to sync watchlists."); }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet connection declined");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const p = injected();
    const accounts = (value: unknown) => {
      setUserId(null);
      void signOutWatchlist();
      setAddress(
        Array.isArray(value) && typeof value[0] === "string"
          ? (value[0] as Address)
          : null,
      );
      setBalance({ eth: null, weth: null });
    };
    const chains = (value: unknown) => {
      setChain(Number(value));
      setBalance({ eth: null, weth: null });
    };
    p?.on?.("accountsChanged", accounts);
    p?.on?.("chainChanged", chains);
    return () => {
      p?.removeListener?.("accountsChanged", accounts);
      p?.removeListener?.("chainChanged", chains);
    };
  }, []);
  useEffect(() => {
    const provider = injected();
    if (!provider) return;
    let active = true;
    Promise.all([provider.request({ method: "eth_accounts" }), fetch("/api/auth/session", { cache: "no-store" }).then((r) => r.json())])
      .then(([accounts, session]) => {
        if (!active || !Array.isArray(accounts) || typeof accounts[0] !== "string") return;
        const account = accounts[0] as Address;
        if (session.address?.toLowerCase() === account.toLowerCase()) {
          setAddress(account);
          setUserId(`wallet:${account.toLowerCase()}`);
        }
      }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh, chain]);
  return (
    <Context.Provider
      value={{
        address,
        chain,
        ...balance,
        error,
        busy,
        connect,
        disconnect: () => {
          void signOutWatchlist();
          setUserId(null);
          setAddress(null);
          setBalance({ eth: null, weth: null });
        },
        refresh,
        userId,
        getAccessToken: noAccessToken,
        signIn,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWallet() {
  const c = useContext(Context);
  if (!c) throw Error("WalletProvider required");
  return c;
}
export function WalletConnect() {
  const w = useWallet();
  return (
    <button
      className="t-button wallet-connect"
      onClick={w.address ? w.disconnect : w.connect}
      disabled={w.busy}
    >
      {w.busy
        ? "Connecting…"
        : w.address
          ? `${w.address.slice(0, 6)}…${w.address.slice(-4)} · Disconnect`
          : "Connect wallet"}
    </button>
  );
}
