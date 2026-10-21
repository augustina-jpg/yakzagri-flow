'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { t as translateCopy } from "@/lib/i18n";
import Image from 'next/image';
import { BentoCard } from "@/components/ui/BentoCard";
import { NetworkIcon } from "@/components/icons";
import StellarLogo from '../../app/assets/StellarLogo.png';

export type RpcHealthStatus = 'healthy' | 'degraded' | 'unreachable';

export const RPC_LATENCY_THRESHOLD_MS = 1000;
export const RPC_PROBE_TIMEOUT_MS = 5000;

interface NetworkBackboneCardProps {
  description: string;
  /** Optional override for the RPC endpoint. Defaults to NEXT_PUBLIC_RPC_URL. */
  rpcUrl?: string;
}

interface ProbeResult {
  status: RpcHealthStatus;
  latencyMs: number | null;
  latestLedger: number | null;
}

/**
 * Derives the RPC health status from a probe outcome.
 * - 'healthy': request succeeded and latency is below the threshold.
 * - 'degraded': request succeeded but was slow, or a transient/parse error occurred.
 * - 'unreachable': the fetch failed or timed out.
 */
export function deriveRpcStatus(params: {
  ok: boolean;
  latencyMs: number | null;
  timedOut?: boolean;
  transientError?: boolean;
}): RpcHealthStatus {
  const { ok, latencyMs, timedOut, transientError } = params;
  if (timedOut) return 'unreachable';
  if (!ok) return transientError ? 'degraded' : 'unreachable';
  if (latencyMs === null) return 'degraded';
  return latencyMs < RPC_LATENCY_THRESHOLD_MS ? 'healthy' : 'degraded';
}

const STATUS_STYLES: Record<RpcHealthStatus, { text: string; dot: string; label: string }> = {
  healthy: {
    text: 'text-status-success',
    dot: 'bg-status-success',
    label: 'Healthy',
  },
  degraded: {
    text: 'text-status-warning',
    dot: 'bg-status-warning',
    label: 'Degraded',
  },
  unreachable: {
    text: 'text-status-danger',
    dot: 'bg-status-danger',
    label: 'Unreachable',
  },
};

export function NetworkBackboneCard({ description, rpcUrl }: NetworkBackboneCardProps) {
  const resolvedRpcUrl =
    rpcUrl ?? process.env.NEXT_PUBLIC_RPC_URL ?? '';

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const mountedRef = useRef(true);

  const probe = useCallback(async () => {
    setLoading(true);

    if (!resolvedRpcUrl) {
      if (mountedRef.current) {
        setResult({ status: 'unreachable', latencyMs: null, latestLedger: null });
        setLoading(false);
      }
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RPC_PROBE_TIMEOUT_MS);
    const start = performance.now();

    try {
      const response = await fetch(resolvedRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getLatestLedger',
        }),
        signal: controller.signal,
      });

      const latencyMs = Math.round(performance.now() - start);

      if (!response.ok) {
        if (mountedRef.current) {
          setResult({
            status: deriveRpcStatus({ ok: false, latencyMs, transientError: true }),
            latencyMs,
            latestLedger: null,
          });
          setLoading(false);
        }
        return;
      }

      let latestLedger: number | null = null;
      let parseFailed = false;
      try {
        const data = await response.json();
        const sequence = data?.result?.sequence;
        if (typeof sequence === 'number') {
          latestLedger = sequence;
        } else if (typeof sequence === 'string' && sequence.trim() !== '') {
          const parsed = Number(sequence);
          latestLedger = Number.isFinite(parsed) ? parsed : null;
        }
        if (data?.error) {
          parseFailed = true;
        }
      } catch {
        parseFailed = true;
      }

      if (mountedRef.current) {
        setResult({
          status: deriveRpcStatus({
            ok: !parseFailed,
            latencyMs,
            transientError: parseFailed,
          }),
          latencyMs,
          latestLedger,
        });
        setLoading(false);
      }
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      const timedOut =
        error instanceof DOMException && error.name === 'AbortError';
      if (mountedRef.current) {
        setResult({
          status: deriveRpcStatus({ ok: false, latencyMs, timedOut }),
          latencyMs: timedOut ? null : latencyMs,
          latestLedger: null,
        });
        setLoading(false);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }, [resolvedRpcUrl]);

  useEffect(() => {
    mountedRef.current = true;
    void probe();
    return () => {
      mountedRef.current = false;
    };
  }, [probe]);

  const status = result?.status ?? null;
  const statusStyle = status ? STATUS_STYLES[status] : null;

  return (
    <BentoCard
      title={translateCopy("ui.network_backbone_f04feb3")}
      icon={<NetworkIcon className="w-5 h-5" />}
      glowVariant="gold"
      className="h-full"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col gap-3 max-w-xl">
          <p className="text-sm text-text-secondary leading-relaxed">
            {description}
          </p>

          <div
            className="flex flex-col gap-2 text-sm"
            data-testid="rpc-health"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <span className="text-text-secondary">
                {translateCopy("ui.rpc_status")}
              </span>
              {loading ? (
                <span
                  className="flex items-center gap-2 text-text-secondary"
                  data-testid="rpc-status-loading"
                >
                  <span className="h-2 w-2 rounded-full bg-text-secondary animate-pulse" />
                  Probing…
                </span>
              ) : statusStyle && status ? (
                <span
                  className={`flex items-center gap-2 font-medium ${statusStyle.text}`}
                  data-testid="rpc-status"
                  data-status={status}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${statusStyle.dot}`}
                    aria-hidden="true"
                  />
                  {statusStyle.label}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-text-secondary">
                {translateCopy("ui.latest_ledger")}
              </span>
              <span
                className="font-mono text-text-primary"
                data-testid="rpc-latest-ledger"
              >
                {loading
                  ? '—'
                  : result?.latestLedger != null
                    ? result.latestLedger.toLocaleString()
                    : '—'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-text-secondary">
                {translateCopy("ui.rpc_latency")}
              </span>
              <span
                className="font-mono text-text-primary"
                data-testid="rpc-latency"
              >
                {loading
                  ? '—'
                  : result?.latencyMs != null
                    ? `${result.latencyMs} ms`
                    : '—'}
              </span>
            </div>

            {!loading && status === 'unreachable' && (
              <button
                type="button"
                onClick={() => void probe()}
                className="self-start mt-1 rounded-md border border-border px-3 py-1 text-xs font-medium text-text-primary hover:bg-surface-hover transition-colors"
                data-testid="rpc-retry"
              >
                {translateCopy("ui.retry")}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-8">
          <Image
            src={StellarLogo}
            alt={translateCopy("ui.stellar_logo_9277136")}
          />
        </div>
      </div>
    </BentoCard>
  );
}