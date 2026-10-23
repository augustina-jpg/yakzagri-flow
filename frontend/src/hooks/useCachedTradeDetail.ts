"use client";

/**
 * Stale-while-revalidate hook for a single trade detail.
 *
 * Replaces the bare `useTradeDetail` hook with an offline-capable version.
 * The original hook continues to work for callers that do not need offline
 * support; this one is used on the trade detail page.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useOffline } from "./useOffline";
import { useAuth } from "./useAuth";
import { api, ApiError } from "@/lib/api";
import {
  cacheRead,
  cacheWrite,
  cacheInvalidate,
} from "@/lib/offlineCache";
import type { TradeResponse } from "@/lib/api/types";

const DOMAIN = "trade_detail" as const;

const TRADE_STATUS_ORDER: Record<string, number> = {
  draft: 0,
  created: 1,
  pending: 1,
  funded: 2,
  locked: 2,
  active: 3,
  "in-transit": 3,
  delivered: 4,
  disputed: 4,
  resolved: 5,
  settled: 6,
  completed: 6,
  cancelled: 6,
};

export interface TradeVersionConflict {
  tradeId: string;
  cachedStatus: string;
  serverStatus: string;
  cachedUpdatedAt?: string;
  serverUpdatedAt?: string;
  detectedAt: number;
}

export function detectTradeVersionConflict(
  cachedTrade: TradeResponse | null,
  serverTrade: TradeResponse,
): TradeVersionConflict | null {
  if (!cachedTrade || cachedTrade.tradeId !== serverTrade.tradeId) return null;

  const cachedTime = cachedTrade.updatedAt ? Date.parse(cachedTrade.updatedAt) : NaN;
  const serverTime = serverTrade.updatedAt ? Date.parse(serverTrade.updatedAt) : NaN;
  const isOlderTimestamp =
    Number.isFinite(cachedTime) && Number.isFinite(serverTime) && cachedTime < serverTime;

  const cachedRank = TRADE_STATUS_ORDER[cachedTrade.status.toLowerCase()] ?? -1;
  const serverRank = TRADE_STATUS_ORDER[serverTrade.status.toLowerCase()] ?? -1;
  const isOlderStatus =
    cachedTrade.status !== serverTrade.status &&
    (isOlderTimestamp || (cachedRank >= 0 && serverRank > cachedRank));

  if (!isOlderStatus && !isOlderTimestamp) return null;
  if (cachedTrade.status === serverTrade.status && !isOlderTimestamp) return null;

  return {
    tradeId: serverTrade.tradeId,
    cachedStatus: cachedTrade.status,
    serverStatus: serverTrade.status,
    cachedUpdatedAt: cachedTrade.updatedAt,
    serverUpdatedAt: serverTrade.updatedAt,
    detectedAt: Date.now(),
  };
}

export interface UseCachedTradeDetailResult {
  trade: TradeResponse | null;
  isLoading: boolean;
  isStale: boolean;
  cachedAt: number | null;
  hasConflict: boolean;
  conflict: TradeVersionConflict | null;
  dismissConflict: () => void;
  error: string | null;
  refetch: () => void;
  invalidateAndRefetch: () => void;
}

export function useCachedTradeDetail(
  tradeId: string,
): UseCachedTradeDetailResult {
  const { isOffline } = useOffline();
  const { token, isAuthenticated } = useAuth();

  const initialRead = cacheRead<TradeResponse>(DOMAIN, tradeId);
  const [trade, setTrade] = useState<TradeResponse | null>(
    initialRead.entry?.data ?? null,
  );
  const [isStale, setIsStale] = useState(initialRead.isStale);
  const [cachedAt, setCachedAt] = useState<number | null>(
    initialRead.entry?.cachedAt ?? null,
  );
  const [conflict, setConflict] = useState<TradeVersionConflict | null>(null);
  const [isLoading, setIsLoading] = useState(initialRead.isMiss);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const fetchFresh = useCallback(async () => {
    if (!isAuthenticated || !token || isOffline || fetchingRef.current) return;

    fetchingRef.current = true;
    setError(null);

    try {
      const priorCached = cacheRead<TradeResponse>(DOMAIN, tradeId).entry?.data ?? null;
      const fresh = await api.trades.get(token, tradeId);
      const detectedConflict = detectTradeVersionConflict(priorCached, fresh);
      if (detectedConflict) {
        setConflict(detectedConflict);
      }
      cacheWrite(DOMAIN, tradeId, fresh);
      setTrade(fresh);
      setIsStale(false);
      setCachedAt(Date.now());
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load trade";
      setError(msg);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [isAuthenticated, token, isOffline, tradeId]);

  // Re-read cache when tradeId changes
  useEffect(() => {
    const read = cacheRead<TradeResponse>(DOMAIN, tradeId);
    setConflict(null);
    if (read.entry) {
      setTrade(read.entry.data);
      setIsStale(read.isStale);
      setCachedAt(read.entry.cachedAt);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
  }, [tradeId]);

  useEffect(() => {
    if (!isOffline && isAuthenticated && token) {
      void fetchFresh();
    }
  }, [isOffline, isAuthenticated, token, fetchFresh]);

  const refetch = useCallback(() => void fetchFresh(), [fetchFresh]);

  const dismissConflict = useCallback(() => setConflict(null), []);

  const invalidateAndRefetch = useCallback(() => {
    cacheInvalidate(DOMAIN, tradeId);
    setTrade(null);
    setConflict(null);
    setIsLoading(true);
    setIsStale(false);
    setCachedAt(null);
    void fetchFresh();
  }, [fetchFresh, tradeId]);

  return {
    trade,
    isLoading,
    isStale,
    cachedAt,
    hasConflict: conflict !== null,
    conflict,
    dismissConflict,
    error,
    refetch,
    invalidateAndRefetch,
  };
}
