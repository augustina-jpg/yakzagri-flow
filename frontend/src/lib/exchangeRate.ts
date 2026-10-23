/**
 * Exchange rate configuration.
 * Single source of truth for NGN/cNGN conversion rates.
 *
 * The backend should provide rate quotes, but this allows for fallback values
 * and environment-based overrides for testing/offline scenarios.
 */

/**
 * Default NGN to cNGN conversion rate (fallback).
 * Source: Should be synced from backend quote endpoint.
 * This default is used when the backend is unavailable.
 */
const DEFAULT_NGN_TO_CNGN_RATE = 1580;
const DEFAULT_VALIDITY_WINDOW_MS = 5 * 60 * 1000;

export interface StructuredExchangeRateQuote {
  pair: `${string}/${string}`;
  rate: number;
  source: "backend-quote" | "env-override" | "static-fallback";
  observedAt: string;
  validityWindowMs: number;
  expiresAt: string;
}

/**
 * Get the NGN to cNGN exchange rate.
 * Reads from environment or returns the default.
 *
 * In production, this should be driven by a backend rate endpoint
 * rather than a hardcoded env value. This is a fallback mechanism.
 */
export function getNgnExchangeRate(): number {
  const envRate = process.env.NEXT_PUBLIC_NGN_EXCHANGE_RATE;
  if (envRate) {
    const rate = parseFloat(envRate);
    if (!isNaN(rate) && rate > 0) {
      return rate;
    }
  }
  return DEFAULT_NGN_TO_CNGN_RATE;
}

/**
 * Build a structured FX quote containing source, observed-at time, pair,
 * and validity window as structured application data.
 */
export function getStructuredExchangeRateQuote(
  options: {
    pair?: `${string}/${string}`;
    rate?: number;
    source?: StructuredExchangeRateQuote["source"];
    observedAt?: Date | string;
    validityWindowMs?: number;
  } = {},
): StructuredExchangeRateQuote {
  const envRate = process.env.NEXT_PUBLIC_NGN_EXCHANGE_RATE;
  const parsedEnvRate = envRate ? parseFloat(envRate) : NaN;
  const hasValidEnvRate = !isNaN(parsedEnvRate) && parsedEnvRate > 0;

  const rate = options.rate ?? (hasValidEnvRate ? parsedEnvRate : DEFAULT_NGN_TO_CNGN_RATE);
  const source: StructuredExchangeRateQuote["source"] =
    options.source ?? (hasValidEnvRate ? "env-override" : "static-fallback");
  const pair = options.pair ?? "NGN/cNGN";
  const observedDate =
    options.observedAt instanceof Date
      ? options.observedAt
      : options.observedAt
        ? new Date(options.observedAt)
        : new Date();
  const validityWindowMs = options.validityWindowMs ?? DEFAULT_VALIDITY_WINDOW_MS;
  const expiresAt = new Date(observedDate.getTime() + validityWindowMs).toISOString();

  return {
    pair,
    rate,
    source,
    observedAt: observedDate.toISOString(),
    validityWindowMs,
    expiresAt,
  };
}

/**
 * Convert cNGN to NGN using the current exchange rate.
 */
export function convertCngnToNgn(cngn: number): number {
  return Math.round(cngn * getNgnExchangeRate());
}

/**
 * Convert NGN to cNGN using the current exchange rate.
 */
export function convertNgnToCngn(ngn: number): number {
  const rate = getNgnExchangeRate();
  return rate > 0 ? ngn / rate : 0;
}
