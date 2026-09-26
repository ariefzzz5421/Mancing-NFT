export const flipStates = [
  "IDLE", "OFFER_PREPARED", "OFFER_ACTIVE", "FILLED", "INVENTORY",
  "LIST_PREPARED", "LIST_ACTIVE", "SOLD", "CLOSED", "CANCELLED", "EXPIRED", "FAILED",
] as const;
export type FlipState = (typeof flipStates)[number];

const transitions: Record<FlipState, readonly FlipState[]> = {
  IDLE: ["OFFER_PREPARED"],
  OFFER_PREPARED: ["OFFER_ACTIVE", "FAILED"],
  OFFER_ACTIVE: ["FILLED", "CANCELLED", "EXPIRED", "FAILED"],
  FILLED: ["INVENTORY", "FAILED"],
  INVENTORY: ["LIST_PREPARED", "CLOSED"],
  LIST_PREPARED: ["LIST_ACTIVE", "INVENTORY", "FAILED"],
  LIST_ACTIVE: ["SOLD", "CANCELLED", "EXPIRED", "FAILED"],
  SOLD: ["CLOSED"],
  CLOSED: [], CANCELLED: [], EXPIRED: [], FAILED: [],
};

export function canAdvanceFlip(from: FlipState, to: FlipState) {
  return transitions[from].includes(to);
}

// A stream notification may prompt reconciliation, but cannot advance this state.
export type FlipSignal = { source: "opensea-stream"; orderHash: string; observedAt: string };
export type ConfirmedFlipEvent = {
  source: "ethereum-rpc";
  orderHash: string;
  walletAddress: string;
  contractAddress: string;
  tokenId: string;
  transactionHash: string;
  blockNumber: string;
};
