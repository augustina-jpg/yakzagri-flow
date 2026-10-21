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
 * Ordered IPFS gateway base URLs used to resolve `ipfs://` / CID evidence links.
 *
 * The first entry can be overridden via `NEXT_PUBLIC_IPFS_GATEWAY`; the rest are
 * public fallbacks tried in order when the primary gateway is slow or rate-limited.
 */
export const IPFS_GATEWAYS: string[] = [
  process.env.NEXT_PUBLIC_IPFS_GATEWAY?.trim() || "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
].map((g) => (g.endsWith("/") ? g : `${g}/`));

const CID_V0 = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
const CID_V1 = /^b[a-z2-7]{58,}$/i;

/** Extract a bare IPFS CID from an `ipfs://` URL, gateway URL or raw CID string. */
export function extractIpfsCid(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("ipfs://")) {
    const rest = trimmed.slice("ipfs://".length).replace(/^ipfs\//, "");
    const cid = rest.split(/[/?#]/)[0];
    return cid || null;
  }

  if (CID_V0.test(trimmed) || CID_V1.test(trimmed)) return trimmed;

  // Gateway URL: .../ipfs/<cid>[/...]
  const m = trimmed.match(/\/ipfs\/([^/?#]+)/);
  if (m) return m[1] || null;

  return null;
}

/** Build a gateway URL for `cid` using the gateway at `gatewayIndex` (null if out of range). */
export function buildIpfsGatewayUrl(cid: string, gatewayIndex = 0): string | null {
  if (!cid) return null;
  const gateway = IPFS_GATEWAYS[gatewayIndex];
  if (!gateway) return null;
  return `${gateway}${encodeURIComponent(cid)}`;
}
