"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { api, ApiError, AdminAuditEntry } from "@/lib/api";
import { isForbiddenError } from "@/lib/errorHandler";
import { trackAdminEvent } from "@/lib/analytics";
import { generateBreadcrumbs } from "@/lib/breadcrumbs";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ErrorState } from "@/components/ui/ErrorState";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { SkeletonList } from "@/components/ui/SkeletonList";
import { Button } from "@/components/ui/Button";
import { VirtualizedList } from "@/components/ui/VirtualizedList";
import { formatDateTime } from "@/lib/i18n/format";

const PAGE_SIZE = 20;
const AUDIT_ROW_HEIGHT = 120;
const VIRTUALIZE_THRESHOLD = 50;

function formatTimestamp(dateString: string): string {
  return formatDateTime(dateString);
}

function formatAction(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function AdminAuditHistoryPage() {
  const { token, isAuthenticated } = useAuth();
  const isAdmin = useIsAdmin();
  const pathname = usePathname();
  const breadcrumbs = generateBreadcrumbs(pathname ?? "/admin/audit");

  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const fetchAuditHistory = useCallback(async () => {
    if (!isAuthenticated || !token || !isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setForbidden(false);

    try {
      const response = await api.adminAudit.list(token, { page, limit: PAGE_SIZE });
      setEntries(response.items);
      setTotalPages(response.pagination.totalPages);
      trackAdminEvent("admin_audit_page_view", "success", { page });
    } catch (err) {
      if (err instanceof ApiError && isForbiddenError(err)) {
        setForbidden(true);
        trackAdminEvent("admin_audit_page_view", "failed", { reason: "forbidden" });
      } else {
        const errorMessage =
          err instanceof Error ? err.message : "Unable to reach the server. Check your connection and try again.";
        setError(errorMessage);
        trackAdminEvent("admin_audit_page_view", "failed", { reason: "error" });
      }
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated, isAdmin, page]);

  useEffect(() => {
    trackAdminEvent("admin_audit_page_view", "viewed");
  }, []);

  useEffect(() => {
    fetchAuditHistory();
  }, [fetchAuditHistory]);

  if (!isAdmin) {
    return (
      <div className="px-6 py-8 max-w-6xl mx-auto" data-testid="admin-audit-page">
        <ForbiddenState />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="px-6 py-8 max-w-6xl mx-auto"
        data-testid="admin-audit-page"
        role="status"
        aria-busy="true"
        aria-label="Loading admin action history table"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-text-primary">{translateCopy("ui.admin_action_history_ca3d545")}</h2>
        </div>
        <SkeletonList rows={PAGE_SIZE} />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="px-6 py-8 max-w-6xl mx-auto" data-testid="admin-audit-page">
        <ForbiddenState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-8 max-w-6xl mx-auto" data-testid="admin-audit-page">
        <ErrorState
          variant="card"
          title={translateCopy("ui.couldn_t_load_admin_action_histo_2023376")}
          message={error}
          onRetry={fetchAuditHistory}
        />
      </div>
    );
  }

  const renderEntry = (entry: AdminAuditEntry) => (
    <div className="p-6 bg-bg-elevated rounded-lg border border-border-default mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-lg font-semibold text-text-primary">
              {formatAction(entry.action)}
            </span>
          </div>
          <div className="text-sm text-text-secondary mb-1">
            {translateCopy("ui.admin_a537f08")}{" "}{entry.actorAddress}
          </div>
          {entry.targetReference && (
            <div className="text-sm text-text-secondary mb-1">
              {translateCopy("ui.reference_45c3dc1")}{" "}{entry.targetReference}
            </div>
          )}
          {entry.note && (
            <div className="text-sm text-text-secondary mb-1">{translateCopy("ui.note_83423c1")}{" "}{entry.note}</div>
          )}
        </div>
        <div className="text-sm text-text-secondary whitespace-nowrap">
          {formatTimestamp(entry.createdAt)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto" data-testid="admin-audit-page">
      <Breadcrumbs items={breadcrumbs} className="mb-3" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-text-primary">{translateCopy("ui.admin_action_history_ca3d545")}</h1>
      </div>

      {entries.length > VIRTUALIZE_THRESHOLD ? (
        <VirtualizedList
          items={entries}
          rowHeight={AUDIT_ROW_HEIGHT}
          maxHeight={Math.min(entries.length * AUDIT_ROW_HEIGHT, 600)}
          keyExtractor={(entry) => String(entry.id)}
          isEmpty={entries.length === 0}
          emptyState={
            <div className="text-center py-12 text-text-secondary">{translateCopy("ui.no_admin_actions_recorded_yet_98d002a")}</div>
          }
          renderItem={renderEntry}
        />
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">{translateCopy("ui.no_admin_actions_recorded_yet_98d002a")}</div>
      ) : (
        <div>{entries.map((entry) => <div key={entry.id}>{renderEntry(entry)}</div>)}</div>
      )}

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
