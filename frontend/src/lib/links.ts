/**
 * Web <-> mobile deep-link mapping (issue #261).
 *
 * Mirror of `mobile/src/constants/links.ts`. The web app owns the canonical
 * URLs; the mobile app claims `/trades/*` and `/disputes/*` via universal /
 * app links (see frontend/public/.well-known/*). Keep the two tables in sync.
 */

export const APP_SCHEME = "amanavault";
export const WEB_ORIGIN = "https://amanavault.app";

export type DeepLinkScreen =
  | "TradeDetail"
  | "DisputeDetail"
  | "EvidenceCapture"
  | "TradeList"
  | "CreateTrade";

interface LinkRoute {
  screen: DeepLinkScreen;
  /** Web path matcher. */
  match: RegExp;
  /** Build the custom-scheme URL the mobile app understands. */
  toAppUrl: (params: Record<string, string>) => string;
  toParams: (m: RegExpMatchArray) => Record<string, string>;
}

const ROUTES: LinkRoute[] = [
  {
    screen: "TradeDetail",
    match: /^\/trades\/([^/?#]+)\/?$/,
    toParams: (m) => ({ tradeId: decodeURIComponent(m[1]) }),
    toAppUrl: (p) => `${APP_SCHEME}://trades/${encodeURIComponent(p.tradeId)}`,
  },
  {
    screen: "DisputeDetail",
    match: /^\/disputes\/([^/?#]+)\/?$/,
    toParams: (m) => ({ id: decodeURIComponent(m[1]) }),
    toAppUrl: (p) => `${APP_SCHEME}://disputes/${encodeURIComponent(p.id)}`,
  },
  {
    screen: "EvidenceCapture",
    match: /^\/trades\/([^/?#]+)\/evidence\/?$/,
    toParams: (m) => ({ tradeId: decodeURIComponent(m[1]) }),
    toAppUrl: (p) => `${APP_SCHEME}://evidence/${encodeURIComponent(p.tradeId)}`,
  },
  {
    screen: "TradeList",
    match: /^\/trades\/?$/,
    toParams: () => ({}),
    toAppUrl: () => `${APP_SCHEME}://trades`,
  },
];

/** Web URL for a trade, used for share links and the "open in app" affordance. */
export function webUrlForTrade(tradeId: string): string {
  return `${WEB_ORIGIN}/trades/${encodeURIComponent(tradeId)}`;
}

/** Stellar network the frontend is configured against. */
export type StellarNetwork = "testnet" | "mainnet";

const STELLAR_EXPLORER_BASE: Record<StellarNetwork, string> = {
  testnet: "https://stellar.expert/explorer/testnet",
  mainnet: "https://stellar.expert/explorer/public",
};

/**
 * Resolve the active Stellar network from the public env var
 * (`NEXT_PUBLIC_STELLAR_NETWORK`), defaulting to testnet.
 */
export function stellarNetwork(): StellarNetwork {
  const raw = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "").trim().toLowerCase();
  return raw === "mainnet" || raw === "public" ? "mainnet" : "testnet";
}

/**
 * Explorer URL for a Stellar transaction hash, so the trade detail page can
 * render a clickable link once a Soroban transaction is confirmed.
 */
export function stellarExplorerTxUrl(
  hash: string,
  network: StellarNetwork = stellarNetwork(),
): string {
  return `${STELLAR_EXPLORER_BASE[network]}/tx/${encodeURIComponent(hash)}`;
}

/** Deep (custom-scheme) URL for the current web path, or null if not mappable. */
export function appUrlForPath(pathname: string): string | null {
  for (const route of ROUTES) {
    const m = pathname.match(route.match);
    if (m) return route.toAppUrl(route.toParams(m));
  }
  return null;
}

/** Which app screen a web path corresponds to (null = not a deep-linkable page). */
export function screenForPath(pathname: string): DeepLinkScreen | null {
  return ROUTES.find((r) => r.match.test(pathname))?.screen ?? null;
}

/**
 * Whether the app is running in a development environment. Read lazily so the
 * check reflects the current runtime (and stays testable via env stubs).
 */
function isDevEnvironment(): boolean {
  try {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env;
    return env?.MODE === "development" || env?.DEV === "true";
  } catch {
    return false;
  }
}

/**
 * Sanitize an external URL so it is safe to use as an `href`.
 *
 * Only `https://` URLs are permitted. In development, `http://localhost`
 * (and `http://127.0.0.1`) are also allowed for local tooling. Everything
 * else — including `javascript:`, `data:`, `vbscript:`, `file:`, and any
 * obfuscated variants (mixed case, embedded whitespace/control characters,
 * leading/trailing junk) — is rejected.
 *
 * Returns the normalized URL string when allowed, or `null` when rejected.
 */
export function sanitizeExternalUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;

  // Strip leading/trailing whitespace and any embedded control characters
  // (e.g. "java\tscript:", "java\nscript:") that browsers may ignore.
  const trimmed = raw.trim().replace(/[\u0000-\u001F\u007F\s]+/g, "");
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const protocol = parsed.protocol.toLowerCase();

  if (protocol === "https:") {
    return parsed.toString();
  }

  if (protocol === "http:" && isDevEnvironment()) {
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
      return parsed.toString();
    }
  }

  return null;
}
