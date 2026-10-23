// src/types/trade.ts

export const TRADE_STATUSES = [
  "IN TRANSIT",
  "PENDING",
  "SETTLED",
  "DISPUTED",
  "DRAFT",
  "CANCELLED",
] as const;

export type TradeStatus = (typeof TRADE_STATUSES)[number];

/**
 * Pre-dispatch escrow states in which a trade may still be cancelled by an
 * authorized party (buyer or seller) before goods are dispatched. Escrow
 * funds are still locked in the vault in these states, so cancellation
 * returns them to the buyer.
 */
export const CANCELLABLE_TRADE_STATUSES = ["PENDING"] as const;

export type CancellableTradeStatus = (typeof CANCELLABLE_TRADE_STATUSES)[number];

/**
 * Runtime guard for the cancellable pre-dispatch states. Use this to gate
 * the "Cancel Trade" action on the trade detail page.
 */
export function isCancellableTradeStatus(
  status: unknown,
): status is CancellableTradeStatus {
  return (
    typeof status === "string" &&
    (CANCELLABLE_TRADE_STATUSES as readonly string[]).includes(status)
  );
}

/**
 * Runtime guard that narrows an arbitrary value to the canonical
 * `TradeStatus` union. Use this at the API boundary so raw strings are
 * validated instead of trusted.
 */
export function isTradeStatus(value: unknown): value is TradeStatus {
  return (
    typeof value === "string" &&
    (TRADE_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Canonical money amount, expressed in USDC.
 *
 * The API boundary uses two different field names for the same underlying
 * value: requests send `amountUsdc` while responses return `amountCngn`.
 * Both are USDC-denominated amounts; the naming drift is historical. All
 * internal/UI shapes should use `amountUsdc` and rely on the transform
 * mappers in `lib/domain-schemas/trade.ts` to cross the boundary.
 */
export type UsdcAmount = number;

export interface TradeParty {
  name: string;
  walletAddress: string;
  trustScore: number;
  avatar?: string;
}

export interface TimelineEvent {
  id: string;
  type: "escrow_funded" | "inspection_passed" | "dispatched" | "settlement";
  title: string;
  description?: string;
  timestamp?: string;
  status: "completed" | "current" | "pending";
  tracking?: {
    trackingNumber: string;
    imageUrl?: string;
  };
}

export type TransactionEventStatus = "completed" | "active" | "pending" | "failed";

export type TransactionEventActor = "system" | "buyer" | "seller" | "driver";

export interface TransactionEvent {
  id: string;
  type?: string;
  title: string;
  actor: TransactionEventActor;
  status?: TransactionEventStatus;
  timestamp?: string;
  description?: string;
}

export interface LossRatio {
  label: string;
  value: number; // percentage 0-100
}

export interface TradeDetail {
  id: string;
  commodity: string;
  quantity: string; // e.g. "20 Tons Non-GMO"
  category: string; // e.g. "Grains / Legumes"
  status: TradeStatus;
  initiatedAt: string;

  buyer: TradeParty;
  seller: TradeParty;

  // Financials
  vaultAmountLocked: UsdcAmount;
  assetValue: UsdcAmount;
  platformFeePercent: number;
  platformFee: UsdcAmount;
  networkGasEst: string;

  // Contract
  contractId: string;
  incoterms: string;
  originPort: string;
  destinationPort: string;
  eta: string;
  etaLabel?: string;
  carrier: string;

  // Timeline
  timeline: TimelineEvent[];

  // Chronological transaction timeline
  transactionTimeline?: TransactionEvent[];
  currentTransactionIndex?: number;

  // Optional loss ratios
  lossRatios?: LossRatio[];
}
