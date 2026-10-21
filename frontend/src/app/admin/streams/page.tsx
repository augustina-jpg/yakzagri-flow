"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { api, ApiError, AdminStreamSummary } from "@/lib/api";
import { isForbiddenError } from "@/lib/errorHandler";
import { trackAdminEvent } from "@/lib/analytics";
import { ErrorState } from "@/components/ui/ErrorState";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { SkeletonList } from "@/components/ui/SkeletonList";
import { Button } from "@/components/ui/Button";
import { StreamClawbackForm } from "@/components/admin/StreamClawbackForm";
import { VirtualizedList } from "@/components/ui/VirtualizedList";
import {
  computeStreamHealth,
  formatEstimatedDepletion,
  type StreamHealthStatus,
} from "@/lib/api/adminStreams";

const PAGE_SIZE = 20;
const STREAM_ROW_HEIGHT = 200;

const HEALTH_BADGE_STYLES: Record<StreamHealthStatus, string> = {
  streaming: "bg-status-success/10 text-status-success border-status-success/30",
  near_depletion: "bg-status-warning/10 text-status-warning border-status-warning/30",
  completed: "bg-bg-subtle text-text-secondary border-border-default",
  paused: "bg-status-info/10 text-status-info border-status-info/30",
};

const HEALTH_BADGE_LABELS: Record<StreamHealthStatus, string> = {
  streaming: "Streaming",
  near_depletion: "Near Depletion <10%",
  completed: "Completed",
  paused: "Paused",
};

export default function AdminStreamsPage() {
  const { token, isAuthenticated } = useAuth();
  const isAdmin = useIsAdmin();

  const [streams, setStreams] = useState<AdminStreamSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);

  const fetchStreams = useCallback(async () => {
    if (!isAuthenticated || !token || !isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setForbidden(false);

    try {
      const response = await api.adminStreams.list(token, { page, limit: PAGE_SIZE });
      setStreams(response.items);
      setTotalPages(response.pagination.totalPages);
      trackAdminEvent("admin_streams_page_view", "success", { page });
    } catch (err) {
      if (err instanceof ApiError && isForbiddenError(err)) {
        setForbidden(true);
        trackAdminEvent("admin_streams_page_view", "failed", { reason: "forbidden" });
      } else {
        const errorMessage =
          err instanceof Error ? err.message : "Unable to reach the server. Check your connection and try again.";
        setError(errorMessage);
        trackAdminEvent("admin_streams_page_view", "failed", { reason: "error" });
      }
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated, isAdmin, page]);

  useEffect(() => {
    trackAdminEvent("admin_streams_page_view", "viewed");
  }, []);

  useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  if (!isAdmin) {
    return (
      <div className="px-6 py-8 max-w-6xl mx-auto" data-testid="admin-streams-page">
        <ForbiddenState />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-6 py-8 max-w-6xl mx-auto" data-testid="admin-streams-page">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-text-primary">{translateCopy("ui.stream_admin_eeae618")}</h2>
        </div>
        <SkeletonList rows={PAGE_SIZE} />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="px-6 py-8 max-w-6xl mx-auto" data-testid="admin-streams-page">
        <ForbiddenState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-8 max-w-6xl mx-auto" data-testid="admin-streams-page">
        <ErrorState
          variant="card"
          title={translateCopy("ui.couldn_t_load_streams_a4e5f76")}
          message={error}
          onRetry={fetchStreams}
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto" data-testid="admin-streams-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-text-primary">{translateCopy("ui.stream_admin_eeae618")}</h1>
      </div>

      <VirtualizedList
        items={streams}
        rowHeight={STREAM_ROW_HEIGHT}
        maxHeight={Math.min(streams.length * STREAM_ROW_HEIGHT, 600)}
        keyExtractor={(stream) => stream.streamId}
        isEmpty={streams.length === 0}
        emptyState={
          <div className="text-center py-12 text-text-secondary">{translateCopy("ui.no_streams_to_display_91bc4d9")}</div>
        }
        renderItem={(stream) => {
          const isActionable = BigInt(stream.unclaimed || "0") > BigInt(0);
          const isOpen = activeStreamId === stream.streamId;
          const health = computeStreamHealth(stream);
          const isNearDepletion = health.status === "near_depletion";

          return (
            <div
              className={`p-6 bg-bg-elevated rounded-lg border mb-4 ${
                isNearDepletion ? "border-status-warning" : "border-border-default"
              }`}
              data-testid={`stream-row-${stream.streamId}`}
              data-health-status={health.status}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-sm text-text-primary">{stream.streamId}</span>
                    <span className="text-xs uppercase tracking-wide text-text-secondary">
                      {stream.status}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border ${HEALTH_BADGE_STYLES[health.status]}`}
                      data-testid={`stream-health-badge-${stream.streamId}`}
                    >
                      {HEALTH_BADGE_LABELS[health.status]}
                    </span>
                  </div>
                  <div className="text-sm text-text-secondary mb-1">
                    {translateCopy("ui.recipient_ec17b25")}{" "}{stream.recipient}
                  </div>
                  <div className="text-sm text-text-secondary">
                    {translateCopy("ui.remaining_vested_34f9f34")}{" "}<span className="font-mono text-text-primary">{stream.unclaimed}</span>
                    {" · "}
                    {translateCopy("ui.vesting_state_233c2e2")}{" "}{stream.vestingState}
                  </div>
                  <div className="mt-3" data-testid={`stream-progress-${stream.streamId}`}>
                    <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                      <span>{health.percentStreamed.toFixed(1)}% streamed</span>
                      <span>{health.percentRemaining.toFixed(1)}% remaining</span>
                    </div>
                    <div
                      className="h-2 w-full rounded-full bg-bg-subtle overflow-hidden"
                      role="progressbar"
                      aria-valuenow={Math.round(health.percentStreamed)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`h-full rounded-full ${
                          isNearDepletion ? "bg-status-warning" : "bg-status-success"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, health.percentStreamed))}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-text-secondary">
                      {formatEstimatedDepletion(health.estimatedDepletion)}
                    </div>
                  </div>
                </div>
                <div>
                  {isActionable && token ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setActiveStreamId(isOpen ? null : stream.streamId)}
                    >
                      {isOpen ? "Cancel" : "Preview clawback"}
                    </Button>
                  ) : (
                    <span className="text-xs text-text-secondary">{translateCopy("ui.no_clawback_available_33fc8e7")}</span>
                  )}
                </div>
              </div>

              {isOpen && token && (
                <div className="mt-4 pt-4 border-t border-border-default">
                  <StreamClawbackForm
                    token={token}
                    streamId={stream.streamId}
                    remainingVested={stream.unclaimed}
                  />
                </div>
              )}
            </div>
          );
        }}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            {translateCopy("ui.previous_50f9428")}
          </Button>
          <span className="px-3 py-1 text-sm text-text-secondary">
            {translateCopy("ui.page_fb06270")}{" "}{page} {translateCopy("ui.of_de04fa0")}{" "}{totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            {translateCopy("ui.next_bc98198")}
          </Button>
        </div>
      )}
    </div>
  );
}
