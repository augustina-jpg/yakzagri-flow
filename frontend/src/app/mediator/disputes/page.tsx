"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useFreighterIdentity } from "@/hooks/useFreighterIdentity";
import { api, ApiError, DisputeResponse } from "@/lib/api";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/SkeletonList";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { getStatusBadgeClasses } from "@/components/ui/StatusBadge";
import { getMediatorAddresses, isMediatorAddress, formatDate, formatAddress } from "./helpers";

type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED";

const FILTERS: { label: string; value: DisputeStatus | "all" }[] = [
  { label: "All Active", value: "all" },
  { label: "Open", value: "OPEN" },
  { label: "Under Review", value: "UNDER_REVIEW" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Closed", value: "CLOSED" },
];

const PAGE_SIZE = 10;

export default function MediatorDisputesPage() {
  const { token, isAuthenticated } = useAuth();
  const { address } = useFreighterIdentity();
  const [activeFilter, setActiveFilter] = useState<DisputeStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [disputes, setDisputes] = useState<DisputeResponse[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mediatorAddresses = useMemo(() => getMediatorAddresses(), []);

  const isMediator = isMediatorAddress(address, mediatorAddresses);

  const fetchDisputes = useCallback(async () => {
    if (!isAuthenticated || !token || !isMediator) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const statusParam = activeFilter === "all" ? undefined : activeFilter;
      const response = await api.disputes.list(token, {
        status: statusParam,
        page,
        limit: PAGE_SIZE,
      });

      setDisputes(response.items);
      setTotalPages(response.pagination.totalPages);
    } catch (err) {
      let errorMessage = "Unable to reach the server. Check your connection and try again.";
      if (err instanceof ApiError) {
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated, isMediator, activeFilter, page]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  function handleFilter(value: DisputeStatus | "all") {
    setActiveFilter(value);
    setPage(1);
  }

  if (!isMediator) {
    return (
      <div className="px-6 py-8 max-w-6xl mx-auto" data-testid="mediator-disputes-page">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-text-primary mb-4">{translateCopy("ui.access_restricted_13a4143")}</h2>
          <p className="text-text-secondary">
            {translateCopy("ui.this_page_is_only_accessible_to__b0ef294")}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="px-6 py-8 max-w-6xl mx-auto"
        data-testid="mediator-disputes-page"
        role="status"
        aria-busy="true"
        aria-label="Loading mediator disputes queue"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-text-primary">{translateCopy("ui.mediator_disputes_b55890b")}</h2>
        </div>
        <SkeletonList rows={PAGE_SIZE} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-8 max-w-6xl mx-auto" data-testid="mediator-disputes-page">
        <ErrorState
          variant="card"
          title={translateCopy("ui.couldn_t_load_disputes_fa11756")}
          message={error}
          onRetry={fetchDisputes}
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto" data-testid="mediator-disputes-page">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-text-primary">{translateCopy("ui.mediator_disputes_b55890b")}</h1>
      </div>

      {/* Filters */}
      <Tabs
        items={FILTERS}
        activeValue={activeFilter}
        onChange={handleFilter}
        className="mb-6"
      />

      {/* Disputes list */}
      <div className="space-y-4">
        {disputes.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">
            {translateCopy("ui.no_disputes_found_c7d5c32")}
          </div>
        ) : (
          disputes.map((dispute) => (
            <Link
              key={dispute.id}
              href={`/mediator/disputes/${dispute.tradeId}`}
              className="block p-6 bg-bg-elevated rounded-lg border border-border-default hover:border-border-hover transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-semibold text-text-primary">
                      {translateCopy("ui.trade_b0811e4")}{" "}{dispute.tradeId}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClasses(dispute.status)}`}
                    >
                      {dispute.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-sm text-text-secondary mb-2">
                    {translateCopy("ui.initiated_by_a598de5")}{" "}{formatAddress(dispute.initiator)}
                  </div>
                  <div className="text-sm text-text-secondary mb-2">
                    {translateCopy("ui.buyer_782e9a9")}{" "}{formatAddress(dispute.trade.buyerAddress)} {translateCopy("ui.seller_f38138b")}{" "}{formatAddress(dispute.trade.sellerAddress)}
                  </div>
                  <div className="text-sm text-text-secondary">
                    {translateCopy("ui.amount_5b84c03")}{dispute.trade.amountUsdc} USDC
                  </div>
                  <div className="text-sm text-text-secondary mt-1">
                    {translateCopy("ui.created_0c78dab")}{" "}{formatDate(dispute.createdAt)}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="secondary"
            size="sm"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => setPage(Math.max(1, page - 1))}
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
            className="min-h-[44px] min-w-[44px]"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
          >
            {translateCopy("ui.next_bc98198")}
          </Button>
        </div>
      )}
    </div>
  );
}