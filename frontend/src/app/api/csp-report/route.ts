import { NextRequest, NextResponse } from "next/server";

/**
 * CSP violation telemetry endpoint (issue #202).
 *
 * The browser POSTs a violation report here (either the legacy
 * `application/csp-report` shape from `report-uri`, or the newer Reporting
 * API `application/reports+json` shape) whenever a request violates the
 * Content-Security-Policy set in `src/middleware.ts`. Reports are logged
 * server-side so violation volume/severity can be reviewed during the
 * report-only burn-in period before CSP_ENFORCE is flipped to `true`.
 *
 * Hardening (issue #285):
 * - Reject payloads larger than 16KB with 413.
 * - Reject malformed JSON / wrong-shape reports with 400.
 * - Sanitize logged fields to prevent log-injection attacks.
 * - Apply a lightweight per-client rate limit with 429 responses.
 */

const MAX_PAYLOAD_BYTES = 16 * 1024;

// Lightweight in-memory rate limiter. Best-effort only: per-instance state,
// which is acceptable for a report-only telemetry sink.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Strip control characters (including CR/LF) and cap length so untrusted
 * report fields cannot forge log lines.
 */
function sanitize(value: unknown, maxLength = 512): string {
  if (value === undefined || value === null) return "";
  const raw = typeof value === "string" ? value : String(value);
  // eslint-disable-next-line no-control-regex -- intentional: strip control chars
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractViolation(report: unknown): Record<string, unknown> | null {
  if (!isPlainObject(report)) return null;
  const candidate = report["csp-report"] ?? report.body ?? report;
  return isPlainObject(candidate) ? candidate : null;
}

export async function POST(request: NextRequest) {
  if (isRateLimited(clientKey(request))) {
    return new NextResponse(null, { status: 429 });
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_PAYLOAD_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const reports = Array.isArray(body) ? body : [body];
  if (reports.length === 0) {
    return new NextResponse(null, { status: 400 });
  }

  for (const report of reports) {
    const violation = extractViolation(report);
    if (!violation) {
      return new NextResponse(null, { status: 400 });
    }

    const sanitized = {
      documentUri: sanitize(violation["document-uri"] ?? violation.documentURL),
      violatedDirective: sanitize(
        violation["violated-directive"] ?? violation.effectiveDirective,
      ),
      blockedUri: sanitize(violation["blocked-uri"] ?? violation.blockedURL),
      sourceFile: sanitize(violation["source-file"] ?? violation.sourceFile),
      lineNumber: sanitize(violation["line-number"] ?? violation.lineNumber, 16),
    };

    // eslint-disable-next-line no-console -- intentional: this is the CSP violation sink
    console.warn("[csp-violation]", JSON.stringify(sanitized));
  }

  return new NextResponse(null, { status: 204 });
}
