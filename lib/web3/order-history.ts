export type SavedOrder = {
  hash: string;
  collection: string;
  side: string;
  price: string;
  quantity: number;
  created: number;
  expiration: number;
  status: string;
};
const key = (address: string) => `mancing-orders:v1:${address.toLowerCase()}`;
export function readOrders(address: string): SavedOrder[] {
  try {
    const data = JSON.parse(localStorage.getItem(key(address)) ?? "[]");
    return Array.isArray(data)
      ? data.filter((x) => typeof x.hash === "string").slice(0, 200)
      : [];
  } catch {
    return [];
  }
}
export function saveOrder(address: string, order: SavedOrder) {
  localStorage.setItem(
    key(address),
    JSON.stringify(
      [
        order,
        ...readOrders(address).filter((o) => o.hash !== order.hash),
      ].slice(0, 200),
    ),
  );
}
export function markCancelled(address: string, hash: string) {
  localStorage.setItem(
    key(address),
    JSON.stringify(
      readOrders(address).map((o) =>
        o.hash === hash ? { ...o, status: "CANCELLED" } : o,
      ),
    ),
  );
}
