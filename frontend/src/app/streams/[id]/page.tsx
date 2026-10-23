"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { api, type StreamRemainingResponse, ApiError } from "@/lib/api";
import { Breadcrumbs, LoadingState, ErrorState } from "@/components/ui";
import { StalenessIndicator } from "@/components/ui/StalenessIndicator";
import {
  getAssetInfo,
  stroopsToAmount,
} from "@/lib/stellar/assets";

export default function StreamDetailPage() {
  const params = useParams();
  const streamId = params.id as string;
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const { canAccessAdmin } = useAdmin();

  const [streamData, setStreamData] = useState<StreamRemainingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Get asset info from stream data
  const assetInfo = useMemo(() => {
    return getAssetInfo(streamData?.assetCode);
  }, [streamData?.assetCode]);

  const decimals = streamData?.decimals ?? assetInfo.decimals;

  useEffect(() => {
    if (authLoading) return;

    if (!token || !streamId) {
      setLoading(false);
      return;
    }

    const fetchStreamData = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await api.streams.getRemaining(token, streamId);
        setStreamData(data);
        setLastFetched(new Date());
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load stream data";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void fetchStreamData();
  }, [token, streamId, authLoading]);

  const handleRefresh = async () => {
    if (!token || !streamId || refreshing) return;

    setRefreshing(true);
    setError(null);

    try {
      const data = await api.streams.getRemaining(token, streamId);
      setStreamData(data);
      setLastFetched(new Date());
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to refresh stream data";
      setError(message);
    } finally {
      setRefreshing(false);
    }
  };

  const totalVested = streamData ? Number(BigInt(streamData.totalVested)) : 0;
  const claimed = streamData ? Number(BigInt(streamData.claimed)) : 0;
  const unclaimed = streamData ? Number(BigInt(streamData.unclaimed)) : 0;
  const claimedPercent = totalVested > 0 ? (claimed / totalVested) * 100 : 0;
  const remainingPercent = totalVested > 0 ? (unclaimed / totalVested) * 100 : 0;

  const startTime = streamData?.startTime ?? null;
  const endTime = streamData?.endTime ?? null;
  const flowRatePerSecond = useMemo(() => {
    if (!startTime || !endTime || totalVested <= 0) return null;
    const durationSeconds = endTime - startTime;
    if (durationSeconds <= 0) return null;
    return totalVested / durationSeconds;
  }, [startTime, endTime, totalVested]);

  const formatTimestamp = (value: number | null) => {
    if (!value) return "—";
    return new Date(value * 1000).toLocaleString();
  };

  const breadcrumbItems = [
    { label: "Home", path: "/" },
    { label: "Streams", path: "/streams" },
    { label: streamId },
  ];

  const adminActionIcon = (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 1v3M8 12v3M15 8h-3M4 8H1M12.5 3.5l-2 2M5.5 10.5l-2 2M12.5 12.5l-2-2M5.5 5.5l-2-2" />
      <circle cx="8" cy="8" r="2.5" />
    </svg>
  );

  if (authLoading) {
    return (
      <section className="min-h-full bg-bg-primary px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <LoadingState variant="card" rows={4} />
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="min-h-full bg-bg-primary px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <ErrorState
            title={translateCopy("ui.authentication_required_fbbe499")}
            message="Please connect your wallet and sign in to view stream details."
          />
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-full bg-bg-primary px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Breadcrumb with admin action */}
        <Breadcrumbs
          items={breadcrumbItems}
          adminAction={
            canAccessAdmin
              ? {
                  label: "Manage Stream",
                  href: `/admin/streams/${streamId}`,
                  icon: adminActionIcon,
                }
              : undefined
          }
        />

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{translateCopy("ui.stream_details_3f546cf")}</h1>
            <p className="mt-0.5 text-xs text-text-secondary">
              {translateCopy("ui.vested_token_stream_information_ac11f29")}{" "}{assetInfo.symbol} ({decimals} {translateCopy("ui.decimals_5e8b1a0")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastFetched && <StalenessIndicator lastUpdated={lastFetched} />}
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="rounded-lg border border-border-default bg-card px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing…" : "Refresh Balance"}
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && <LoadingState variant="card" rows={3} />}

        {/* Error state */}
        {error && !loading && (
          <ErrorState
            title={translateCopy("ui.failed_to_load_stream_c24032d")}
            message={error}
          />
        )}

        {/* Stream data */}
        {!loading && !error && streamData && (
          <div className="space-y-4">
            {/* Stream ID card */}
            <div className="rounded-2xl border border-border-default bg-card p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-text-secondary">
                {translateCopy("ui.stream_id_ca9cac7")}
              </p>
              <p className="mt-2 font-mono text-sm text-text-primary break-all">
                {streamId}
              </p>
            </div>

            {/* Vesting information */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-border-default bg-card p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-text-secondary">
                  {translateCopy("ui.total_vested_84ca85a")}
                </p>
                <p className="mt-2 text-2xl font-bold text-text-primary">
                  {stroopsToAmount(streamData.totalVested, decimals)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {assetInfo.symbol} {translateCopy("ui.total_amount_vested_d1bfb7c")}
                </p>
              </div>

              <div className="rounded-2xl border border-border-default bg-card p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-status-success">
                  {translateCopy("ui.claimed_83c8788")}
                </p>
                <p className="mt-2 text-2xl font-bold text-text-primary">
                  {stroopsToAmount(streamData.claimed, decimals)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {assetInfo.symbol} {translateCopy("ui.already_claimed_2723c67")}
                </p>
              </div>

              <div className="rounded-2xl border border-border-default bg-card p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-gold">
                  {translateCopy("ui.unclaimed_fca0eb7")}
                </p>
                <p className="mt-2 text-2xl font-bold text-text-primary">
                  {stroopsToAmount(streamData.unclaimed, decimals)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {assetInfo.symbol} {translateCopy("ui.available_to_claim_217271d")}
                </p>
              </div>

              <div className="rounded-2xl border border-border-default bg-card p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-status-warning">
                  {translateCopy("ui.pending_clawback_dc060c4")}
                </p>
                <p className="mt-2 text-2xl font-bold text-text-primary">
                  {stroopsToAmount(streamData.pendingClawback, decimals)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {assetInfo.symbol} {translateCopy("ui.clawback_pending_6bf45f6")}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="rounded-2xl border border-border-default bg-card p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-text-secondary mb-3">
                {translateCopy("ui.vesting_progress_eb0cd55")}
              </p>
              <div className="h-3 w-full overflow-hidden rounded-full bg-bg-elevated">
                <div
                  className="h-full bg-status-success transition-all"
                  style={{ width: `${claimedPercent}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-text-muted">
                <span>
                  {claimedPercent.toFixed(2)}
                  {translateCopy("ui.claimed_ea4976c")}
                </span>
                <span>
                  {remainingPercent.toFixed(2)}
                  {translateCopy("ui.remaining_0ebfc6b")}
                </span>
              </div>
            </div>

            {/* Stream timeline & flow rate */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-border-default bg-card p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-text-secondary">
                  Start Time
                </p>
                <p className="mt-2 text-sm font-medium text-text-primary">
                  {formatTimestamp(startTime)}
                </p>
              </div>

              <div className="rounded-2xl border border-border-default bg-card p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-text-secondary">
                  End Time
                </p>
                <p className="mt-2 text-sm font-medium text-text-primary">
                  {formatTimestamp(endTime)}
                </p>
              </div>

              <div className="rounded-2xl border border-border-default bg-card p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-text-secondary">
                  Flow Rate / Hour
                </p>
                <p className="mt-2 text-sm font-medium text-text-primary">
                  {flowRatePerSecond !== null
                    ? `${stroopsToAmount(
                        Math.round(flowRatePerSecond * 3600),
                        decimals,
                      )} ${assetInfo.symbol}`
                    : "—"}
                </p>
              </div>

              <div className="rounded-2xl border border-border-default bg-card p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-text-secondary">
                  Flow Rate / Day
                </p>
                <p className="mt-2 text-sm font-medium text-text-primary">
                  {flowRatePerSecond !== null
                    ? `${stroopsToAmount(
                        Math.round(flowRatePerSecond * 86400),
                        decimals,
                      )} ${assetInfo.symbol}`
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
