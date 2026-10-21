
import { t as translateCopy } from "@/lib/i18n";
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import {
  api,
  type StreamRemainingResponse,
  type ClawbackPreviewResponse,
  ApiError,
} from "@/lib/api";
import { Breadcrumbs, LoadingState, ErrorState, CurrencyInput } from "@/components/ui";
import { formatDateTime } from "@/lib/i18n/format";
import {
  getAssetInfo,
  stroopsToAmount,
} from "@/lib/stellar/assets";
import {
  CLAWBACK_REASON_CODES,
  CLAWBACK_REASON_LABELS,
  validateClawbackRequest,
  type ClawbackReasonCode,
} from "@/lib/clawbackValidation";

export default function AdminStreamManagementPage() {
  const params = useParams();
  const streamId = params.id as string;
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const { canAccessAdmin, isAdminUIEnabled } = useAdmin();

  const [streamData, setStreamData] = useState<StreamRemainingResponse | null>(null);
  const [clawbackPreview, setClawbackPreview] = useState<ClawbackPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const [suspendReason, setSuspendReason] = useState("");
  const [resumeNote, setResumeNote] = useState("");

  const [clawbackReasonCode, setClawbackReasonCode] = useState<ClawbackReasonCode | "">("");
  const [clawbackAuditTicket, setClawbackAuditTicket] = useState("");
  const [clawbackConfirmation, setClawbackConfirmation] = useState("");
  const [clawbackValidationErrors, setClawbackValidationErrors] = useState<string[]>([]);

  // Get asset info from stream data
  const assetInfo = useMemo(() => {
    return getAssetInfo(streamData?.assetCode);
  }, [streamData?.assetCode]);

  const decimals = streamData?.decimals ?? assetInfo.decimals;

  // Currency input for clawback amount
  const clawbackInput = useCurrencyInput({
    asset: { ...assetInfo, decimals },
    max: streamData?.unclaimed,
    onValidChange: () => {
      // Clear preview when amount changes
      setClawbackPreview(null);
    },
  });

  useEffect(() => {
    if (!token || !streamId) return;

    const fetchStreamData = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await api.streams.getRemaining(token, streamId);
        setStreamData(data);
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
  }, [token, streamId]);

  const handlePreviewClawback = async () => {
    if (!token || !clawbackInput.stroops) return;

    const validation = validateClawbackRequest({
      resourceId: streamId,
      reasonCode: clawbackReasonCode,
      auditTicket: clawbackAuditTicket,
      confirmationPhrase: clawbackConfirmation,
    });

    if (!validation.valid) {
      setClawbackValidationErrors(validation.errors);
      setActionStatus("Error: Clawback request failed validation");
      return;
    }

    setClawbackValidationErrors([]);
    setActionLoading(true);
    setActionStatus(null);

    try {
      const preview = await api.streams.previewClawback(token, streamId, {
        amount: clawbackInput.stroops,
      });
      setClawbackPreview(preview);
      setActionStatus("Preview generated successfully");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to preview clawback";
      setActionStatus(`Error: ${message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!token) return;

    setActionLoading(true);
    setActionStatus(null);

    try {
      await api.streams.suspend(token, streamId, {
        reason: suspendReason || undefined,
      });
      setActionStatus("Stream suspended successfully");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to suspend stream";
      setActionStatus(`Error: ${message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!token) return;

    setActionLoading(true);
    setActionStatus(null);

    try {
      await api.streams.resume(token, streamId, {
        note: resumeNote || undefined,
      });
      setActionStatus("Stream resumed successfully");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to resume stream";
      setActionStatus(`Error: ${message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const breadcrumbItems = [
    { label: "Home", path: "/" },
    { label: "Admin", path: "/admin" },
    { label: "Streams", path: "/admin/streams" },
    { label: streamId },
  ];

  if (authLoading) {
    return (
      <section className="min-h-full bg-bg-primary px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <LoadingState variant="card" rows={4} />
        </div>
      </section>
    );
  }

  // Check feature flag first
  if (!isAdminUIEnabled) {
    return (
      <section className="min-h-full bg-bg-primary px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <ErrorState
            title={translateCopy("ui.feature_not_available_7c53250")}
            message="Admin features are currently not available."
          />
          <div className="mt-6 text-center">
            <Link
              href={`/streams/${streamId}`}
              className="inline-flex rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-gold-hover transition-colors"
            >
              {translateCopy("ui.view_stream_details_ae8447c")}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!isAuthenticated || !canAccessAdmin) {
    return (
      <section className="min-h-full bg-bg-primary px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <ErrorState
            title={translateCopy("ui.access_denied_1647b9d")}
            message="You must be an admin to access this page."
          />
          <div className="mt-6 text-center">
            <Link
              href={`/streams/${streamId}`}
              className="inline-flex rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-gold-hover transition-colors"
            >
              {translateCopy("ui.view_stream_details_ae8447c")}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-full bg-bg-primary px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Breadcrumb */}
        <Breadcrumbs items={breadcrumbItems} />

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{translateCopy("ui.admin_stream_management_f101d21")}</h1>
            <p className="mt-0.5 text-xs text-text-secondary">
              {translateCopy("ui.manage_stream_clawback_suspensio_d7fc11e")}
            </p>
          </div>
          <Link
            href={`/streams/${streamId}`}
            className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-elevated px-3 py-1.5 text-sm font-medium text-text-secondary hover:border-border-hover hover:bg-card hover:text-text-primary transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 12l-4-4 4-4" />
            </svg>
            {translateCopy("ui.view_stream_efec345")}
          </Link>
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

        {/* Stream data and admin actions */}
        {!loading && !error && streamData && (
          <div className="space-y-6">
            {/* Stream overview */}
            <div className="rounded-2xl border border-border-default bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-[0.22em] text-text-secondary">
                  {translateCopy("ui.stream_overview_d1b96e9")}
                </p>
                <div className="rounded-full bg-bg-elevated px-3 py-1">
                  <span className="text-xs font-semibold text-text-primary">
                    {assetInfo.symbol}
                  </span>
                  <span className="ml-1 text-xs text-text-muted">
                    ({decimals} {translateCopy("ui.decimals_5e8b1a0")}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-text-muted">{translateCopy("ui.total_vested_84ca85a")}</p>
                  <p className="mt-1 text-lg font-bold text-text-primary">
                    {stroopsToAmount(streamData.totalVested, decimals)}
                  </p>
                  <p className="text-xs text-text-muted">{assetInfo.symbol}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">{translateCopy("ui.claimed_83c8788")}</p>
                  <p className="mt-1 text-lg font-bold text-status-success">
                    {stroopsToAmount(streamData.claimed, decimals)}
                  </p>
                  <p className="text-xs text-text-muted">{assetInfo.symbol}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">{translateCopy("ui.unclaimed_fca0eb7")}</p>
                  <p className="mt-1 text-lg font-bold text-gold">
                    {stroopsToAmount(streamData.unclaimed, decimals)}
                  </p>
                  <p className="text-xs text-text-muted">{assetInfo.symbol}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">{translateCopy("ui.pending_clawback_dc060c4")}</p>
                  <p className="mt-1 text-lg font-bold text-status-warning">
                    {stroopsToAmount(streamData.pendingClawback, decimals)}
                  </p>
                  <p className="text-xs text-text-muted">{assetInfo.symbol}</p>
                </div>
              </div>
            </div>

            {/* Action status */}
            {actionStatus && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  actionStatus.startsWith("Error")
                    ? "border-status-danger/20 bg-status-danger/10 text-status-danger"
                    : "border-status-success/20 bg-status-success/10 text-status-success"
                }`}
              >
                {actionStatus}
              </div>
            )}

            {/* Clawback preview */}
            <div className="rounded-2xl border border-border-default bg-card p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-text-secondary mb-4">
                {translateCopy("ui.clawback_preview_e8edf9c")}
              </p>
              <div className="space-y-4">
                <CurrencyInput
                  label="Clawback Amount"
                  value={clawbackInput.value}
                  onChange={clawbackInput.setValue}
                  asset={{ ...assetInfo, decimals }}
                  error={clawbackInput.error}
                  helperText={`Maximum: ${stroopsToAmount(streamData.unclaimed, decimals)} ${assetInfo.symbol}`}
                  placeholder={translateCopy("ui.enter_amount_to_clawback_2e10f7d")}
                />
                
                <div>
                  <label htmlFor="clawbackReasonCode" className="block text-sm font-medium text-text-primary mb-2">
                    Reason code
                  </label>
                  <select
                    id="clawbackReasonCode"
                    value={clawbackReasonCode}
                    onChange={(e) => setClawbackReasonCode(e.target.value as ClawbackReasonCode | "")}
                    className="w-full rounded-lg border border-border-default bg-bg-elevated px-4 py-2 text-sm text-text-primary focus:border-gold focus:outline-none"
                  >
                    <option value="">Select a reason code</option>
                    {CLAWBACK_REASON_CODES.map((code) => (
                      <option key={code} value={code}>
                        {CLAWBACK_REASON_LABELS[code]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="clawbackAuditTicket" className="block text-sm font-medium text-text-primary mb-2">
                    Audit ticket reference
                  </label>
                  <input
                    id="clawbackAuditTicket"
                    type="text"
                    value={clawbackAuditTicket}
                    onChange={(e) => setClawbackAuditTicket(e.target.value)}
                    placeholder="e.g. SEC-1234"
                    className="w-full rounded-lg border border-border-default bg-bg-elevated px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="clawbackConfirmation" className="block text-sm font-medium text-text-primary mb-2">
                    Type the stream ID to confirm
                  </label>
                  <input
                    id="clawbackConfirmation"
                    type="text"
                    value={clawbackConfirmation}
                    onChange={(e) => setClawbackConfirmation(e.target.value)}
                    placeholder={streamId}
                    className="w-full rounded-lg border border-border-default bg-bg-elevated px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none"
                  />
                </div>

                {clawbackValidationErrors.length > 0 && (
                  <ul className="list-disc space-y-1 rounded-lg border border-status-danger/20 bg-status-danger/10 px-6 py-3 text-sm text-status-danger">
                    {clawbackValidationErrors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                )}

                <button
                  onClick={() => void handlePreviewClawback()}
                  disabled={actionLoading || !clawbackInput.isValid}
                  className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-text-inverse transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionLoading ? "Loading..." : "Preview Clawback"}
                </button>

                {clawbackPreview && (
                  <div className="mt-4 rounded-lg border border-border-default bg-bg-elevated p-4 space-y-2">
                    <p className="text-xs text-text-muted">{translateCopy("ui.preview_results_7707856")}</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-text-muted">{translateCopy("ui.remaining_vested_83b8369")}</p>
                        <p className="font-medium text-text-primary">
                          {stroopsToAmount(clawbackPreview.remainingVested, decimals)} {assetInfo.symbol}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-muted">{translateCopy("ui.requested_clawback_12e9e2b")}</p>
                        <p className="font-medium text-status-warning">
                          {stroopsToAmount(clawbackPreview.requestedClawback, decimals)} {assetInfo.symbol}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-muted">{translateCopy("ui.post_clawback_balance_6f396cc")}</p>
                        <p className="font-medium text-text-primary">
                          {stroopsToAmount(clawbackPreview.postClawbackBalance, decimals)} {assetInfo.symbol}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-muted">{translateCopy("ui.timestamp_19eabc9")}</p>
                        <p className="font-medium text-text-secondary">
                          {formatDateTime(clawbackPreview.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Suspend stream */}
            <div className="rounded-2xl border border-border-default bg-card p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-text-secondary mb-4">
                {translateCopy("ui.suspend_stream_50822f9")}
              </p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="suspendReason" className="block text-sm font-medium text-text-primary mb-2">
                    {translateCopy("ui.reason_optional_f6826f8")}
                  </label>
                  <textarea
                    id="suspendReason"
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder={translateCopy("ui.enter_reason_for_suspension_1bf8eff")}
                    rows={3}
                    className="w-full rounded-lg border border-border-default bg-bg-elevated px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none resize-none"
                  />
                </div>
                <button
                  onClick={() => void handleSuspend()}
                  disabled={actionLoading}
                  className="rounded-lg bg-status-warning px-4 py-2 text-sm font-semibold text-text-inverse transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionLoading ? "Loading..." : "Suspend Stream"}
                </button>
              </div>
            </div>

            {/* Resume stream */}
            <div className="rounded-2xl border border-border-default bg-card p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-text-secondary mb-4">
                {translateCopy("ui.resume_stream_b9c8aa5")}
              </p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="resumeNote" className="block text-sm font-medium text-text-primary mb-2">
                    {translateCopy("ui.note_optional_4e39567")}
                  </label>
                  <textarea
                    id="resumeNote"
                    value={resumeNote}
                    onChange={(e) => setResumeNote(e.target.value)}
                    placeholder={translateCopy("ui.enter_note_for_resumption_5a0504a")}
                    rows={3}
                    className="w-full rounded-lg border border-border-default bg-bg-elevated px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none resize-none"
                  />
                </div>
                <button
                  onClick={() => void handleResume()}
                  disabled={actionLoading}
                  className="rounded-lg bg-status-success px-4 py-2 text-sm font-semibold text-text-inverse transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionLoading ? "Loading..." : "Resume Stream"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
