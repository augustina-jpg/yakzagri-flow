"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAnalytics } from "@/components/AnalyticsProvider";
import { useToast } from "@/hooks/useToast";
import { formatDate as formatLocalizedDate } from "@/lib/i18n";
import { api, ApiError, TradeResponse } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { NavButton } from "@/components/ui/Navigation";
import { StatusBadge, type TradeStatus as BadgeTradeStatus } from "@/components/ui/StatusBadge";
import { downloadTradesExport } from "@/lib/exportTrades";

type TradeStatus = "all" | "active" | "pending" | "completed" | "disputed";
type TradeRole = "all" | "buying" | "selling";

const FILTERS: { label: string; value: TradeStatus }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Disputed", value: "disputed" },
];

const PAGE_SIZE = 100;

const STATUS_VALUES: TradeStatus[] = ["all", "active", "pending", "completed", "disputed"];
const ROLE_VALUES: TradeRole[] = ["all", "buying", "selling"];

function parseStatus(value: string | null): TradeStatus {
  return STATUS_VALUES.includes(value as TradeStatus) ? (value as TradeStatus) : "all";
}

function parseRole(value: string | null): TradeRole {
  return ROLE_VALUES.includes(value as TradeRole) ? (value as TradeRole) : "all";
}

function parsePage(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

const ROLE_FILTERS: { label: string; value: TradeRole }[] = [
  { label: "All roles", value: "all" },
  { label: "Buying", value: "buying" },
  { label: "Selling", value: "selling" },
];

function matchesStatus(status: string, filter: TradeStatus) {
  if (filter === "all") return true;
  const normalized = status.toLowerCase().replace(/_/g, "-");
  if (filter === "active") return ["funded", "active", "delivered", "in-transit"].includes(normalized);
  if (filter === "pending") return ["created", "pending", "pending-signature"].includes(normalized);
  if (filter === "completed") return ["completed", "settled", "released", "resolved"].includes(normalized);
  return normalized === "disputed";
}

function toBadgeStatus(status: string): BadgeTradeStatus {
  const normalized = status.toLowerCase().replace(/_/g, "-");
  if (normalized === "disputed") return "disputed";
  if (normalized === "delivered") return "delivered";
  if (normalized === "funded" || normalized === "locked") return "locked";
  if (["completed", "settled", "released", "resolved"].includes(normalized)) return "delivered";
  if (normalized === "draft" || normalized === "cancelled") return "draft";
  if (["in-transit", "in transit"].includes(normalized)) return "in-transit";
  return "pending";
}

function TradesTableSkeleton() {
  return (
    <div className="rounded-lg border border-border-default overflow-hidden shadow-elev-1">
      {/* Header: surface-1 (card level) */}
      <div className="border-b border-border-default bg-surface-1 px-4 py-3">
        <div className="grid grid-cols-5 gap-4">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {/* Rows: surface-0 (canvas) */}
      <div className="divide-y divide-border-default bg-surface-0">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid grid-cols-5 gap-4 px-4 py-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TradesPage() {
  const { token, address, isAuthenticated } = useAuth();
  const { trackApiFailure, trackFunnelStep } = useAnalytics();
  const { addToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<TradeStatus>(() => parseStatus(searchParams.get("status")));
  const [activeRole, setActiveRole] = useState<TradeRole>(() => parseRole(searchParams.get("role")));
  const [page, setPage] = useState(() => parsePage(searchParams.get("page")));
  const [trades, setTrades] = useState<TradeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep local filter state in sync with the URL so browser back/forward
  // navigation restores previous filter states.
  useEffect(() => {
    setActiveFilter(parseStatus(searchParams.get("status")));
    setActiveRole(parseRole(searchParams.get("role")));
    setPage(parsePage(searchParams.get("page")));
  }, [searchParams]);

  function updateQuery(next: { status?: TradeStatus; role?: TradeRole; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    const status = next.status ?? activeFilter;
    const role = next.role ?? activeRole;
    const nextPage = next.page ?? page;

    if (status === "all") params.delete("status");
    else params.set("status", status);

    if (role === "all") params.delete("role");
    else params.set("role", role);

    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    async function fetchTrades() {
      if (!isAuthenticated || !token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await api.trades.list(token, { page: 1, limit: PAGE_SIZE });
        const allTrades = [...response.items];
        for (let nextPage = 2; nextPage <= response.pagination.totalPages; nextPage += 1) {
          const nextResponse = await api.trades.list(token, { page: nextPage, limit: PAGE_SIZE });
          allTrades.push(...nextResponse.items);
        }
        setTrades(allTrades);
      } catch (err) {
        let errorMessage = "Failed to load trades";
        let status = 0;

        if (err instanceof ApiError) {
          errorMessage = err.message;
          status = err.status ?? 0;
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }

        trackApiFailure("/trades", status, { message: errorMessage });
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchTrades();
  }, [token, isAuthenticated, trackApiFailure]);

  useEffect(() => {
    trackFunnelStep("trade_page_view", { filter: activeFilter, role: activeRole });
  }, [activeFilter, activeRole, trackFunnelStep]);

  const filteredTrades = useMemo(() => {
    const normalizedAddress = address?.toLowerCase();
    return trades.filter((trade) => {
      if (!matchesStatus(trade.status, activeFilter)) return false;
      if (activeRole === "buying") return trade.buyerAddress.toLowerCase() === normalizedAddress;
      if (activeRole === "selling") return trade.sellerAddress.toLowerCase() === normalizedAddress;
      return true;
    });
  }, [trades, address, activeFilter, activeRole]);

  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / PAGE_SIZE));
  const pagedTrades = filteredTrades.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleFilter(value: TradeStatus) {
    setActiveFilter(value);
    setPage(1);
    updateQuery({ status: value, page: 1 });
  }

  function handleRoleFilter(value: TradeRole) {
    setActiveRole(value);
    setPage(1);
    updateQuery({ role: value, page: 1 });
  }

  function handlePageChange(nextPage: number) {
    const clamped = Math.min(totalPages, Math.max(1, nextPage));
    setPage(clamped);
    updateQuery({ page: clamped });
  }

  function handleExport(format: "csv" | "json") {
    const rows = filteredTrades.map((trade) => {
      const isBuyer = trade.buyerAddress.toLowerCase() === address?.toLowerCase();
      return {
        tradeId: trade.tradeId,
        role: isBuyer ? "buying" : "selling",
        counterparty: isBuyer ? trade.sellerAddress : trade.buyerAddress,
        amountCngn: trade.amountCngn,
        status: trade.status,
        createdAt: trade.createdAt,
      };
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadTradesExport(rows, format, `trades-${timestamp}`);
  }

  function formatDate(dateString: string) {
    return formatLocalizedDate(dateString);
  }

  function formatAddress(address: string) {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      {/*
       * #445 — Shell is canonical: AppTopNav (layout.tsx) now includes Trades
       * and highlights the active route, so this page no longer renders a
       * duplicate "Trades" heading. The Create Trade action and filter tabs
       * remain as page-specific controls within the single shell.
       */}
      <div className="flex items-center justify-end gap-2 mb-6">
        <div className="hidden md:flex items-center gap-2 mr-2 border-r border-border-default pr-4">
          <button
            type="button"
            onClick={() => addToast({ type: "success", title: "Success", message: "Trade completed successfully!" })}
            className="px-3 py-1.5 rounded-md bg-status-success/10 border border-status-success/30 text-status-success text-xs font-medium hover:bg-status-success/20 transition-colors"
          >
            {translateCopy("ui.success_42a8f65")}
          </button>
          <button
            type="button"
            onClick={() => addToast({ type: "error", title: "Error", message: "Failed to complete trade." })}
            className="px-3 py-1.5 rounded-md bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs font-medium hover:bg-status-danger/20 transition-colors"
          >
            {translateCopy("ui.error_7f2f6a1")}
          </button>
          <button
            type="button"
            onClick={() => addToast({ type: "warning", title: "Warning", message: "Trade is disputed." })}
            className="px-3 py-1.5 rounded-md bg-status-warning/10 border border-status-warning/30 text-status-warning text-xs font-medium hover:bg-status-warning/20 transition-colors"
          >
            {translateCopy("ui.warning_e9c4556")}
          </button>
          <button
            type="button"
            onClick={() => addToast({ type: "info", title: "Info", message: "New message received." })}
            className="px-3 py-1.5 rounded-md bg-status-info/10 border border-status-info/30 text-status-info text-xs font-medium hover:bg-status-info/20 transition-colors"
          >
            {translateCopy("ui.info_4b631f6")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => handleExport("csv")}
          className="px-3 py-1.5 rounded-md border border-border-default text-text-secondary text-xs font-medium hover:border-border-hover transition-colors"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => handleExport("json")}
          className="px-3 py-1.5 rounded-md border border-border-default text-text-secondary text-xs font-medium hover:border-border-hover transition-colors"
        >
          Export JSON
        </button>
        <Link href="/trades/create">
          <Button variant="primary">{translateCopy("ui.create_trade_2747e94")}</Button>
        </Link>
      </div>

      {/* Trade filters */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={translateCopy("ui.trade_role_filter")}>
          <span className="mr-1 text-xs font-medium text-text-muted">{translateCopy("ui.role")}</span>
          {ROLE_FILTERS.map((filter) => {
            const isActive = activeRole === filter.value;
            return (
              <NavButton
                key={filter.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => handleRoleFilter(filter.value)}
                isActive={isActive}
              >
                {filter.label}
              </NavButton>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={translateCopy("ui.trade_status_filter")}>
          <span className="mr-1 text-xs font-medium text-text-muted">{translateCopy("ui.status")}</span>
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.value;

            return (
              <NavButton
                key={filter.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => handleFilter(filter.value)}
                isActive={isActive}
              >
                {filter.label}
              </NavButton>
            );
          })}
        </div>
      </div>

      {/* Loading state */}
      {loading && <TradesTableSkeleton />}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-lg border border-status-danger/40 bg-status-danger/15 px-4 py-3 text-center">
          <p className="text-status-danger text-sm">{error}</p>
        </div>
      )}

      {/* Trade list */}
      {!loading && !error && (
        <>
          {filteredTrades.length === 0 ? (
            <div className="rounded-lg border border-border-default bg-surface-1 py-20 px-6 text-center shadow-elev-1">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-lg bg-surface-2 border border-border-default flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-text-muted"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>

              {/* Heading */}
              <h3 className="text-xl font-semibold text-text-primary mb-3">
                {trades.length === 0 ? translateCopy("ui.no_trades_yet_c6ce989") : translateCopy("ui.no_trades_match_filters")}
              </h3>

              {/* Description */}
              <p className="text-text-secondary text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                {trades.length === 0
                  ? translateCopy("ui.get_started_by_creating_your_fir_a82b980")
                  : translateCopy("ui.try_another_trade_filter")}
              </p>

              {/* CTA Button */}
              {trades.length === 0 && (
                <Link href="/trades/create">
                  <Button variant="primary" size="lg">{translateCopy("ui.create_your_first_trade_4176121")}</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border-default overflow-x-auto shadow-elev-1">
              <table className="w-full min-w-176 text-sm">
                <caption className="sr-only">Trades matching the selected filters</caption>
                <thead>
                  <tr className="border-b border-border-default bg-surface-1">
                    <th scope="col" className="text-left px-4 py-3 text-text-muted font-medium">
                      ID
                    </th>
                    <th scope="col" className="text-left px-4 py-3 text-text-muted font-medium">
                      {translateCopy("ui.trade_counterparty")}
                    </th>
                    <th scope="col" className="text-left px-4 py-3 text-text-muted font-medium">
                      {translateCopy("ui.amount_43dc853")}
                    </th>
                    <th scope="col" className="text-left px-4 py-3 text-text-muted font-medium">
                      {translateCopy("ui.status")}
                    </th>
                    <th scope="col" className="text-left px-4 py-3 text-text-muted font-medium">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {pagedTrades.map((trade, index) => {
                    const isBuyer = trade.buyerAddress.toLowerCase() === address?.toLowerCase();
                    const counterparty = isBuyer ? trade.sellerAddress : trade.buyerAddress;
                    return (
                      <tr
                        key={trade.tradeId}
                        className={`${index % 2 === 0 ? "bg-surface-0" : "bg-surface-1"} hover:bg-surface-2 transition-colors`}
                      >
                        <th scope="row" className="px-4 py-3 text-left text-gold font-mono">
                          <Link href={`/trades/${trade.tradeId}`} className="hover:underline underline-offset-4">
                            {trade.tradeId.slice(0, 8)}...
                          </Link>
                        </th>
                        <td className="px-4 py-3 text-text-secondary font-mono">
                          {formatAddress(counterparty)}
                        </td>
                        <td className="px-4 py-3 text-text-primary">{trade.amountCngn} cNGN</td>
                        <td className="px-4 py-3"><StatusBadge status={toBadgeStatus(trade.status)} size="sm" /></td>
                        <td className="px-4 py-3 text-text-secondary">{formatDate(trade.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 text-sm text-text-secondary">
              <span>
                {translateCopy("ui.page_fb06270")}{" "}{page} {translateCopy("ui.of_de04fa0")}{" "}{totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-md border border-border-default hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {translateCopy("ui.previous_50f9428")}
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-md border border-border-default hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {translateCopy("ui.next_bc98198")}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
