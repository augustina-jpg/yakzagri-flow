'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TransactionBuilder } from '@stellar/stellar-sdk';

const DEFAULT_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

export interface UseXdrExpiryOptions {
  /** Unsigned transaction XDR string. If provided, maxTime is parsed from it. */
  xdr?: string | null;
  /** Explicit expiration timestamp (ms since epoch). Used as fallback or override. */
  expiresAt?: number | null;
  /** Stellar network passphrase used to parse the XDR. */
  networkPassphrase?: string;
  /** Callback invoked by `refresh` to refetch the transaction / quote. */
  onRefresh?: () => void | Promise<void>;
}

export interface UseXdrExpiryResult {
  /** Remaining seconds until expiration (never negative). */
  remainingSeconds: number;
  /** Whether the transaction has expired. */
  isExpired: boolean;
  /** Re-invokes the caller-provided refetch callback. */
  refresh: () => void;
}

/**
 * Parses the maxTime timebound from an unsigned transaction XDR.
 * Returns the expiration time in milliseconds since epoch, or null if unavailable.
 */
function parseMaxTimeFromXdr(
  xdr: string,
  networkPassphrase: string,
): number | null {
  try {
    const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
    const timebounds = (tx as any)?.timeBounds;
    if (timebounds && typeof timebounds.maxTime === 'string') {
      const maxTime = Number(timebounds.maxTime);
      if (Number.isFinite(maxTime) && maxTime > 0) {
        return maxTime * 1000;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves the expiration timestamp (ms) from either the XDR's maxTime
 * or the explicit expiresAt fallback.
 */
function resolveExpiresAt(
  xdr: string | null | undefined,
  expiresAt: number | null | undefined,
  networkPassphrase: string,
): number | null {
  if (xdr) {
    const parsed = parseMaxTimeFromXdr(xdr, networkPassphrase);
    if (parsed !== null) {
      return parsed;
    }
  }
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
    return expiresAt;
  }
  return null;
}

/**
 * Hook that tracks the remaining validity time of an unsigned Stellar
 * transaction XDR (via its maxTime timebound) or an explicit expiration
 * timestamp. Ticks down once per second and exposes a `refresh` callback.
 */
export function useXdrExpiry(options: UseXdrExpiryOptions = {}): UseXdrExpiryResult {
  const {
    xdr,
    expiresAt,
    networkPassphrase = DEFAULT_NETWORK_PASSPHRASE,
    onRefresh,
  } = options;

  const resolvedExpiresAt = useMemo(
    () => resolveExpiresAt(xdr, expiresAt, networkPassphrase),
    [xdr, expiresAt, networkPassphrase],
  );

  const computeRemaining = useCallback((): number => {
    if (resolvedExpiresAt === null) {
      return 0;
    }
    const diffMs = resolvedExpiresAt - Date.now();
    return diffMs > 0 ? Math.ceil(diffMs / 1000) : 0;
  }, [resolvedExpiresAt]);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(computeRemaining);

  // Recompute immediately whenever the expiration target changes.
  useEffect(() => {
    setRemainingSeconds(computeRemaining());
  }, [computeRemaining]);

  // Tick down once per second while there is time remaining.
  useEffect(() => {
    if (resolvedExpiresAt === null) {
      return;
    }

    // If already expired, no need to start an interval.
    if (computeRemaining() <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      const next = computeRemaining();
      setRemainingSeconds(next);
      if (next <= 0) {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [resolvedExpiresAt, computeRemaining]);

  const isExpired = resolvedExpiresAt !== null && remainingSeconds <= 0;

  const refresh = useCallback(() => {
    if (onRefresh) {
      void onRefresh();
    }
  }, [onRefresh]);

  return { remainingSeconds, isExpired, refresh };
}

/**
 * Formats remaining seconds as "M:SS".
 */
function formatRemaining(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export interface XdrCountdownBadgeProps extends UseXdrExpiryOptions {
  /** Optional className applied to the badge container. */
  className?: string;
  /** Optional label for the refresh button. */
  refreshLabel?: string;
}

/**
 * Live countdown badge showing remaining validity time for a prepared XDR
 * transaction. Once expired, renders a "Refresh Transaction" button.
 */
export function XdrCountdownBadge({
  className,
  refreshLabel = 'Refresh Transaction',
  ...options
}: XdrCountdownBadgeProps) {
  const { remainingSeconds, isExpired, refresh } = useXdrExpiry(options);

  // Keep a stable reference to the latest refresh for the button handler.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const handleRefresh = useCallback(() => {
    refreshRef.current();
  }, []);

  if (isExpired) {
    return (
      <div
        className={className}
        data-testid="xdr-countdown-badge"
        data-expired="true"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <span
          className="xdr-countdown-badge__expired"
          style={{ color: '#b91c1c', fontWeight: 600 }}
        >
          Transaction expired
        </span>
        <button
          type="button"
          onClick={handleRefresh}
          className="xdr-countdown-badge__refresh"
          data-testid="xdr-refresh-button"
        >
          {refreshLabel}
        </button>
      </div>
    );
  }

  return (
    <div
      className={className}
      data-testid="xdr-countdown-badge"
      data-expired="false"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
    >
      <span className="xdr-countdown-badge__time">
        Expires in {formatRemaining(remainingSeconds)}
      </span>
    </div>
  );
}

export default useXdrExpiry;