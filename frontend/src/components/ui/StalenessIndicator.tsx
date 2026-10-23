"use client";

/**
 * StalenessIndicator — shows how fresh cached data is.
 *
 * Rendered inline next to section headings when:
 *   - `isStale` is true  →  amber "Stale" badge with elapsed time
 *   - `isOffline` is true AND data exists  →  grey "Offline" badge
 *   - data is live  →  nothing rendered (no badge)
 *
 * Usage:
 *   <StalenessIndicator isStale={isStale} cachedAt={cachedAt} isOffline={isOffline} />
 */

import { clsx } from "clsx";

interface StalenessIndicatorProps {
  isStale: boolean;
  isOffline: boolean;
  /** True when live or cached data is missing/unavailable */
  isMissing?: boolean;
  /** True when displaying an estimated payout/quote so it is never presented as guaranteed */
  isEstimate?: boolean;
  /** Unix ms timestamp from CacheEntry.cachedAt */
  cachedAt: number | null;
  className?: string;
}

function formatElapsed(ms: number): string {
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function describePayoutEstimateDisclaimer(options: {
  isStale?: boolean;
  isMissing?: boolean;
  isOffline?: boolean;
}): string {
  if (options.isMissing) {
    return "Rate data is currently missing. Any shown figure is an indicative estimate only and not a guaranteed payout.";
  }
  if (options.isStale || options.isOffline) {
    return "Showing stale or offline rate data. Figures are indicative estimates only and not a guaranteed payout.";
  }
  return "Estimated figure only — final settlement depends on on-chain execution and is not a guaranteed payout.";
}

export function StalenessIndicator({
  isStale,
  isOffline,
  isMissing = false,
  isEstimate = false,
  cachedAt,
  className,
}: StalenessIndicatorProps) {
  if (!isStale && !isOffline && !isMissing && !isEstimate) return null;

  const elapsed = cachedAt ? Date.now() - cachedAt : null;
  const label = isMissing
    ? "Data missing"
    : isOffline
      ? "Offline"
      : isStale
        ? "Stale"
        : "Estimate (not guaranteed)";
  const timeLabel = elapsed !== null ? formatElapsed(elapsed) : null;

  return (
    <span
      role="status"
      aria-label={
        isMissing
          ? "Data is missing; figures are indicative estimates and not guaranteed payouts"
          : isOffline
            ? "Showing offline cached data; figures are estimates and not guaranteed payouts"
            : isStale
              ? `Showing stale data cached ${timeLabel ?? "recently"}; figures are estimates and not guaranteed payouts`
              : "Estimated amount; not a guaranteed payout"
      }
      data-testid="staleness-indicator"
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        isMissing
          ? "bg-status-danger/10 text-status-danger border border-status-danger/20"
          : isOffline
            ? "bg-bg-elevated text-text-muted border border-border-default"
            : "bg-status-warning/10 text-status-warning border border-status-warning/20",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "h-1.5 w-1.5 rounded-full flex-shrink-0",
          isMissing
            ? "bg-status-danger"
            : isOffline
              ? "bg-text-muted"
              : "bg-status-warning",
        )}
      />
      {label}
      {timeLabel && !isOffline && !isMissing && (
        <span className="text-text-muted font-normal">· {timeLabel}</span>
      )}
      {isEstimate && (isStale || isOffline || isMissing) && (
        <span className="text-text-muted font-normal">· Estimate only (not guaranteed)</span>
      )}
    </span>
  );
}
