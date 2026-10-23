import { z } from "zod";
import { StrKey } from "@stellar/stellar-sdk";
import { t } from "@/lib/i18n";

export function isValidStellarAddress(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (StrKey.isValidEd25519PublicKey(trimmed)) {
    return true;
  }
  if (typeof StrKey.isValidContract === "function" && StrKey.isValidContract(trimmed)) {
    return true;
  }
  return false;
}

export function isSelfEscrowAddress(buyerAddress?: string | null, sellerAddress?: string | null): boolean {
  if (!buyerAddress || !sellerAddress) return false;
  const buyer = buyerAddress.trim().toUpperCase();
  const seller = sellerAddress.trim().toUpperCase();
  return buyer !== "" && buyer === seller;
}

export const MIN_DELIVERY_DEADLINE_MS = 60 * 60 * 1000; // 1 hour
export const MAX_DELIVERY_DEADLINE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

/**
 * Formats a duration in milliseconds as a human readable relative string,
 * e.g. "In 5 days", "In 3 hours", "In 45 minutes".
 */
export function formatRelativeDuration(ms: number): string {
  const abs = Math.abs(ms);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  let value: number;
  let unit: string;
  if (abs >= day) {
    value = Math.round(abs / day);
    unit = "day";
  } else if (abs >= hour) {
    value = Math.round(abs / hour);
    unit = "hour";
  } else {
    value = Math.max(1, Math.round(abs / minute));
    unit = "minute";
  }
  const plural = value === 1 ? unit : `${unit}s`;
  return ms >= 0 ? `In ${value} ${plural}` : `${value} ${plural} ago`;
}

/**
 * Validates an expected delivery deadline timestamp.
 * Returns an error message string, or null when valid.
 */
export function validateDeliveryDeadline(
  value: string | number | Date | null | undefined,
  now: number = Date.now()
): string | null {
  if (value === null || value === undefined || value === "") {
    return "Select an expected delivery date";
  }
  const timestamp =
    value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  if (isNaN(timestamp)) {
    return "Enter a valid delivery date";
  }
  const diff = timestamp - now;
  if (diff < MIN_DELIVERY_DEADLINE_MS) {
    return "Delivery date must be at least 1 hour in the future";
  }
  if (diff > MAX_DELIVERY_DEADLINE_MS) {
    return "Delivery date cannot be more than 180 days in the future";
  }
  return null;
}

export const step1Schema = z
  .object({
    commodity: z.string().min(1, "Select a commodity"),
    quantity: z.string().refine(
      (val) => {
        const n = parseFloat(val);
        return !isNaN(n) && n > 0;
      },
      { message: "Quantity must be greater than 0" }
    ),
    unit: z.enum(COMMODITY_UNITS, { message: "Select a valid unit" }),
    pricePerUnit: z.string().refine(
      (val) => {
        const n = parseFloat(val);
        return !isNaN(n) && n > 0;
      },
      { message: "Price must be greater than 0" }
    ),
    currency: z.string().min(1),
    buyerAddress: z.string().optional(),
    sellerAddress: z.string().refine(
      (val) => isValidStellarAddress(val),
      { message: "Invalid Stellar public key" }
    ),
    deliveryDeadline: z
      .union([z.string(), z.number(), z.date()])
      .optional()
      .refine((val) => val === undefined || validateDeliveryDeadline(val) === null, {
        message: "Delivery date must be at least 1 hour and no more than 180 days in the future",
      }),
  })
  .superRefine((data, ctx) => {
    if (isSelfEscrowAddress(data.buyerAddress, data.sellerAddress)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Buyer and seller Stellar addresses cannot be identical",
        path: ["sellerAddress"],
      });
    }
    if (data.deliveryDeadline !== undefined) {
      const deadlineError = validateDeliveryDeadline(data.deliveryDeadline);
      if (deadlineError) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: deadlineError,
          path: ["deliveryDeadline"],
        });
      }
    }
  });

export const step1Schema = createStep1Schema();

export function createStep2Schema() {
  return z.object({
    buyerRatio: z.number().min(0).max(100),
    sellerRatio: z.number().min(0).max(100),
    deliveryDays: z.string().refine(
      (val) => {
        const n = parseInt(val);
        return !isNaN(n) && n >= 1 && n <= 90;
      },
      { message: t("validation.deliveryWindowRange") }
    ),
  });
}

export const step2Schema = createStep2Schema();

export const step3Schema = z
  .object({
    commodity: z.string().min(1),
    quantity: z.string().min(1),
    unit: z.enum(COMMODITY_UNITS, { message: "Select a valid unit" }),
    pricePerUnit: z.string().min(1),
    currency: z.string().min(1),
    buyerAddress: z.string().optional(),
    sellerAddress: z.string().refine((val) => isValidStellarAddress(val), {
      message: "Invalid Stellar public key",
    }),
    buyerRatio: z.number(),
    sellerRatio: z.number(),
    deliveryDays: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (isSelfEscrowAddress(data.buyerAddress, data.sellerAddress)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Buyer and seller Stellar addresses cannot be identical",
        path: ["sellerAddress"],
      });
    }
  });

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;

export function validateStep1(
  data: Record<string, unknown>,
  buyerAddress?: string | null
): Record<string, string> {
  const payload =
    buyerAddress && !data.buyerAddress ? { ...data, buyerAddress } : data;
  const result = step1Schema.safeParse(payload);
  const errors: Record<string, string> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!errors[path]) errors[path] = issue.message;
    }
  }
  if (data.deliveryDeadline !== undefined && !errors.deliveryDeadline) {
    const deadlineError = validateDeliveryDeadline(
      data.deliveryDeadline as string | number | Date | null | undefined
    );
    if (deadlineError) errors.deliveryDeadline = deadlineError;
  }
  return errors;
}

export function validateStep2(data: { buyerRatio: number; sellerRatio: number; deliveryDays: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (data.buyerRatio + data.sellerRatio !== 100) {
    errors.sum = t("validation.lossRatiosSum");
  }
  const result = createStep2Schema().safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!errors[path]) errors[path] = issue.message;
    }
  }
  return errors;
}
