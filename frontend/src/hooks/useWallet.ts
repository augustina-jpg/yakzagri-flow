import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./useAuth";

interface UseWalletResult {
  balance: string | null;
  asset: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWallet(): UseWalletResult {
  const { token, isAuthenticated } = useAuth();
  const [balance, setBalance] = useState<string | null>(null);
  const [asset, setAsset] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!isAuthenticated || !token) return;

    // Abort any in-flight request before starting a new one.
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const data = await api.wallet.getBalance(token, {
        signal: controller.signal,
      });

      // Ignore stale or aborted responses.
      if (requestId !== requestIdRef.current || controller.signal.aborted) {
        return;
      }

      setBalance(data.balance);
      setAsset(data.asset);
    } catch (err) {
      // Ignore stale or aborted responses.
      if (requestId !== requestIdRef.current || controller.signal.aborted) {
        return;
      }

      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load wallet balance";
      setError(message);
    } finally {
      if (requestId === requestIdRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Reset state immediately on logout.
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      requestIdRef.current += 1;
      setBalance(null);
      setAsset(null);
      setLoading(false);
      setError(null);
      return;
    }

    void fetchBalance();

    return () => {
      // Abort in-flight request on token change or unmount.
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      requestIdRef.current += 1;
    };
  }, [fetchBalance, isAuthenticated]);

  return { balance, asset, loading, error, refetch: fetchBalance };
}