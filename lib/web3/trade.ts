import type { EIP1193Provider } from "viem";
import type {
  CreateOrderInput,
  OrderComponents,
} from "@opensea/seaport-js/lib/types";
import { SEAPORT } from "./constants";
export async function client(provider: EIP1193Provider) {
  const [{ BrowserProvider }, { Seaport }] = await Promise.all([
    import("ethers"),
    import("@opensea/seaport-js"),
  ]);
  const browser = new BrowserProvider(provider);
  if ((await browser.getNetwork()).chainId !== 1n)
    throw Error("Switch your wallet to Ethereum mainnet.");
  const signer = await browser.getSigner();
  return new Seaport(signer as unknown as ConstructorParameters<typeof Seaport>[0], {
    overrides: { contractAddress: SEAPORT, seaportVersion: "1.6" },
  });
}
export async function prepareWalletOrder(
  provider: EIP1193Provider,
  input: CreateOrderInput,
  address: string,
) {
  const seaport = await client(provider);
  return seaport.createOrder(input, address, true);
}
export async function cancelWalletOrder(
  provider: EIP1193Provider,
  order: OrderComponents,
  address: string,
) {
  const seaport = await client(provider);
  const tx = await seaport.cancelOrders([order], address).transact();
  await tx.wait();
  return tx.hash;
}
