"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { signTransaction } from "@stellar/freighter-api";
import { TradeDetailPanel } from "@/components/trade/TradeDetailPanel";
import { useAuth } from "@/hooks/useAuth";
import { api, apiConfig, ApiError, type TradeResponse, type TradeHistoryEvent } from "@/lib/api";
import { broadcastTransaction } from "@/lib/stellar/broadcast";
import { getOrCreateIdempotencyKey, clearIdempotencyKey } from "@/lib/idempotency";
import { formatDate } from "@/lib/i18n";
import type { TradeDetail, TimelineEvent, TransactionEvent } from "@/types/trade";

function mapStatusToDisplay(status: string): TradeDetail["status"] {
  const statusMap: Record<string, TradeDetail["status"]> = {
    PENDING_SIGNATURE: "PENDING",
    CREATED: "PENDING",
    FUNDED: "IN TRANSIT",
    DELIVERED: "IN TRANSIT",
    SETTLED: "SETTLED",
    DISPUTED: "DISPUTED",
    CANCELLED: "DRAFT",
  };
  return statusMap[status] || "PENDING";
}

export function mapHistoryToTimeline(events: TradeHistoryEvent[]): TimelineEvent[] {
  return events.map((event, index) => ({
    id: String(index + 1),
    type: event.eventType as TimelineEvent["type"],
    title: event.eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: describeHistoryEvent(event),
    timestamp: event.timestamp,
    status: getHistoryEventStatus(event) === "pending" || getHistoryEventStatus(event) === "failed"
      ? "pending"
      : getHistoryEventStatus(event) === "active" || index === events.length - 1
        ? "current"
        : "completed",
  }));
}

const EVENT_DESCRIPTIONS: Record<string, string> = {
  trade_created: "Trade was created and is awaiting funding.",
  trade_funded: "Escrow funds were deposited and locked.",
  delivery_confirmed: "Delivery was confirmed by the buyer.",
  trade_delivered: "Delivery was recorded for this trade.",
  funds_released: "Escrow funds were released to the seller.",
  trade_settled: "The trade was settled.",
  dispute_initiated: "A dispute was opened for this trade.",
  dispute_resolved: "The dispute was resolved.",
  manifest_submitted: "Shipment details were submitted.",
  evidence_uploaded: "Trade evidence was uploaded.",
  trade_cancelled: "The trade was cancelled.",
};

function describeHistoryEvent(event: TradeHistoryEvent): string {
  const metadata = event.metadata ?? {};
  const suppliedDescription = ["description", "message", "reason", "note"]
    .map((key) => metadata[key])
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  const description = suppliedDescription ?? EVENT_DESCRIPTIONS[event.eventType.toLowerCase()];
  const amount = metadata.amountCngn ?? metadata.amount;
  const amountDescription = typeof amount === "string" || typeof amount === "number"
    ? ` Amount: ${amount}${typeof metadata.assetCode === "string" ? ` ${metadata.assetCode}` : ""}.`
    : "";

  return `${description ?? `${event.eventType.replace(/_/g, " ")} was recorded.`}${amountDescription}`;
}

function getHistoryEventStatus(event: TradeHistoryEvent): "completed" | "active" | "pending" | "failed" {
  const metadataStatus = event.metadata?.status ?? event.metadata?.state;
  if (typeof metadataStatus === "string") {
    const normalizedStatus = metadataStatus.toLowerCase().replace(/[ -]/g, "_");
    if (["pending", "awaiting", "queued"].includes(normalizedStatus)) return "pending";
    if (["active", "in_progress", "started", "processing"].includes(normalizedStatus)) return "active";
    if (["failed", "error", "rejected"].includes(normalizedStatus)) return "failed";
    if (["completed", "complete", "success", "succeeded", "settled"].includes(normalizedStatus)) return "completed";
  }

  const eventType = event.eventType.toLowerCase();
  if (eventType.includes("failed") || eventType.includes("rejected")) return "failed";
  if (eventType.includes("pending") || eventType.includes("requested")) return "pending";
  if (eventType.includes("started") || eventType.includes("processing")) return "active";
  return "completed";
}

export function mapHistoryToTransactionTimeline(events: TradeHistoryEvent[]): TransactionEvent[] {
  return events.map((event, index) => ({
    id: `tx-${index + 1}`,
    title: event.eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    actor: (event.actor || "system") as TransactionEvent["actor"],
    timestamp: event.timestamp,
    description: describeHistoryEvent(event),
    status: getHistoryEventStatus(event),
  }));
}

function buildTradeDetail(
  trade: TradeResponse,
  history: TradeHistoryEvent[]
): TradeDetail {
  const timeline = mapHistoryToTimeline(history);
  const transactionTimeline = mapHistoryToTransactionTimeline(history);

  return {
    id: trade.tradeId,
    commodity: "Trade",
    quantity: `${trade.amountCngn} cNGN`,
    category: "Escrow Trade",
    status: mapStatusToDisplay(trade.status),
    initiatedAt: formatDate(trade.createdAt),
    buyer: {
      name: "Buyer",
      walletAddress: `${trade.buyerAddress.slice(0, 6)}...${trade.buyerAddress.slice(-4)}`,
      trustScore: 100,
    },
    seller: {
      name: "Seller",
      walletAddress: `${trade.sellerAddress.slice(0, 6)}...${trade.sellerAddress.slice(-4)}`,
      trustScore: 100,
    },
    vaultAmountLocked: Number(trade.amountCngn),
    assetValue: Number(trade.amountCngn) * 0.99,
    platformFeePercent: 1,
    platformFee: Number(trade.amountCngn) * 0.01,
    networkGasEst: "0.01",
    contractId: trade.tradeId,
    incoterms: "FOB",
    originPort: "Origin",
    destinationPort: "Destination",
    eta: trade.eta || "Unknown",
    etaLabel: trade.eta ? "Expected" : "Pending",
    carrier: trade.carrier || "Pending Assignment",
    timeline: timeline.length > 0 ? timeline : [
      {
        id: "1",
        type: "escrow_funded",
        title: "Trade Created",
        description: "Trade has been created and awaiting funding.",
        status: trade.status === "PENDING_SIGNATURE" ? "current" : "completed",
      },
    ],
    transactionTimeline: transactionTimeline.length > 0 ? transactionTimeline : undefined,
    currentTransactionIndex: transactionTimeline.length > 0 ? transactionTimeline.length - 1 : 0,
    lossRatios: [
      { label: "Buyer Loss", value: trade.buyerLossBps / 100 },
      { label: "Seller Loss", value: trade.sellerLossBps / 100 },
    ],
  };
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-text-secondary">{translateCopy("ui.loading_trade_details_3bf9a13")}</p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-full bg-status-danger/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-status-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">{translateCopy("ui.error_7f2f6a1")}</h2>
        <p className="text-text-secondary mb-4">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-gold text-text-inverse rounded-lg font-medium hover:bg-gold-hover"
          >
            {translateCopy("ui.try_again_cef2fe0")}
          </button>
        )}
      </div>
    </div>
  );
}

function AuthRequired({ onConnect, onAuthenticate, isConnected, isLoading }: {
  onConnect: () => void;
  onAuthenticate: () => void;
  isConnected: boolean;
  isLoading: boolean;
}) {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">{translateCopy("ui.authentication_required_fbbe499")}</h2>
        <p className="text-text-secondary mb-4">
          {isConnected
            ? "Please sign in with your wallet to view trade details."
            : "Connect your Freighter wallet to view trade details."}
        </p>
        <button
          onClick={isConnected ? onAuthenticate : onConnect}
          disabled={isLoading}
          className="px-4 py-2 bg-gold text-text-inverse rounded-lg font-medium hover:bg-gold-hover disabled:opacity-50"
        >
          {isLoading ? "Loading..." : isConnected ? "Sign In" : "Connect Wallet"}
        </button>
      </div>
    </div>
  );
}

export interface EvidenceAttachmentVerification {
  cid: string;
  previewUrl: string;
  recordedAt: string;
  verifiedTimestamp: boolean;
  verificationReason: string;
}

export function extractAndVerifyEvidenceAttachments(
  events: TradeHistoryEvent[],
  tradeCreatedAt?: string,
): EvidenceAttachmentVerification[] {
  const createdMs = tradeCreatedAt ? Date.parse(tradeCreatedAt) : NaN;
  const nowMs = Date.now() + 5 * 60 * 1000;
  const results: EvidenceAttachmentVerification[] = [];

  for (const event of events) {
    const meta = event.metadata ?? {};
    const rawCid =
      typeof meta.cid === "string"
        ? meta.cid
        : typeof meta.evidenceCid === "string"
          ? meta.evidenceCid
          : null;
    if (!rawCid) continue;
    const eventMs = Date.parse(event.timestamp);
    const isValidDate = Number.isFinite(eventMs);
    const afterCreation = !Number.isFinite(createdMs) || eventMs >= createdMs;
    const notFuture = isValidDate && eventMs <= nowMs;
    const verifiedTimestamp = isValidDate && afterCreation && notFuture;

    results.push({
      cid: rawCid,
      previewUrl: `https://gateway.pinata.cloud/ipfs/${encodeURIComponent(rawCid)}`,
      recordedAt: event.timestamp,
      verifiedTimestamp,
      verificationReason: verifiedTimestamp
        ? "Timestamp verified against trade lifecycle ledger"
        : "Timestamp outside expected trade lifecycle window",
    });
  }

  return results;
}

/**
 * Keep execution and authorization strictly outside model output.
 * Transaction signing and state-changing actions require an authenticated
 * wallet session and explicit user-initiated action scope.
 */
export function assertDeterministicExecutionAuthorized(params: {
  token: string | null | undefined;
  walletAddress: string | null | undefined;
  fromModelOutput?: boolean;
}): void {
  if (params.fromModelOutput) {
    throw new Error("Execution and authorization cannot be triggered from model output.");
  }
  if (!params.token || !params.walletAddress) {
    throw new Error("Sign in with your wallet to perform this action.");
  }
}

export default function TradeDetailPage() {
  const params = useParams();
  const tradeId = params.id as string;
  const { token, address, isAuthenticated, isWalletConnected, isLoading: authLoading, connectWallet, authenticate } = useAuth();

  const [trade, setTrade] = useState<TradeDetail | null>(null);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceAttachmentVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchTrade = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const [tradeData, historyData] = await Promise.all([
        api.trades.get(token, tradeId),
        api.trades.getHistory(token, tradeId).catch(() => ({ events: [] })),
      ]);

      const tradeDetail = buildTradeDetail(tradeData, historyData.events);
      setTrade(tradeDetail);
      setEvidenceItems(
        extractAndVerifyEvidenceAttachments(historyData.events, tradeData.createdAt),
      );
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError("Trade not found.");
        } else if (err.status === 403) {
          setError("You do not have access to this trade.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to load trade details.");
      }
    } finally {
      setLoading(false);
    }
  }, [token, tradeId]);

  async function runSignedAction(
    label: string,
    scopeKey: string,
    action: (options: { idempotencyKey?: string }) => Promise<{ unsignedXdr: string }>,
  ) {
    try {
      assertDeterministicExecutionAuthorized({ token, walletAddress: address });
    } catch (authErr) {
      setActionError(
        authErr instanceof Error
          ? authErr.message
          : "Sign in with your wallet to perform this action.",
      );
      return;
    }

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    const idempotencyKey = getOrCreateIdempotencyKey(address, scopeKey);

    try {
      const { unsignedXdr } = await action({ idempotencyKey });
      const result = await signTransaction(unsignedXdr, {
        networkPassphrase: apiConfig.getStellarNetworkPassphrase(),
        address: address ?? undefined,
      });
      if (result.error) {
        throw new Error(result.error.message || "Transaction signing failed");
      }
      const signedTxXdr =
        typeof result === "string" ? result : result?.signedTxXdr;
      if (!signedTxXdr) {
        throw new Error("No signed transaction returned from Freighter");
      }

      const { hash } = await broadcastTransaction(signedTxXdr);
      clearIdempotencyKey(address, scopeKey);
      setActionSuccess(
        hash
          ? `${label} submitted to Stellar! Hash: ${hash}`
          : `${label} submitted to Stellar successfully.`
      );
      void fetchTrade();
    } catch (err) {
      const isConflict =
        (err instanceof ApiError && err.status === 409) ||
        (typeof err === "object" && err !== null && ("status" in err && (err as { status: unknown }).status === 409)) ||
        (err instanceof Error && /409|conflict|already[- ]processed/i.test(err.message));

      if (isConflict) {
        clearIdempotencyKey(address, scopeKey);
        setActionSuccess(`${label} was already processed.`);
        void fetchTrade();
      } else {
        setActionError(err instanceof Error ? err.message : `${label} failed.`);
      }
    } finally {
      setActionLoading(false);
    }
  }

  function handleConfirmDelivery() {
    void runSignedAction(
      "Delivery confirmation",
      `trade:${tradeId}:confirm-delivery`,
      (opts) => api.trades.confirmDelivery(token!, tradeId, opts),
    );
  }

  function handleReleaseFunds() {
    void runSignedAction(
      "Funds release",
      `trade:${tradeId}:release-funds`,
      (opts) => api.trades.releaseFunds(token!, tradeId, opts),
    );
  }

  function handleRaiseDispute() {
    const reason = window.prompt("Enter dispute reason (at least 10 characters):");
    if (!reason || reason.trim().length < 10) {
      setActionError("Dispute reason must be at least 10 characters.");
      return;
    }
    void runSignedAction(
      "Dispute",
      `trade:${tradeId}:dispute`,
      (opts) => api.trades.initiateDispute(token!, tradeId, reason.trim(), "other", opts),
    );
  }

  useEffect(() => {
    if (isAuthenticated && token) {
      void fetchTrade();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, token, fetchTrade]);

  if (authLoading) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    return (
      <AuthRequired
        onConnect={connectWallet}
        onAuthenticate={authenticate}
        isConnected={isWalletConnected}
        isLoading={authLoading}
      />
    );
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchTrade} />;
  }

  if (!trade) {
    return <ErrorState message="Trade not found." />;
  }

  const isBuyer = Boolean(address) && address?.toLowerCase() === trade.buyer.walletAddress.toLowerCase();
  const isSeller = Boolean(address) && address?.toLowerCase() === trade.seller.walletAddress.toLowerCase();
  const isInTransit = trade.status === "IN TRANSIT";

  return (
    <div>
      <TradeDetailPanel
        trade={trade}
        onConfirmDelivery={isBuyer && isInTransit ? handleConfirmDelivery : undefined}
        onRaiseDispute={(isBuyer || isSeller) && isInTransit ? handleRaiseDispute : undefined}
        onReleaseFunds={isSeller && isInTransit ? handleReleaseFunds : undefined}
        actionLoading={actionLoading}
        actionError={actionError}
        actionSuccess={actionSuccess}
      />
      {evidenceItems.length > 0 && (
        <section
          aria-label="Evidence Attachments"
          data-testid="evidence-attachments-section"
          className="max-w-6xl mx-auto px-6 pb-8"
        >
          <h2 className="text-lg font-semibold text-text-primary mb-3">
            Evidence Attachments & Timestamp Verification
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {evidenceItems.map((item) => (
              <div
                key={`${item.cid}-${item.recordedAt}`}
                data-testid={`evidence-preview-${item.cid}`}
                className="rounded-lg border border-border-default bg-card p-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-text-primary truncate">
                    CID: {item.cid}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      item.verifiedTimestamp
                        ? "bg-status-success/15 text-status-success"
                        : "bg-status-warning/15 text-status-warning"
                    }`}
                  >
                    {item.verifiedTimestamp ? "Timestamp Verified" : "Unverified Timestamp"}
                  </span>
                </div>
                <p className="text-xs text-text-secondary">{item.verificationReason}</p>
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Recorded: {formatDate(item.recordedAt)}</span>
                  <a
                    href={item.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold hover:underline font-medium"
                  >
                    Preview Attachment
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
