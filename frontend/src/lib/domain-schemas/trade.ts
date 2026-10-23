/**
 * CANONICAL trade domain schema — shared between backend request validation and
 * frontend form validation so the two cannot drift.
 *
 * This file is framework-free (only `zod`) and is kept byte-identical with
 * its counterpart in the yakzagri-flow backend repository
 * (`backend/src/schemas/domain/trade.ts`), see docs/shared-schemas.md for the
 * parity strategy. It is intentionally self-contained: the frontend repo owns
 * this copy and must not import the backend package directly.
 */
import { z } from "zod";
import { StrKey } from "@stellar/stellar-sdk";

export const STELLAR_PUBLIC_KEY_REGEX = /^(G|C)[A-Z2-7]{55}$/;

export function isValidStellarAddress(value: string): boolean {
  const address = value.trim();
  if (!address) return false;
  if (address.startsWith("G")) return StrKey.isValidEd25519PublicKey(address);
  if (address.startsWith("C")) return StrKey.isValidContract(address);
  return false;
}
export const USDC_AMOUNT_REGEX = /^\d+(\.\d{1,7})?$/;
export const LOSS_BPS_MIN = 0;
export const LOSS_BPS_MAX = 10_000;
export const LOSS_BPS_SUM = 10_000;
export const DEFAULT_LOSS_BPS = 5_000;

/**
 * Canonical commodity unit enum. Agricultural trades are denominated in
 * physical units (50kg bags of maize, metric tonnes of sorghum, crates of
 * tomatoes, ...) so partial losses can be verified during Proof-of-Delivery
 * disputes. Keep this list in sync with the backend copy.
 */
export const COMMODITY_UNITS = [
  "kg",
  "tonnes",
  "bags_50kg",
  "bags_100kg",
  "crates",
] as const;

export type CommodityUnit = (typeof COMMODITY_UNITS)[number];

export const commodityUnit = z.enum(COMMODITY_UNITS);

/** Human-readable labels for rendering commodity units in the UI. */
export const COMMODITY_UNIT_LABELS: Record<CommodityUnit, string> = {
  kg: "Kilograms (kg)",
  tonnes: "Metric tonnes (t)",
  bags_50kg: "50kg bags",
  bags_100kg: "100kg bags",
  crates: "Crates",
};

/** Structured commodity quantity — a positive, finite number of units. */
export const commodityQuantity = z
  .number()
  .positive("Quantity must be positive")
  .finite("Quantity must be a finite number");

export const stellarPublicKey = z
  .string()
  .trim()
  .refine((value) => isValidStellarAddress(value), "Invalid Stellar address");

export const lossBps = z
  .number()
  .int("Must be a whole number")
  .min(LOSS_BPS_MIN, `Cannot be below ${LOSS_BPS_MIN}`)
  .max(LOSS_BPS_MAX, `Cannot exceed ${LOSS_BPS_MAX}`);

export const usdcAmount = z.union([
  z.string().regex(USDC_AMOUNT_REGEX, "Invalid amount format"),
  z.number().positive("Amount must be positive").transform(String),
]);

/**
 * Canonical money amount. The API request field is `amountUsdc` while the API
 * response field is `amountCngn`; both carry the same underlying decimal
 * amount, so we type them with a single branded string to make the shared
 * semantics explicit and prevent silent drift across the boundary.
 */
export type TradeAmount = string & { readonly __brand: "TradeAmount" };

export const tradeAmount = usdcAmount.transform(
  (value) => value as TradeAmount,
);

export const createTradeInputSchema = z
  .object({
    buyerAddress: stellarPublicKey.optional(),
    sellerAddress: stellarPublicKey,
    amountUsdc: tradeAmount,
    buyerLossBps: lossBps.optional(),
    sellerLossBps: lossBps.optional(),
    description: z.string().optional(),
    quantity: commodityQuantity.optional(),
    unit: commodityUnit.optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.quantity === undefined) !== (data.unit === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "quantity and unit must be provided together",
        path: [data.quantity === undefined ? "quantity" : "unit"],
      });
    }
    const buyer = data.buyerLossBps ?? DEFAULT_LOSS_BPS;
    const seller = data.sellerLossBps ?? DEFAULT_LOSS_BPS;
    if (buyer + seller !== LOSS_BPS_SUM) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `buyerLossBps and sellerLossBps must sum to ${LOSS_BPS_SUM}`,
        path: ["buyerLossBps"],
      });
    }
  });

export type CreateTradeInput = z.infer<typeof createTradeInputSchema>;

/**
 * Canonical trade model — the single source of truth for trade field names and
 * types across the API↔UI boundary. API responses expose the money field as
 * `amountCngn`; the mapper below normalizes it to the canonical `amount`.
 */
export const tradeSchema = z.object({
  id: z.string(),
  buyerAddress: stellarPublicKey.optional(),
  sellerAddress: stellarPublicKey,
  amount: tradeAmount,
  buyerLossBps: lossBps.optional(),
  sellerLossBps: lossBps.optional(),
  description: z.string().optional(),
  quantity: commodityQuantity.optional(),
  unit: commodityUnit.optional(),
  status: z.string(),
  createdAt: z.string().optional(),
});

export type Trade = z.infer<typeof tradeSchema>;

/**
 * API response shape as returned by the backend. The money field is named
 * `amountCngn` here, which is why an explicit mapper is required.
 */
export interface TradeResponse {
  id: string;
  buyerAddress?: string;
  sellerAddress: string;
  amountCngn: string;
  buyerLossBps?: number;
  sellerLossBps?: number;
  description?: string;
  quantity?: number;
  unit?: CommodityUnit;
  status: string;
  createdAt?: string;
}

/**
 * Explicit transform mapper between the API response shape (`amountCngn`) and
 * the canonical trade model (`amount`). This is the single place where the
 * request/response money field naming is reconciled, so `amountUsdc` and
 * `amountCngn` can no longer drift silently.
 */
export function fromTradeResponse(response: TradeResponse): Trade {
  return {
    id: response.id,
    buyerAddress: response.buyerAddress,
    sellerAddress: response.sellerAddress,
    amount: response.amountCngn as TradeAmount,
    buyerLossBps: response.buyerLossBps,
    sellerLossBps: response.sellerLossBps,
    description: response.description,
    quantity: response.quantity,
    unit: response.unit,
    status: response.status,
    createdAt: response.createdAt,
  };
}

/**
 * Explicit transform mapper from the canonical trade model back to the API
 * response shape, mapping the canonical `amount` to `amountCngn`.
 */
export function toTradeResponse(trade: Trade): TradeResponse {
  return {
    id: trade.id,
    buyerAddress: trade.buyerAddress,
    sellerAddress: trade.sellerAddress,
    amountCngn: trade.amount,
    buyerLossBps: trade.buyerLossBps,
    sellerLossBps: trade.sellerLossBps,
    description: trade.description,
    quantity: trade.quantity,
    unit: trade.unit,
    status: trade.status,
    createdAt: trade.createdAt,
  };
}

/**
 * Derive the unit price (amount per commodity unit) from a total amount and a
 * quantity. Returns `null` when either input is missing or the quantity is not
 * a positive finite number, so callers can render a placeholder instead of
 * `Infinity`/`NaN`. The result is rounded to 7 decimal places to match the
 * USDC precision used elsewhere in this schema.
 */
export function computeUnitPrice(
  amount: string | number | null | undefined,
  quantity: number | null | undefined,
): number | null {
  if (amount === null || amount === undefined) return null;
  if (quantity === null || quantity === undefined) return null;
  const parsedAmount = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const price = parsedAmount / quantity;
  if (!Number.isFinite(price)) return null;
  return Math.round(price * 1e7) / 1e7;
}

/** Flatten a ZodError into `{ field: message }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
