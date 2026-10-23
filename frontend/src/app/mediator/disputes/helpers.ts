import { formatDate as formatLocalizedDate } from "@/lib/i18n";

const DEFAULT_MEDIATOR_ADDRESSES = ["GEXAMPLEMEDIATORPUBLICKEY1"];

/**
 * True when the app is running in a non-production environment.
 * Production builds must never fall back to placeholder credentials.
 */
export function isNonProductionEnv(
  appEnv: string | undefined = process.env.NEXT_PUBLIC_APP_ENV,
): boolean {
  return (appEnv ?? "").trim().toLowerCase() !== "production";
}

/** Reads the mediator wallet allowlist from env, falling back to a dev default only outside production. */
export function getMediatorAddresses(
  envValue: string | undefined = process.env.NEXT_PUBLIC_MEDIATOR_WALLETS,
  appEnv: string | undefined = process.env.NEXT_PUBLIC_APP_ENV,
): string[] {
  const fromEnv = (envValue ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (fromEnv.length > 0) return fromEnv;

  // Fail closed in production: no placeholder mediator addresses.
  return isNonProductionEnv(appEnv) ? DEFAULT_MEDIATOR_ADDRESSES : [];
}

export function isMediatorAddress(
  address: string | null | undefined,
  mediatorAddresses: string[],
): boolean {
  return Boolean(address && mediatorAddresses.includes(address));
}

/** Formats an ISO date string using the active locale for dispute list rows. */
export function formatDate(dateString: string): string {
  return formatLocalizedDate(dateString);
}

/** Truncates a Stellar wallet address to "GABC...WXYZ"; short strings pass through untouched. */
export function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export type SlaBucket = "Normal" | "Warning" | "Critical";

const HOUR_MS = 60 * 60 * 1000;

/** Hours elapsed since the dispute was created; returns 0 for invalid dates. */
export function getDisputeAgeHours(
  createdAt: string,
  now: Date = new Date(),
): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  const elapsed = now.getTime() - created;
  if (Number.isNaN(elapsed) || elapsed < 0) return 0;
  return elapsed / HOUR_MS;
}

/** Buckets a dispute by SLA urgency: Normal <12h, Warning 12–24h, Critical >24h. */
export function getSlaBucket(
  createdAt: string,
  now: Date = new Date(),
): SlaBucket {
  const ageHours = getDisputeAgeHours(createdAt, now);
  if (ageHours > 24) return "Critical";
  if (ageHours >= 12) return "Warning";
  return "Normal";
}

export type DisputeSortKey = "sla" | "value" | "date";

interface SortableDispute {
  createdAt: string;
  trade?: { amountUsdc?: number | string } | null;
}

function toAmount(value: number | string | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Sorts disputes for the mediator queue.
 * 'sla' and 'date' order oldest-open-first; 'value' orders by descending trade amount.
 */
export function sortDisputes<T extends SortableDispute>(
  disputes: T[],
  sortKey: DisputeSortKey,
): T[] {
  const sorted = [...disputes];
  if (sortKey === "value") {
    sorted.sort(
      (a, b) => toAmount(b.trade?.amountUsdc) - toAmount(a.trade?.amountUsdc),
    );
    return sorted;
  }
  sorted.sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    const aValid = !Number.isNaN(aTime);
    const bValid = !Number.isNaN(bTime);
    if (!aValid && !bValid) return 0;
    if (!aValid) return 1;
    if (!bValid) return -1;
    return aTime - bTime;
  });
  return sorted;
}

export const MIN_JUSTIFICATION_LENGTH = 30;

/** True only when an outcome is chosen and the justification note is long enough. */
export function canSubmitResolution(
  outcome: string | null | undefined,
  justification: string | null | undefined,
): boolean {
  if (!outcome) return false;
  return (justification ?? "").trim().length >= MIN_JUSTIFICATION_LENGTH;
}

export interface ResolutionSplit {
  buyerAmount: string;
  sellerAmount: string;
}

/**
 * Computes the cNGN payout split for a resolution outcome.
 * Buyer-favoured outcomes refund the buyer; seller-favoured outcomes pay the seller.
 */
export function getResolutionSplit(
  outcome: string | null | undefined,
  escrowAmount: number | string | null | undefined,
): ResolutionSplit {
  const total = toAmount(escrowAmount ?? 0);
  const normalized = (outcome ?? "").trim().toLowerCase();
  const buyerFavoured = normalized.includes("buyer") || normalized.includes("refund");
  const sellerFavoured = normalized.includes("seller") || normalized.includes("release");

  if (buyerFavoured && !sellerFavoured) {
    return { buyerAmount: total.toFixed(2), sellerAmount: "0.00" };
  }
  if (sellerFavoured && !buyerFavoured) {
    return { buyerAmount: "0.00", sellerAmount: total.toFixed(2) };
  }
  // Split / unknown outcomes divide the escrow evenly.
  const half = total / 2;
  return { buyerAmount: half.toFixed(2), sellerAmount: half.toFixed(2) };
}
