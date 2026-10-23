/**
 * Centralized locale-aware formatters. Every user-facing money / date / number
 * string should come from here so NGN + en-NG conventions are applied
 * consistently instead of ad-hoc `toLocaleString("en-US")` calls.
 */
import {
  DEFAULT_CURRENCY,
  intlLocale,
  resolveLocale,
  type Locale,
} from "./config";
import { readSavedCurrency } from "@/lib/preferences";

type Numeric = number | string | bigint;

function toNumber(value: Numeric): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "bigint"
        ? Number(value)
        : Number(value.trim());
  if (!Number.isFinite(n)) {
    throw new RangeError(`Expected a finite number, received: ${String(value)}`);
  }
  return n;
}

export interface MoneyOptions {
  currency?: string;
  locale?: Locale;
  /** Drop the fraction when the amount is a whole number (e.g. ₦1,200). */
  compactFraction?: boolean;
}

/** Format a decimal amount as currency. Default: `₦1,234.56`. */
export function formatMoney(amount: Numeric, options: MoneyOptions = {}): string {
  const {
    locale = resolveLocale(),
    compactFraction = false,
  } = options;
  const currency = options.currency ?? readSavedCurrency() ?? DEFAULT_CURRENCY;
  const value = toNumber(amount);
  const fractionDigits =
    compactFraction && Number.isInteger(value) ? 0 : 2;
  if (currency === "cNGN") {
    return `${new Intl.NumberFormat(intlLocale(locale), {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: 2,
    }).format(value)} cNGN`;
  }
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Nigerian Naira shorthand — `₦1,234.56`. */
export function formatNaira(
  amount: Numeric,
  options: Omit<MoneyOptions, "currency"> = {},
): string {
  return formatMoney(amount, { ...options, currency: "NGN" });
}

/** Plain grouped number — `1,234.5` — honouring the active locale. */
export function formatNumber(
  value: Numeric,
  options: {
    locale?: Locale;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {},
): string {
  const {
    locale = resolveLocale(),
    minimumFractionDigits = 0,
    maximumFractionDigits = 7,
  } = options;
  return new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(toNumber(value));
}

function toDate(value: Date | string | number): Date {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError(`Invalid date: ${String(value)}`);
  }
  return d;
}

/** `29 Aug 2026` by default (en-NG day-month-year order). */
export function formatDate(
  value: Date | string | number,
  options: { locale?: Locale; dateStyle?: Intl.DateTimeFormatOptions["dateStyle"] } = {},
): string {
  const { locale = resolveLocale(), dateStyle = "medium" } = options;
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle }).format(
    toDate(value),
  );
}

/** `29 Aug 2026, 14:30`. */
export function formatDateTime(
  value: Date | string | number,
  options: { locale?: Locale } = {},
): string {
  const { locale = resolveLocale() } = options;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(toDate(value));
}

const RELATIVE_DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: "seconds" },
  { amount: 60, unit: "minutes" },
  { amount: 24, unit: "hours" },
  { amount: 7, unit: "days" },
  { amount: 4.34524, unit: "weeks" },
  { amount: 12, unit: "months" },
  { amount: Number.POSITIVE_INFINITY, unit: "years" },
];

export interface RelativeTimeOptions {
  locale?: Locale;
  now?: Date | string | number;
  style?: Intl.RelativeTimeFormatStyle;
  numeric?: Intl.RelativeTimeFormatNumeric;
}

/** `3 days ago` / `in 2 hours` using Intl.RelativeTimeFormat. */
export function formatRelativeTime(
  value: Date | string | number,
  options: RelativeTimeOptions = {},
): string {
  const {
    locale = resolveLocale(),
    now = new Date(),
    style = "long",
    numeric = "auto",
  } = options;
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric, style });
  const targetTime = toDate(value).getTime();
  const baseTime = toDate(now).getTime();
  let duration = (targetTime - baseTime) / 1000;
  if (Math.abs(duration) < 1) {
    return rtf.format(0, "seconds");
  }
  for (const division of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return rtf.format(Math.round(duration), "years");
}

export interface ApplicationCitationRecord {
  id: string;
  label: string;
  url: string;
  observedAt?: Date | string | number;
}

export interface RenderedCitation {
  id: string;
  label: string;
  href: string;
  relativeObservedAt?: string;
}

/**
 * Render citations strictly from verified application data records.
 * Never allows model output to invent or override source URLs.
 */
export function renderCitationsFromApplicationData(
  requestedCitationIds: readonly string[],
  applicationCatalog: ReadonlyMap<string, ApplicationCitationRecord> | readonly ApplicationCitationRecord[],
  options: { locale?: Locale; now?: Date } = {},
): RenderedCitation[] {
  const lookupMap =
    applicationCatalog instanceof Map
      ? applicationCatalog
      : new Map(
          (applicationCatalog as readonly ApplicationCitationRecord[]).map((item) => [
            item.id,
            item,
          ]),
        );

  const rendered: RenderedCitation[] = [];
  const seen = new Set<string>();

  for (const id of requestedCitationIds) {
    if (seen.has(id)) continue;
    const record = lookupMap.get(id);
    if (!record) continue;
    try {
      const parsed = new URL(record.url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
      seen.add(id);
      rendered.push({
        id: record.id,
        label: record.label,
        href: parsed.toString(),
        relativeObservedAt:
          record.observedAt !== undefined
            ? formatRelativeTime(record.observedAt, options)
            : undefined,
      });
    } catch {
      // Ignore malformed application URLs; never synthesize fallback URLs.
    }
  }

  return rendered;
}
