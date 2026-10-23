"use client";
import { t as translateCopy } from "@/lib/i18n";


import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import {
  api,
  apiConfig,
  type TradeResponse,
  type TradeStatsResponse,
  ApiError,
} from "@/lib/api";
import { signTransaction } from "@stellar/freighter-api";
import { broadcastTransaction } from "@/lib/stellar/broadcast";
import { getOrCreateIdempotencyKey, clearIdempotencyKey } from "@/lib/idempotency";
import {
  PaymentOverviewCard,
  AuditLogCard,
  NetworkBackboneCard,
  VaultFooter,
} from "@/components/vault";
import { getStatusBadgeClasses, getStatusDotClasses } from "@/components/ui/StatusBadge";

import {
  type ActionModal,
  statusStyle,
  fmt,
  shortAddr,
  StatCard,
  ActionBtn,
  ConfirmModal,
} from "./VaultManageSubcomponents";

// ─── Auth gate ────────────────────────────────────────────────────────────────

function AuthGate({
  isWalletConnected,
  isLoading,
  connectWallet,
  authenticate,
}: {
  isWalletConnected: boolean;
  isLoading: boolean;
  connectWallet: () => void;
  authenticate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="w-16 h-16 rounded-2xl bg-gold-muted border border-gold/30 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-gold"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-text-primary">
          {translateCopy("ui.authentication_required_682810d")}
        </p>
        <p className="text-sm text-text-secondary mt-1">
          {translateCopy("ui.connect_and_sign_in_with_freight_2aa3f1d")}
        </p>
      </div>
      <button
        type="button"
        onClick={isWalletConnected ? authenticate : connectWallet}
        disabled={isLoading}
        className="rounded-lg bg-gold px-6 py-2.5 text-sm font-semibold text-text-inverse hover:bg-gold-hover transition-colors disabled:opacity-60"
      >
        {isLoading
          ? "Loading…"
          : isWalletConnected
            ? "Sign In"
            : "Connect Freighter"}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FOOTER = {
  version: "V4.8.2",
  links: [
    { label: "Privacy Protocol", href: "/settings" },
    { label: "Compliance", href: "/vault" },
    { label: "Audit Report", href: "/vault/manage" },
  ],
  socialLinks: [
    { platform: "x" as const, href: "https://x.com" },
    { platform: "instagram" as const, href: "https://www.instagram.com" },
    { platform: "tiktok" as const, href: "https://www.tiktok.com" },
    { platform: "discord" as const, href: "https://discord.com" },
  ],
};

const DISPUTE_CATEGORIES = [
  "non_delivery",
  "quality_issue",
  "payment_dispute",
  "other",
];

export default function VaultManagePage() {
  const {
    token,
    address,
    isAuthenticated,
    isWalletConnected,
    isLoading: authLoading,
    connectWallet,
    authenticate,
  } = useAuth();

  // Data
  const [stats, setStats] = useState<TradeStatsResponse | null>(null);
  const [trades, setTrades] = useState<TradeResponse[]>([]);
  const [walletBalance, setWalletBalance] = useState<{
    balance: string;
    asset: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<"active" | "all">("active");
  const [modal, setModal] = useState<ActionModal>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const submittingRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeCategory, setDisputeCategory] = useState(DISPUTE_CATEGORIES[0]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [statsData, tradesData, balanceData] = await Promise.all([
        api.trades.getStats(token),
        api.trades.list(token, { limit: 50 }),
        api.wallet.getBalance(token),
      ]);
      setStats(statsData);
      setTrades(tradesData.items);
      setWalletBalance(balanceData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load vault data",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated && token) void fetchData();
  }, [isAuthenticated, token, fetchData]);

  // Derived
  const displayedTrades =
    activeTab === "active"
      ? trades.filter((t) =>
          ["active", "pending", "locked"].includes(t.status.toLowerCase()),
        )
      : trades;

  const totalLocked = trades
    .filter((t) => ["active", "locked"].includes(t.status.toLowerCase()))
    .reduce((sum, t) => sum + parseFloat(t.amountCngn), 0);

  const auditEntries = trades.slice(0, 3).map((trade, i) => ({
    type: (["biometric", "multi-sig", "ledger"] as const)[i % 3],
    title: `Trade ${trade.status.toLowerCase().replace(/_/g, " ")}`,
    metadata: `${fmt(trade.updatedAt)} · ${trade.tradeId.slice(0, 8)}`,
  }));

  // Actions
  async function handleConfirm() {
    if (submittingRef.current || !modal || !token) return;
    submittingRef.current = true;
    setActionBusy(true);
    setActionError(null);

    const scopeKey = `trade:${modal.trade.tradeId}:${modal.type}`;
    const idempotencyKey = getOrCreateIdempotencyKey(address, scopeKey);

    try {
      let unsignedXdr: string | undefined;
      let actionLabel = "Action";
      if (modal.type === "deposit") {
        actionLabel = "Deposit";
        const res = await api.trades.deposit(token, modal.trade.tradeId, { idempotencyKey });
        unsignedXdr = res.unsignedXdr;
      } else if (modal.type === "release") {
        actionLabel = "Release";
        const res = await api.trades.releaseFunds(token, modal.trade.tradeId, { idempotencyKey });
        unsignedXdr = res.unsignedXdr;
      } else if (modal.type === "dispute") {
        actionLabel = "Dispute";
        const res = await api.trades.initiateDispute(
          token,
          modal.trade.tradeId,
          disputeReason,
          disputeCategory,
          { idempotencyKey },
        );
        unsignedXdr = res.unsignedXdr;
      }

      if (unsignedXdr) {
        const signResult = await signTransaction(unsignedXdr, {
          networkPassphrase: apiConfig.getStellarNetworkPassphrase(),
          address: address ?? undefined,
        });
        if (signResult.error) {
          throw new Error(signResult.error.message || "Transaction signing failed");
        }
        const signedTxXdr =
          typeof signResult === "string" ? signResult : signResult?.signedTxXdr;
        if (!signedTxXdr) {
          throw new Error("No signed transaction returned from Freighter");
        }

        const { hash } = await broadcastTransaction(signedTxXdr);
        clearIdempotencyKey(address, scopeKey);
        setActionSuccess(
          hash
            ? `${actionLabel} submitted to Stellar! Hash: ${hash}`
            : `${actionLabel} submitted to Stellar successfully.`
        );
      } else {
        clearIdempotencyKey(address, scopeKey);
        setActionSuccess(`${actionLabel} completed successfully.`);
      }
      setModal(null);
      setDisputeReason("");
      void fetchData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      const isConflict =
        (err instanceof ApiError && err.status === 409) ||
        (typeof err === "object" && err !== null && ("status" in err && (err as { status: unknown }).status === 409)) ||
        (err instanceof Error && /409|conflict|already[- ]processed/i.test(err.message));

      if (isConflict) {
        clearIdempotencyKey(address, scopeKey);
        setActionSuccess("Action was already processed.");
        setModal(null);
        setDisputeReason("");
        void fetchData();
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Action failed";
        setActionError(msg);
      }
    } finally {
      submittingRef.current = false;
      setActionBusy(false);
    }
  }

  function openModal(
    type: NonNullable<ActionModal>["type"],
    trade: TradeResponse,
  ) {
    setActionError(null);
    setDisputeReason("");
    setDisputeCategory(DISPUTE_CATEGORIES[0]);
    setModal({ type, trade } as ActionModal);
  }

  return (
    <section className="min-h-full bg-bg-primary px-6 py-8 lg:px-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
              <Link
                href="/vault"
                className="hover:text-text-secondary transition-colors"
              >
                {translateCopy("ui.vault_fb46e37")}
              </Link>
              <span>/</span>
              <span className="text-text-secondary">{translateCopy("ui.manage_bf58d17")}</span>
            </div>
            <h1 className="text-2xl font-bold text-text-primary">
              {translateCopy("ui.vault_management_ef1c83b")}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {translateCopy("ui.deposit_release_and_manage_your__b599141")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading || !isAuthenticated}
            className="self-start sm:self-auto flex items-center gap-2 rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors disabled:opacity-40"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M14 8A6 6 0 112 8" />
              <path d="M14 8l-2-2M14 8l2-2" />
            </svg>
            {translateCopy("ui.refresh_56e3bad")}
          </button>
        </div>

        {/* ── Auth gate ── */}
        {!isAuthenticated && (
          <AuthGate
            isWalletConnected={isWalletConnected}
            isLoading={authLoading}
            connectWallet={connectWallet}
            authenticate={authenticate}
          />
        )}

        {isAuthenticated && (
          <>
            {/* ── Global error / success banners ── */}
            {error && (
              <div className="rounded-lg border border-status-danger/20 bg-status-danger/10 px-4 py-3 text-sm text-status-danger flex items-center justify-between">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="ml-4 text-status-danger/60 hover:text-status-danger"
                >
                  ✕
                </button>
              </div>
            )}
            {actionError && (
              <div className="rounded-lg border border-status-danger/20 bg-status-danger/10 px-4 py-3 text-sm text-status-danger flex items-center justify-between">
                <span>{actionError}</span>
                <button
                  type="button"
                  onClick={() => setActionError(null)}
                  className="ml-4 text-status-danger/60 hover:text-status-danger"
                >
                  ✕
                </button>
              </div>
            )}
            {actionSuccess && (
              <div className="rounded-lg border border-status-success/20 bg-status-success/10 px-4 py-3 text-sm text-status-success flex items-center gap-2">
                <svg
                  className="w-4 h-4 shrink-0"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M2 8l4 4 8-8" />
                </svg>
                {actionSuccess}
              </div>
            )}

            {/* ── Stats row ── */}
            {loading && !stats ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-border-default bg-card p-5 h-24 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Trades"
                  value={stats?.totalTrades ?? 0}
                  sub="All time"
                />
                <StatCard
                  label="Open Trades"
                  value={stats?.openTrades ?? 0}
                  sub="Awaiting action"
                  accent
                />
                <StatCard
                  label="Locked in Escrow"
                  value={`$${formatNumber(totalLocked)}`}
                  sub="cNGN"
                  accent
                />
                <StatCard
                  label="Wallet Balance"
                  value={
                    walletBalance
                      ? `${formatNumber(parseFloat(walletBalance.balance))} ${walletBalance.asset}`
                      : "—"
                  }
                  sub="Available"
                />
              </div>
            )}

            {/* ── Main grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* ── Escrow positions table (2/3 width) ── */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-text-primary">
                    {translateCopy("ui.escrow_positions_923e8f0")}
                  </h2>
                  <div className="flex gap-1 rounded-lg border border-border-default p-1 bg-bg-elevated">
                    {(["active", "all"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                          activeTab === tab
                            ? "bg-gold text-text-inverse"
                            : "text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {parseFloat(walletBalance?.balance ?? "0") === 0 && (
                  <div className="rounded-lg border border-status-warning/20 bg-status-warning/10 px-4 py-3 text-sm text-status-warning flex items-center justify-between">
                    <span>{translateCopy("ui.no_available_balance_fund_your_w_1538a02")}</span>
                  </div>
                )}

                {loading && trades.length === 0 ? (
                  <div className="rounded-2xl border border-border-default bg-card overflow-hidden">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="px-4 py-4 border-b border-border-default last:border-0 animate-pulse"
                      >
                        <div className="h-4 bg-bg-elevated rounded w-3/4" />
                      </div>
                    ))}
                  </div>
                ) : displayedTrades.length === 0 ? (
                  <div className="rounded-2xl border border-border-default bg-card px-6 py-16 text-center">
                    <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border-default flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-6 h-6 text-text-muted"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
                        <circle cx="12" cy="12" r="2" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-text-primary">
                      {translateCopy("ui.no_816c52f")}{" "}{activeTab === "active" ? "active " : ""}{translateCopy("ui.escrow_positions_8036783")}
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                      {activeTab === "active"
                        ? "Switch to 'All' to see completed trades."
                        : "Create a trade to get started."}
                    </p>
                    <Link
                      href="/trades/create"
                      className="inline-block mt-4 px-4 py-2 rounded-lg bg-gold text-text-inverse text-sm font-semibold hover:bg-gold-hover transition-colors"
                    >
                      {translateCopy("ui.create_trade_2747e94")}
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border-default bg-card overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-4 py-3 border-b border-border-default bg-bg-elevated text-xs font-medium text-text-muted uppercase tracking-wider">
                      <span>{translateCopy("ui.trade_b0811e4")}</span>
                      <span>{translateCopy("ui.amount_43dc853")}</span>
                      <span>{translateCopy("ui.status_bae7d5b")}</span>
                      <span>{translateCopy("ui.actions_c3cd636")}</span>
                    </div>

                    {/* Rows */}
                    {displayedTrades.map((trade) => {
                      const s = statusStyle(trade.status);
                      const isPending =
                        trade.status.toLowerCase() === "pending";
                      const isActive = trade.status.toLowerCase() === "active";
                      const isLocked = trade.status.toLowerCase() === "locked";
                      const canDeposit = isPending;
                      const canRelease = isActive || isLocked;
                      const canDispute = isActive || isLocked || isPending;

                      return (
                        <div
                          key={trade.tradeId}
                          className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center px-4 py-4 border-b border-border-default last:border-0 hover:bg-bg-elevated/50 transition-colors"
                        >
                          {/* Trade info */}
                          <div className="min-w-0">
                            <Link
                              href={`/trades/${trade.tradeId}`}
                              className="text-sm font-mono text-gold hover:underline underline-offset-4 truncate block"
                            >
                              {trade.tradeId.slice(0, 10)}…
                            </Link>
                            <p className="text-xs text-text-muted mt-0.5">
                              {fmt(trade.createdAt)}
                            </p>
                          </div>

                          {/* Amount */}
                          <div>
                            <p className="text-sm font-semibold text-text-primary">
                              {formatNumber(parseFloat(trade.amountCngn))}{" "}
                              cNGN
                            </p>
                            <p className="text-xs text-text-muted mt-0.5">
                              {translateCopy("ui.seller_e1c9322")}{" "}{shortAddr(trade.sellerAddress)}
                            </p>
                          </div>

                          {/* Status badge */}
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${s.pill}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${s.dot}`}
                            />
                            {trade.status.toLowerCase().replace(/_/g, " ")}
                          </span>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2">
                            {canDeposit && (
                              <ActionBtn
                                label="Deposit"
                                variant="gold"
                                onClick={() => openModal("deposit", trade)}
                                disabled={parseFloat(walletBalance?.balance ?? "0") === 0}
                              />
                            )}
                            {canRelease && (
                              <ActionBtn
                                label="Release"
                                variant="gold"
                                onClick={() => openModal("release", trade)}
                              />
                            )}
                            {canDispute && (
                              <ActionBtn
                                label="Dispute"
                                variant="danger"
                                onClick={() => openModal("dispute", trade)}
                              />
                            )}
                            {!canDeposit && !canRelease && !canDispute && (
                              <span className="text-xs text-text-muted italic">
                                —
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quick-link to full trades list */}
                <div className="flex justify-end">
                  <Link
                    href="/trades"
                    className="text-xs text-text-secondary hover:text-gold transition-colors flex items-center gap-1"
                  >
                    {translateCopy("ui.view_all_trades_45758bd")}
                    <svg
                      className="w-3 h-3"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M2 6h8M7 3l3 3-3 3" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* ── Right column (1/3 width) ── */}
              <div className="space-y-6">
                {/* Payment overview */}
                <PaymentOverviewCard totalCngn={totalLocked} />

                {/* Audit log */}
                <AuditLogCard
                  entries={
                    auditEntries.length > 0
                      ? auditEntries
                      : [
                          {
                            type: "ledger",
                            title: "No recent activity",
                            metadata: "Connect wallet to view",
                          },
                        ]
                  }
                  isLiveSync={isAuthenticated}
                />
              </div>
            </div>

            {/* ── Network backbone ── */}
            <NetworkBackboneCard description="Secured and powered by the Stellar network for instantaneous cross-border settlement and verifiable transparency." />

            {/* ── Footer ── */}
            <VaultFooter
              version={FOOTER.version}
              links={FOOTER.links}
              socialLinks={FOOTER.socialLinks}
            />
          </>
        )}
      </div>

      {/* ── Action modal ── */}
      <ConfirmModal
        modal={modal}
        onClose={() => setModal(null)}
        onConfirm={handleConfirm}
        busy={actionBusy}
        disputeReason={disputeReason}
        setDisputeReason={setDisputeReason}
        disputeCategory={disputeCategory}
        setDisputeCategory={setDisputeCategory}
      />
    </section>
  );
}
