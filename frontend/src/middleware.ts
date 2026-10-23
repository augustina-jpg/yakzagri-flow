import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getApiBaseUrl, getStellarRpcUrl } from "@/lib/api/env";

/**
 * Origins allowed to be embedded as frames and connected to (wallet providers).
 * Drives both `connect-src` and `frame-src` below.
 *
 * Wallet-frame exemption process: third-party wallet UIs that must be
 * embedded in an iframe (e.g. a hosted signing widget) should be added to
 * this allowlist rather than relaxing the policy ad-hoc. Requires security
 * sign-off before merging an addition. See frontend/docs/security.md.
 */
const WALLET_FRAME_ALLOWLIST = [
  "https://walletconnect.com",
  "https://*.walletconnect.com",
  "https://verify.walletconnect.com",
  "https://*.walletconnect.org",
];

/**
 * IPFS/storage origins used for video proof upload and playback.
 * `gateway.pinata.cloud` serves pinned proof videos; `api.pinata.cloud`
 * receives the upload from VideoUploadCard.
 */
const IPFS_MEDIA_ORIGINS = [
  "https://gateway.pinata.cloud",
  "https://*.mypinata.cloud",
  "https://ipfs.io",
  "https://*.ipfs.io",
];

const CSP_HEADER = "Content-Security-Policy";

/**
 * Build the Content-Security-Policy for a given request.
 *
 * Per-request nonce strategy: `middleware` generates a fresh nonce for every
 * request and passes it to `buildCsp`, which emits it in `script-src` as
 * `'nonce-<value>'` alongside `'strict-dynamic'`. The same nonce is exposed to
 * the app via the `x-nonce` request/response header so server components can
 * attach it to inline scripts. See frontend/docs/security.md.
 *
 * PoD video (issue #127): the in-browser recorder captures via
 * getUserMedia/MediaRecorder and plays back the recorded clip from a
 * `blob:` object URL. `media-src` therefore allows `blob:` (and `'self'`
 * for any same-origin media), and the Permissions-Policy below grants
 * `camera`/`microphone` to same-origin so the recorder can request them.
 */
export function buildCsp(nonce: string): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "https:"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "media-src": ["'self'", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": buildConnectSrc(),
    "frame-src": buildFrameSrc(),
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "frame-ancestors": "'none'",
    "upgrade-insecure-requests": "",
    "report-uri": "/api/csp-report",
  };

  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values}` : name))
    .join("; ");
}

export function buildConnectSrc(): string[] {
  const sources = new Set([
    "'self'",
    ...WALLET_FRAME_ALLOWLIST,
    ...IPFS_MEDIA_ORIGINS,
  ]);

  for (const raw of [getApiBaseUrl(), getStellarRpcUrl()]) {
    try {
      sources.add(new URL(raw).origin);
    } catch {
      // Ignore relative or unparsable endpoint values.
    }
  }

  for (const source of Array.from(sources)) {
    if (source.startsWith("https://")) {
      sources.add(`wss://${source.slice("https://".length)}`);
    } else if (source.startsWith("http://")) {
      sources.add(`ws://${source.slice("http://".length)}`);
    }
  }

  return Array.from(sources).join(" ");
}

export function buildFrameSrc(): string[] {
  const configuredOrigins = (process.env.WALLET_FRAME_ALLOWLIST ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return ["'self'", ...WALLET_FRAME_ALLOWLIST, ...configuredOrigins].join(" ");
}

/**
 * Apply the defense-in-depth security headers that pair with the CSP rollout.
 * Exported so tests can assert the exact header values without spinning up
 * the full Next.js runtime.
 */
export function applySecurityHeaders(headers: Headers): void {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(), payment=()",
  );
}

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID().replace(/-/g, "")).toString("base64");
  const csp = buildCsp(nonce);
  const enforce = process.env.CSP_ENFORCE === "true";
  const headerName = enforce
    ? CSP_HEADER
    : "Content-Security-Policy-Report-Only";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set(headerName, csp);
  response.headers.set("x-nonce", nonce);

  // Defense-in-depth headers that pair naturally with the CSP rollout.
  applySecurityHeaders(response.headers);

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
