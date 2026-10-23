"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { signTransaction } from "@stellar/freighter-api";
import { useAuth } from "@/hooks/useAuth";
import { useTradeDetail } from "@/hooks/useTradeDetail";
import { useWallet } from "@/hooks/useWallet";
import { api, ApiError } from "@/lib/api";
import { apiConfig } from "@/lib/api";
import { getMediatorAddresses, isMediatorAddress } from "@/app/mediator/disputes/helpers";
import { formatDateTime } from "@/lib/i18n/format";
import { getOrCreateIdempotencyKey, clearIdempotencyKey } from "@/lib/idempotency";
import { broadcastTransaction } from "@/lib/stellar/broadcast";
import { XdrCountdownBadge } from "@/components/stellar/XdrCountdownBadge";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from "@/components/ui/Modal";
import { ConfirmActionModal } from "@/components/ui/ConfirmActionModal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NextActionCallout } from "@/components/trades/NextActionCallout";
import { resolveNextAction } from "@/lib/trades/nextAction";

function formatDate(dateString: string) {
  return formatDateTime(dateString);
}

function formatAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function InfoCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-text-muted">{title}</p>
      <p className="mt-3 text-lg font-semibold text-text-primary font-mono">{value}</p>
      <p className="mt-2 text-xs text-text-secondary">{helper}</p>
    </div>
  );
}

type UserRole = "buyer" | "seller" | "mediator" | "observer";
type DisputeCategory = "quality" | "delivery" | "payment" | "fraud" | "other";

const CANCELLABLE_STATUSES = ["PENDING", "FUNDED"];

function isCancellableStatus(status: string) {
  return CANCELLABLE_STATUSES.includes(status.toUpperCase());
}

function deriveRole(
  walletAddress: string | null,
  buyerAddress: string,
  sellerAddress: string,
): UserRole {
  if (!walletAddress) return "observer";
  if (isMediatorAddress(walletAddress, getMediatorAddresses())) return "mediator";
  const addr = walletAddress.toLowerCase();
  const mediatorAllowlist = (process.env.NEXT_PUBLIC_MEDIATOR_WALLETS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (addr === buyerAddress.toLowerCase()) return "buyer";
  if (addr === sellerAddress.toLowerCase()) return "seller";
  if (mediatorAllowlist.includes(addr)) return "mediator";
  return "observer";
}

export default function TradeDetailPage() {
  const params = useParams<{ id: string }>();
  const tradeId = params?.id ?? "UNKNOWN";

  const { token, address, isAuthenticated } = useAuth();
  const { trade, loading, error, refetch } = useTradeDetail(tradeId);
  const { balance, asset } = useWallet();
  const { toast } = useToast();

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionProgress, setActionProgress] = useState<string | null>(null);
  const [confirmedTx, setConfirmedTx] = useState<{
    hash: string;
    ledger: number | null;
  } | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeCategory, setDisputeCategory] = useState<DisputeCategory>("delivery");
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [pendingXdr, setPendingXdr] = useState<string | null>(null);
  const [xdrExpired, setXdrExpired] = useState(false);
  const [lastAction, setLastAction] = useState<{
    label: string;
    action: string;
    apiCall: (options: { idempotencyKey: string }) => Promise<{ unsignedXdr: string }>;
  } | null>(null);

  const role: UserRole = trade
    ? deriveRole(address, trade.buyerAddress, trade.sellerAddress)
    : "observer";

  const status = (trade?.status ?? "").toUpperCase();

  const nextAction = trade ? resolveNextAction(role, status) : null;

  async function runAction(
    label: string,
    action: string,
    apiCall: (options: { idempotencyKey: string }) => Promise<{ unsignedXdr: string }>,
  ) {
    if (!token || actionLoading) return;

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    setXdrExpired(false);
    setLastAction({ label, action, apiCall });

    const scopeKey = `${action}:${tradeId}`;
    const idempotencyKey = getOrCreateIdempotencyKey(address, scopeKey);

    try {
      const { unsignedXdr } = await apiCall({ idempotencyKey });
      setPendingXdr(unsignedXdr);
      const networkPassphrase = apiConfig.getStellarNetworkPassphrase();

      const result = await signTransaction(unsignedXdr, {
        networkPassphrase,
        address: address ?? undefined,
      });

      if ("error" in result && result.error) {
        throw new Error((result.error as { message?: string }).message ?? "Signing failed");
      }

      const signedTxXdr =
        typeof result === "string"
          ? result
          : (result as { signedTxXdr?: string })?.signedTxXdr;

      if (!signedTxXdr) {
        throw new Error("No signed transaction returned");
      }

      const { hash: txHash } = await broadcastTransaction(signedTxXdr);

      if (scopeKey) clearIdempotencyKey(address, scopeKey);
      setPendingXdr(null);
      setActionSuccess(
        txHash
          ? `${label} completed successfully. Transaction: ${txHash}`
          : `${label} completed successfully.`,
      );
      if (label === "Initiate Dispute") setDisputeOpen(false);
      void refetch();
    } catch (err) {
      const isConflict =
        (err instanceof ApiError && err.status === 409) ||
        (typeof err === "object" && err !== null && ("status" in err && (err as { status: unknown }).status === 409)) ||
        (err instanceof Error && /409|conflict|already[- ]processed/i.test(err.message));

      if (isConflict) {
        // Handle 409 by de-duplicating rather than looping
        if (scopeKey) clearIdempotencyKey(address, scopeKey);
        setActionSuccess(`${label} was already processed.`);
        if (label === "Initiate Dispute") setDisputeOpen(false);
        void refetch();
      } else {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : `${label} failed`;
        setActionError(message);
      }
    } finally {
      setActionLoading(false);
    }
  }

  function handleRefreshTransaction() {
    if (!lastAction) return;
    setPendingXdr(null);
    setXdrExpired(false);
    void runAction(lastAction.label, lastAction.action, lastAction.apiCall);
  }

  function handleDeposit() {
    void runAction("Deposit", "deposit", (options) =>
      api.trades.deposit(token!, tradeId, options),
    );
  }

  function handleConfirmDelivery() {
    void runAction("Confirm Delivery", "confirm-delivery", (options) =>
      api.trades.confirmDelivery(token!, tradeId, options),
    );
  }

  function handleReleaseFunds() {
    void runAction("Release Funds", "release-funds", (options) =>
      api.trades.releaseFunds(token!, tradeId, options),
    );
  }

  async function handleCancelTrade() {
    if (!token || actionLoading) return;

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await api.trades.cancelTrade(token, tradeId);
      setCancelOpen(false);
      setActionSuccess("Trade cancelled. Escrow funds will be returned to the buyer.");
      toast({
        title: "Trade cancelled",
        description: "Escrow funds will be returned to the buyer.",
        variant: "success",
      });
      void refetch();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Cancel Trade failed";
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  }

  function handleInitiateDispute() {
    const reason = disputeReason.trim();
    if (reason.length < 10 || reason.length > 500) {
      setDisputeError("Enter a reason between 10 and 500 characters.");
      return;
    }
    setDisputeError(null);
    void runAction("Initiate Dispute", "initiate-dispute", (options) =>
      api.trades.initiateDispute(token!, tradeId, reason, disputeCategory, options),
    );
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{translateCopy("ui.trade_details_b712b25")}</h1>
        <Link
          href="/trades"
          className="px-3 py-1.5 rounded-md border border-border-default hover:border-border-hover text-text-secondary hover:text-text-primary transition-colors"
        >
          {translateCopy("ui.back_to_trades_3b42f9d")}
        </Link>
      </div>

      {/* Loading state */}
      {loading && (
        <div role="status" aria-busy="true" aria-label="Loading trade details" className="space-y-4 py-4">
          <div className="rounded-lg border border-border-default bg-bg-secondary p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-6 w-40 animate-pulse rounded bg-bg-tertiary" />
              <div className="h-6 w-24 animate-pulse rounded-full bg-bg-tertiary" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="h-16 animate-pulse rounded bg-bg-tertiary" />
              <div className="h-16 animate-pulse rounded bg-bg-tertiary" />
              <div className="h-16 animate-pulse rounded bg-bg-tertiary" />
            </div>
          </div>
          <div className="rounded-lg border border-border-default bg-bg-secondary p-6 space-y-3">
            <div className="h-5 w-32 animate-pulse rounded bg-bg-tertiary" />
            <div className="h-12 w-full animate-pulse rounded bg-bg-tertiary" />
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-status-danger/20 bg-red-500/10 px-4 py-3 text-center">
          <p className="text-status-danger text-sm">{error}</p>
          <button
            onClick={() => void refetch()}
            className="mt-2 text-xs underline text-text-secondary hover:text-text-primary"
          >
            {translateCopy("common.retry")}
          </button>
        </div>
      )}

      {/* Trade data */}
      {!loading && !error && trade && (
        <div className="space-y-6">
          {/* Identity row */}
          <div className="rounded-lg border border-border-default bg-bg-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">{translateCopy("ui.trade_id_153d513")}</p>
                <p className="mt-2 text-xl font-semibold text-text-primary font-mono">{trade.tradeId}</p>
                <p className="mt-2 text-xs text-text-muted">{translateCopy("ui.created_0c78dab")}{" "}{formatDate(trade.createdAt)}</p>
                <p className="mt-1 text-xs text-text-muted">{translateCopy("ui.updated_702cad2")}{" "}{formatDate(trade.updatedAt)}</p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2">
                <StatusBadge status={trade.status} size="sm" showIcon={false} />
                {role !== "observer" && (
                  <span className="text-xs text-text-muted capitalize">{translateCopy("ui.your_role_83a4169")}{" "}{role}</span>
                )}
              </div>
            </div>
          </div>

          {/* Wallet balance */}
          {isAuthenticated && balance !== null && (
            <div className="rounded-lg border border-border-default bg-bg-card p-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-text-muted">{translateCopy("ui.wallet_balance_3b5c956")}</p>
              <p className="text-sm font-semibold text-text-primary">
                {balance} {asset}
              </p>
            </div>
          )}

          {/* On-chain + off-chain status panel */}
          <div className="rounded-lg border border-border-default bg-bg-card p-5 space-y-3">
            <p className="text-xs uppercase tracking-wide text-text-muted mb-3">{translateCopy("ui.contract_state_8b2df78")}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-muted">{translateCopy("ui.off_chain_prisma_1e8032e")}</span>{" "}
                <span className="font-medium text-text-primary capitalize">{trade.status.toLowerCase()}</span>
              </div>
              <div>
                <span className="text-text-muted">{translateCopy("ui.on_chain_soroban_b831232")}</span>{" "}
                <span className="font-medium text-text-primary capitalize">{trade.status.toLowerCase()}</span>
              </div>
            </div>
          </div>

          {/* Financial summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoCard title={translateCopy("ui.amount_43dc853")} value={`${trade.amountCngn} cNGN`} helper="Total trade value" />
            <InfoCard title={translateCopy("ui.buyer_4186c93")} value={formatAddress(trade.buyerAddress)} helper="Buyer wallet address" />
            <InfoCard title={translateCopy("ui.seller_ec3ef05")} value={formatAddress(trade.sellerAddress)} helper="Seller wallet address" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard
              title={translateCopy("ui.buyer_loss_ratio_68e34f6")}
              value={`${(trade.buyerLossBps / 100).toFixed(2)}%`}
              helper="Buyer's share of loss"
            />
            <InfoCard
              title={translateCopy("ui.seller_loss_ratio_9e434b1")}
              value={`${(trade.sellerLossBps / 100).toFixed(2)}%`}
              helper="Seller's share of loss"
            />
          </div>

          {/* Action feedback */}
          {actionError && (
            <div className="rounded-lg border border-status-danger/20 bg-red-500/10 px-4 py-3 text-sm text-status-danger">
              {actionError}
            </div>
          )}
          {actionProgress && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-lg border border-border-default bg-bg-card px-4 py-3 text-sm text-text-secondary"
            >
              {actionProgress}
            </div>
          )}
          {actionSuccess && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
              <p>{actionSuccess}</p>
              {confirmedTx && (
                <p className="mt-1 text-xs">
                  <a
                    href={getTxExplorerUrl(confirmedTx.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-emerald-300"
                  >
                    {confirmedTx.hash}
                  </a>
                  {confirmedTx.ledger !== null && (
                    <span className="ml-2 text-text-muted">
                      Ledger #{confirmedTx.ledger}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Next required action callout */}
          {nextAction && <NextActionCallout action={nextAction} role={role} />}

          {/* Role-based action buttons */}
          {isAuthenticated && (
            <div className="rounded-lg border border-border-default bg-bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-text-muted mb-4">{translateCopy("ui.actions_c3cd636")}</p>
              {pendingXdr && (
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <XdrCountdownBadge
                    xdr={pendingXdr}
                    onExpired={() => setXdrExpired(true)}
                  />
                  {xdrExpired && (
                    <button
                      type="button"
                      onClick={handleRefreshTransaction}
                      disabled={actionLoading}
                      data-testid="action-refresh-transaction"
                      className="rounded-lg border border-gold px-3 py-1.5 text-xs font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {translateCopy("ui.refresh_transaction")}
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                {role === "buyer" && status === "PENDING" && (
                  <button
                    onClick={handleDeposit}
                    disabled={actionLoading || xdrExpired}
                    data-testid="action-deposit"
                    className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-text-inverse transition-colors hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? "Processing…" : "Deposit Funds"}
                  </button>
                )}

                {role === "buyer" && status === "FUNDED" && (
                  <button
                    onClick={handleConfirmDelivery}
                    disabled={actionLoading || xdrExpired}
                    data-testid="action-confirm-delivery"
                    className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-text-inverse transition-colors hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? "Processing…" : "Confirm Delivery"}
                  </button>
                )}

                {role === "seller" && (status === "FUNDED" || status === "CONFIRMED") && (
                  <button
                    onClick={handleReleaseFunds}
                    disabled={actionLoading || xdrExpired}
                    data-testid="action-release-funds"
                    className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-text-inverse transition-colors hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? "Processing…" : "Release Funds"}
                  </button>
                )}

                {(role === "buyer" || role === "seller") && isCancellableStatus(status) && (
                  <button
                    onClick={() => setCancelOpen(true)}
                    disabled={actionLoading}
                    data-testid="action-cancel-trade"
                    className="rounded-lg border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel Trade
                  </button>
                )}

                {(role === "buyer" || role === "seller") && status === "FUNDED" && (
                  <button
                    onClick={() => {
                      setDisputeReason("");
                      setDisputeCategory("delivery");
                      setDisputeError(null);
                      setDisputeOpen(true);
                    }}
                    disabled={actionLoading}
                    data-testid="action-dispute"
                    className="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {translateCopy("ui.initiate_dispute_1e100ec")}
                  </button>
                )}

                {role === "mediator" && status === "DISPUTED" && (
                  <p className="text-sm text-text-secondary">
                    {translateCopy("ui.mediation_controls_are_available_e48a46b")}{" "}
                    <Link href="/mediator/disputes" className="underline text-gold hover:text-gold-hover">
                      {translateCopy("ui.mediator_panel_00fec92")}
                    </Link>
                    .
                  </p>
                )}

                {role === "observer" && (
                  <p className="text-sm text-text-muted">{translateCopy("ui.no_actions_available_you_are_not_24eb27a")}</p>
                )}

                {(status === "SETTLED" || status === "CANCELLED") && (
                  <p className="text-sm text-text-muted">{translateCopy("ui.this_trade_is_cdcb070")}{" "}{status.toLowerCase()} {translateCopy("ui.and_no_further_actions_are_avail_f7e2030")}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Not found */}
      {!loading && !error && !trade && (
        <div className="rounded-lg border border-border-default bg-bg-card dark:bg-surface-1 p-8 text-center">
          <p className="text-text-muted">{translateCopy("ui.trade_not_found_d9178ec")}</p>
        </div>
      )}

      <ConfirmActionModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        variant="danger"
        title="Cancel Trade"
        message="This will cancel the trade and return the locked escrow funds to the buyer. Network fees apply for the on-chain cancellation transaction."
        confirmLabel="Cancel Trade"
        cancelLabel={translateCopy("common.cancel")}
        loading={actionLoading}
        onConfirm={() => void handleCancelTrade()}
      />

      <Modal open={disputeOpen} onOpenChange={setDisputeOpen}>
        <ModalContent mobileFullScreen={false}>
          <ModalHeader>
            <ModalTitle>{translateCopy("ui.initiate_dispute_title")}</ModalTitle>
            <ModalDescription>
              {translateCopy("ui.initiate_dispute_description")}
            </ModalDescription>
          </ModalHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleInitiateDispute();
            }}
          >
            <ModalBody className="space-y-4">
              <div>
                <label htmlFor="dispute-category" className="mb-1 block text-sm font-medium text-text-primary">
                  {translateCopy("ui.category_a3c686e")}
                </label>
                <select
                  id="dispute-category"
                  value={disputeCategory}
                  onChange={(event) => setDisputeCategory(event.target.value as DisputeCategory)}
                  className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-border-focus"
                >
                  <option value="quality">{translateCopy("ui.dispute_quality")}</option>
                  <option value="delivery">{translateCopy("ui.dispute_delivery")}</option>
                  <option value="payment">{translateCopy("ui.dispute_payment")}</option>
                  <option value="fraud">{translateCopy("ui.dispute_fraud")}</option>
                  <option value="other">{translateCopy("ui.other_6e6a6f2")}</option>
                </select>
              </div>
              <div>
                <label htmlFor="dispute-reason" className="mb-1 block text-sm font-medium text-text-primary">
                  {translateCopy("ui.reason_f219cc0")}
                </label>
                <textarea
                  id="dispute-reason"
                  value={disputeReason}
                  onChange={(event) => {
                    setDisputeReason(event.target.value);
                    setDisputeError(null);
                  }}
                  minLength={10}
                  maxLength={500}
                  required
                  aria-invalid={Boolean(disputeError)}
                  aria-describedby={disputeError ? "dispute-reason-error" : undefined}
                  rows={4}
                  className="w-full resize-y rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-border-focus"
                />
                {disputeError && (
                  <p id="dispute-reason-error" role="alert" className="mt-1 text-sm text-status-danger">
                    {disputeError}
                  </p>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <button
                type="button"
                onClick={() => setDisputeOpen(false)}
                className="rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
              >
                {translateCopy("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={actionLoading || xdrExpired}
                className="rounded-lg bg-status-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {actionLoading ? translateCopy("ui.processing") : translateCopy("ui.dispute_submit")}
              </button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
