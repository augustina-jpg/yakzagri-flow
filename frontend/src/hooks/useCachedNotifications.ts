"use client";

/**
 * Stale-while-revalidate hook for notification preferences / notification list.
 *
 * The notifications domain has a shorter TTL (2 min) because staleness is
 * most visible here. The hook is intentionally generic over the payload shape
 * so it can serve both the notification preferences endpoint and any future
 * notification feed endpoint without a rewrite.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useOffline } from "./useOffline";
import { useAuth } from "./useAuth";
import { request, ApiError } from "@/lib/api/client";
import {
  cacheRead,
  cacheWrite,
  cacheInvalidate,
} from "@/lib/offlineCache";

const DOMAIN = "notifications" as const;
const LAST_SYNCED_STORAGE_PREFIX = "amana:notifications:last-synced:";

function readPersistedLastSynced(cacheKey: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${LAST_SYNCED_STORAGE_PREFIX}${cacheKey}`);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writePersistedLastSynced(cacheKey: string, timestamp: number | null): void {
  if (typeof window === "undefined") return;
  try {
    const key = `${LAST_SYNCED_STORAGE_PREFIX}${cacheKey}`;
    if (timestamp === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, String(timestamp));
    }
  } catch {
    // Ignore storage errors in restricted contexts.
  }
}

export function formatLastSyncedLabel(timestamp: number | null): string {
  if (!timestamp) return "Not synced yet — data may be missing";
  const elapsedMs = Math.max(0, Date.now() - timestamp);
  if (elapsedMs < 60_000) return "Last synced just now";
  const mins = Math.floor(elapsedMs / 60_000);
  if (mins < 60) return `Last synced ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `Last synced ${hrs}h ago`;
}

export interface UseCachedNotificationsOptions<T> {
  /** API endpoint to fetch, e.g. "/notifications/preferences". */
  endpoint: string;
  /** Cache key — defaults to endpoint. */
  cacheKey?: string;
}

export interface UseCachedNotificationsResult<T> {
  data: T | null;
  isLoading: boolean;
  isStale: boolean;
  cachedAt: number | null;
  lastSyncedAt: number | null;
  lastSyncedLabel: string;
  error: string | null;
  refetch: () => void;
  invalidateAndRefetch: () => void;
}

export function useCachedNotifications<T>(
  options: UseCachedNotificationsOptions<T>,
): UseCachedNotificationsResult<T> {
  const { endpoint, cacheKey = endpoint } = options;
  const { isOffline } = useOffline();
  const { token, isAuthenticated } = useAuth();

  const initialRead = cacheRead<T>(DOMAIN, cacheKey);
  const initialTimestamp =
    initialRead.entry?.cachedAt ?? readPersistedLastSynced(cacheKey);
  const [data, setData] = useState<T | null>(
    initialRead.entry?.data ?? null,
  );
  const [isStale, setIsStale] = useState(initialRead.isStale);
  const [cachedAt, setCachedAt] = useState<number | null>(initialTimestamp);
  const [isLoading, setIsLoading] = useState(initialRead.isMiss);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const fetchFresh = useCallback(async () => {
    if (!isAuthenticated || !token || isOffline || fetchingRef.current) return;

    fetchingRef.current = true;
    setError(null);

    try {
      const fresh = await request<T>(endpoint, { token });
      const now = Date.now();
      cacheWrite(DOMAIN, cacheKey, fresh);
      writePersistedLastSynced(cacheKey, now);
      setData(fresh);
      setIsStale(false);
      setCachedAt(now);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load notifications";
      setError(msg);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [isAuthenticated, token, isOffline, endpoint, cacheKey]);

  useEffect(() => {
    const read = cacheRead<T>(DOMAIN, cacheKey);
    if (read.entry) {
      setData(read.entry.data);
      setIsStale(read.isStale);
      setCachedAt(read.entry.cachedAt);
      setIsLoading(false);
    } else {
      setCachedAt(readPersistedLastSynced(cacheKey));
      setIsLoading(true);
    }
  }, [cacheKey]);

  useEffect(() => {
    if (!isOffline && isAuthenticated && token) {
      void fetchFresh();
    }
  }, [isOffline, isAuthenticated, token, fetchFresh]);

  const refetch = useCallback(() => void fetchFresh(), [fetchFresh]);

  const invalidateAndRefetch = useCallback(() => {
    cacheInvalidate(DOMAIN, cacheKey);
    writePersistedLastSynced(cacheKey, null);
    setData(null);
    setIsLoading(true);
    setIsStale(false);
    setCachedAt(null);
    void fetchFresh();
  }, [fetchFresh, cacheKey]);

  return {
    data,
    isLoading,
    isStale,
    cachedAt,
    lastSyncedAt: cachedAt,
    lastSyncedLabel: formatLastSyncedLabel(cachedAt),
    error,
    refetch,
    invalidateAndRefetch,
  };
}
