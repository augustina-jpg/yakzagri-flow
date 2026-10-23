"use client";
import { t as translateCopy } from "@/lib/i18n";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTrade } from "../TradeContext";
import { isSelfEscrowAddress, isValidStellarAddress, formatDeliveryWindowSummary } from "../validation";
import { useAuth } from "@/hooks/useAuth";
import { submitTradeCreation } from "@/lib/trades/submitTradeCreation";
import { createTradeInputSchema, fieldErrors } from "@/lib/domain-schemas/trade";
import Link from "next/link";
import { LegalDisclaimerModal } from "@/components/ui/LegalDisclaimerModal";
import { useOffline } from "@/hooks/useOffline";
import { useOfflineQueueStore } from "@/stores/offlineQueueStore";
import { useToast } from "@/hooks/useToast";
import { shouldDedup, registerAction } from "@/lib/actionDedup";
import { getOrCreateIdempotencyKey, clearIdempotencyKey } from "@/lib/idempotency";
import { generateCorrelationId } from "@/lib/correlationId";
import { formatNumber } from "@/lib/i18n/format";
import { XdrCountdownBadge } from "@/components/trades/XdrCountdownBadge";

export const SLIPPAGE_TOLERANCE_OPTIONS = [
  { label: "0.5%", value: 0.5, bps: 50 },
  { label: "1.0%", value: 1.0, bps: 100 },
  { label: "2.0%", value: 2.0, bps: 200 },
] as const;

export interface SorobanSimulationBreakdown {
  baseFeeXlm: string;
  resourceFeeXlm: string;
  totalEstimatedFeeXlm: string;
  cpuInstructions: string;
  ledgerReads: number;
  ledgerWrites: number;
  rentBumpStroops: number;
}

export function estimateSorobanSimulation(rawAmount: number): SorobanSimulationBreakdown {
  const validAmount = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0;
  const baseFeeStroops = 100;
  const resourceFeeStroops = validAmount > 0 ? 45_200 : 32_000;
  const totalStroops = baseFeeStroops + resourceFeeStroops;
  return {
    baseFeeXlm: (baseFeeStroops / 1e7).toFixed(7),
    resourceFeeXlm: (resourceFeeStroops / 1e7).toFixed(7),
    totalEstimatedFeeXlm: (totalStroops / 1e7).toFixed(7),
    cpuInstructions: validAmount > 0 ? "1,420,000" : "980,000",
    ledgerReads: 4,
    ledgerWrites: 2,
    rentBumpStroops: 12_400,
  };
}

type Row = { label: string; value: string };
type CompletedTrade = { tradeId: string; transactionHash: string };
type Step3ReviewProps = {
  onCreated?: (trade: CompletedTrade) => void;
  completedTrade?: CompletedTrade;
  onStartNewTrade?: () => void;
};

function ReviewRow({ label, value }: Row) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border-default last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm text-text-primary font-medium text-right max-w-[60%] break-all">{value}</span>
    </div>
  );
}

export function Step3Review({ onCreated, completedTrade, onStartNewTrade }: Step3ReviewProps) {
  const router = useRouter();
  const { data, setStep } = useTrade();
  const { token, address, isAuthenticated, isWalletConnected, connectWallet, authenticate } = useAuth();
  const { isOffline } = useOffline();
  const enqueue = useOfflineQueueStore((s) => s.enqueue);
  const pendingCount = useOfflineQueueStore((s) => s.queue.length);
  const { addToastWithCorrelation, updateToast } = useToast();
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.5);
  // Prepared unsigned XDR + its ledger timebounds (maxTime, unix seconds).
  // Populated once the backend prepares the transaction; drives the expiry countdown.
  const [preparedXdr, setPreparedXdr] = useState<string | null>(null);
  const [xdrMaxTime, setXdrMaxTime] = useState<number | null>(null);
  const [xdrExpired, setXdrExpired] = useState(false);
  const [refreshingXdr, setRefreshingXdr] = useState(false);

  const qty = parseFloat(data.quantity);
  const price = parseFloat(data.pricePerUnit);
  const rawAmount = !isNaN(qty) && !isNaN(price) ? qty * price : NaN;

  const total = !isNaN(rawAmount) && rawAmount > 0 ? formatNumber(rawAmount) : "—";

  // Unit price derived from the structured quantity/unit breakdown. Guard
  // against zero/NaN quantity so we never divide by zero.
  const computedUnitPrice =
    !isNaN(rawAmount) && rawAmount > 0 && !isNaN(qty) && qty > 0
      ? rawAmount / qty
      : NaN;
  const unitPriceDisplay =
    !isNaN(computedUnitPrice) && computedUnitPrice > 0
      ? formatNumber(computedUnitPrice)
      : "—";
  const quantityDisplay = data.quantity
    ? `${data.quantity}${data.unit ? ` ${data.unit}` : ""}`
    : "—";
======

  const amountUsdc = !isNaN(rawAmount) && rawAmount > 0 ? rawAmount.toFixed(7) : "0";
  const maxSlippageAmount =
    !isNaN(rawAmount) && rawAmount > 0
      ? (rawAmount * (1 + slippageTolerance / 100)).toFixed(2)
      : "0.00";
  const simulation = estimateSorobanSimulation(rawAmount);

  const selfEscrow = isSelfEscrowAddress(address, data.sellerAddress);
  const isAddressValid = isValidStellarAddress(data.sellerAddress) && !selfEscrow;
  const isFormValid =
    data.commodity !== "" &&
    !isNaN(qty) && qty > 0 &&
    !isNaN(price) && price > 0 &&
    !isNaN(rawAmount) && rawAmount > 0 &&
    isAddressValid &&
    data.buyerRatio + data.sellerRatio === 100;

  const buyerLossBps = Math.round(data.buyerRatio * 100);
  const sellerLossBps = Math.round(data.sellerRatio * 100);

  const handleDisclaimerAccept = () => {
    setShowDisclaimer(false);
    void handleSubmit();
  };

  // Re-fetches the prepared unsigned XDR (re-running the prepare flow) and
  // resets the countdown so the user can sign a fresh transaction.
  const handleRefreshXdr = async () => {
    if (refreshingXdr) return;
    setRefreshingXdr(true);
    setError(null);
    try {
      const refreshed = await prepareTradeXdr();
      setPreparedXdr(refreshed.xdr);
      setXdrMaxTime(refreshed.maxTime);
      setXdrExpired(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh transaction");
    } finally {
      setRefreshingXdr(false);
    }
  };

  const handleSubmit = async () => {
    // Action de-duplication window preventing double-submit (rapid triple-click yields single intent)
    const dedupKey = `create-trade:${data.sellerAddress}:${amountUsdc}:${buyerLossBps}`;
    const dedup = shouldDedup(dedupKey);
    if (dedup.dedup || submittingRef.current) return;
    if (!isAuthenticated || !token) {
      setError("Please connect and authenticate your wallet first.");
      return;
    }

    if (selfEscrow) {
      setError("Buyer and seller Stellar addresses cannot be identical.");
      return;
    }

    if (!isFormValid) {
      setError("Please complete all required fields with valid values before submitting.");
      return;
    }

    // Validate against the shared domain schema — same rules the backend
    // enforces — so we never fire a request the server will reject with a 400.
    const payload = {
      sellerAddress: data.sellerAddress.trim(),
      amountUsdc,
      buyerLossBps,
      sellerLossBps,
    };
    const parsed = createTradeInputSchema.safeParse(payload);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setError(errs._form ?? Object.values(errs)[0] ?? "Trade details are invalid.");
      return;
    }

    try {
      // Action de-duplication window preventing double-submit (rapid triple-click yields single intent)
      const dedupKey = `create-trade:${data.sellerAddress}:${amountUsdc}:${buyerLossBps}`;
      const dedup = shouldDedup(dedupKey);
      if (dedup.dedup) return;
      if (!isAuthenticated || !token) {
        setError("Please connect and authenticate your wallet first.");
        return;
      }

      if (!isFormValid) {
        setError("Please complete all required fields with valid values before submitting.");
        return;
      }

      // Validate against the shared domain schema — same rules the backend
      // enforces — so we never fire a request the server will reject with a 400.
      const payload = {
        sellerAddress: data.sellerAddress.trim(),
        amountUsdc,
        buyerLossBps,
        sellerLossBps,
      };
      const parsed = createTradeInputSchema.safeParse(payload);
      if (!parsed.success) {
        const errs = fieldErrors(parsed.error);
        setError(errs._form ?? Object.values(errs)[0] ?? "Trade details are invalid.");
        return;
      }

      const requestPayload = {
        sellerAddress: parsed.data.sellerAddress,
        amountUsdc: parsed.data.amountUsdc,
        buyerLossBps,
        sellerLossBps,
      };

      const correlationId = generateCorrelationId();
      const idempotencyKey = getOrCreateIdempotencyKey(address, dedupKey);
      registerAction(dedupKey, correlationId, idempotencyKey);

      clearIdempotencyKey(address, dedupKey);
      setTradeId(submission.tradeId);
      setTxHash(submission.transactionHash);
      onCreated?.({ tradeId: submission.tradeId, transactionHash: submission.transactionHash });
      updateToast(correlationId, { type: "success", title: "Success", message: "Trade created — funds locked.", duration: 5000 });
      // Clear draft on success
      try { localStorage.removeItem("amana:draft-trade"); } catch {}
    } catch (err) {
      if (!navigator.onLine) {
        enqueue({
          type: "create-trade",
          endpoint: "/trades",
          method: "POST",
          body: requestPayload,
          idempotencyKey,
          correlationId,
        });
        // Pending-state UX showing what will send
        addToastWithCorrelation({
          type: "info",
          title: "Queued offline",
          message: `Draft trade (${data.commodity} ${amountUsdc} cNGN) will send when reconnected.`,
          correlationId,
          duration: 6000,
        });
        // Keep draft in localStorage (TradeContext) — survives refresh/restart via TradeContext persistence
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      // Unified toast contract: pending w/ correlation ID
      addToastWithCorrelation({ type: "info", title: "In progress", message: "Locking funds…", correlationId, duration: 0 });

      try {
        const submission = await submitTradeCreation(token, requestPayload, {
          idempotencyKey,
          correlationId,
        });

        clearIdempotencyKey(address, dedupKey);
        setTradeId(submission.tradeId);
        setTxHash(submission.transactionHash);
        updateToast(correlationId, { type: "success", title: "Success", message: "Trade created — funds locked.", duration: 5000 });
        // Clear draft on success
        try { localStorage.removeItem("amana:draft-trade"); } catch {}
      } catch (err) {
        if (!navigator.onLine) {
          enqueue({
            type: "create-trade",
            endpoint: "/trades",
            method: "POST",
            body: requestPayload,
            idempotencyKey,
            correlationId,
          });
          router.push('/trades/queue');
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to submit trade');
      } finally {
        setLoading(false);
      }
    } finally {
      submittingRef.current = false;
    }
  };

  const displayedTradeId = completedTrade?.tradeId ?? tradeId;
  const displayedTxHash = completedTrade?.transactionHash ?? txHash;

  if (displayedTradeId && displayedTxHash) {
    return (
    <div className="step-review">
      <h2>{translateCopy("ui.review_trade_56119c6")}</h2>

      <div className="review-summary">
        <div>
          <p className="text-text-primary font-semibold text-lg">{translateCopy("ui.trade_created_c6d612a")}</p>
          <p className="text-text-secondary text-sm mt-1">{translateCopy("ui.funds_locked_in_escrow_vault_b134ccb")}</p>
        </div>
        <div className="w-full rounded-lg bg-bg-elevated border border-border-default px-4 py-3 text-left">
          <p className="text-xs text-text-muted mb-1">{translateCopy("ui.trade_id_153d513")}</p>
          <p className="text-emerald font-mono text-sm break-all">{displayedTradeId}</p>
        </div>
        <div className="w-full rounded-lg bg-bg-elevated border border-border-default px-4 py-3 text-left">
          <p className="text-xs text-text-muted mb-1">{translateCopy("ui.transaction_hash_7534364")}</p>
          <p className="text-emerald font-mono text-sm break-all">{displayedTxHash}</p>
        </div>
        <button
          onClick={() => router.push(`/trades/${displayedTradeId}`)}
          className="h-12 w-full flex items-center justify-center rounded-full bg-gradient-gold-cta text-text-inverse font-semibold"
        >
          {translateCopy("ui.view_trade_details_c527f5b")}
        </button>
        <Link
          href="/trades"
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          {translateCopy("ui.view_all_trades_20304ec")}
        </Link>
        {onStartNewTrade && (
          <button
            type="button"
            onClick={onStartNewTrade}
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            {translateCopy("ui.start_new_trade")}
          </button>
        )}
      </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center gap-6 py-6 text-center">
        <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <p className="text-text-primary font-semibold text-lg">{translateCopy("ui.authentication_required_fbbe499")}</p>
          <p className="text-text-secondary text-sm mt-1">
            {isWalletConnected
              ? "Sign in with your wallet to create trades."
              : "Connect your Freighter wallet to create trades."}
          </p>
        </div>
        <button
          onClick={() => isWalletConnected ? authenticate() : connectWallet()}
          disabled={loading}
          className="h-12 w-full flex items-center justify-center rounded-full bg-gradient-gold-cta text-text-inverse font-semibold disabled:opacity-50"
        >
          {isWalletConnected ? "Sign In" : "Connect Wallet"}
        </button>
        <button
          onClick={() => setStep(2)}
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          {translateCopy("ui.go_back_f03e2d0")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg bg-bg-elevated border border-border-default px-4 divide-y divide-border-default">
        <ReviewRow label="Commodity" value={data.commodity} />
        <ReviewRow label="Quantity" value={quantityDisplay} />
        <ReviewRow label="Unit Price (auto)" value={`${data.currency} ${unitPriceDisplay}`} />
        <ReviewRow label="Price per unit" value={`${data.currency} ${data.pricePerUnit}`} />
        <ReviewRow label="Total Value" value={`${data.currency} ${total}`} />
        <ReviewRow label="USDC Amount" value={`${amountUsdc} cNGN`} />
        <ReviewRow label="Seller Address" value={data.sellerAddress} />
        <ReviewRow label="Loss Ratio" value={`Buyer ${data.buyerRatio}% / Seller ${data.sellerRatio}%`} />
        <ReviewRow label="Delivery Window" value={`${data.deliveryDays} days`} />
        <ReviewRow
          label="Delivery Deadline"
          value={formatDeliveryWindowSummary(data.deliveryDeadline)}
        />
        {data.notes && <ReviewRow label="Notes" value={data.notes} />}
      </div>

      {/* Stellar path-payment slippage tolerance selector */}
      <div className="rounded-lg bg-bg-elevated border border-border-default px-4 py-3 flex flex-col gap-2" data-testid="slippage-tolerance-section">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Path-Payment Slippage Tolerance</span>
          <span className="text-xs text-text-muted">Max spend: {maxSlippageAmount} cNGN</span>
        </div>
        <div className="flex gap-2" role="group" aria-label="Slippage tolerance">
          {SLIPPAGE_TOLERANCE_OPTIONS.map((opt) => {
            const active = slippageTolerance === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => setSlippageTolerance(opt.value)}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium border transition-colors ${
                  active
                    ? "bg-gold-muted border-gold text-gold"
                    : "bg-bg-input border-border-default text-text-secondary"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Soroban transaction simulation fee & resource breakdown */}
      <div className="rounded-lg bg-bg-elevated border border-border-default px-4 py-3 flex flex-col gap-2" data-testid="soroban-simulation-breakdown">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">Soroban Simulation &amp; Fee Breakdown</span>
          <span className="text-xs font-mono text-gold">{simulation.totalEstimatedFeeXlm} XLM</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary pt-1 border-t border-border-default">
          <div>Base Inclusion Fee: <span className="text-text-primary font-mono">{simulation.baseFeeXlm} XLM</span></div>
          <div>Soroban Resource Fee: <span className="text-text-primary font-mono">{simulation.resourceFeeXlm} XLM</span></div>
          <div>CPU Instructions: <span className="text-text-primary font-mono">{simulation.cpuInstructions}</span></div>
          <div>Ledger I/O: <span className="text-text-primary font-mono">{simulation.ledgerReads}R / {simulation.ledgerWrites}W</span></div>
        </div>
      </div>

      {selfEscrow && (
        <p role="alert" aria-live="polite" className="text-status-danger text-sm text-center">
          Buyer and seller Stellar addresses cannot be identical.
        </p>
      )}

      {preparedXdr && xdrMaxTime !== null && (
        <XdrCountdownBadge
          maxTime={xdrMaxTime}
          onExpire={() => setXdrExpired(true)}
        />
      )}

      <div className="rounded-lg bg-gold-muted border border-gold/20 px-4 py-3 text-sm text-gold">
        {translateCopy("ui.by_submitting_you_authorize_a_st_2a21969")}{" "}{amountUsdc} {translateCopy("ui.cngn_in_the_amana_escrow_contrac_539a265")}
      </div>

      {error && (
        <p role="alert" aria-live="polite" className="text-status-danger text-sm text-center">{error}</p>
      )}
      {pendingCount > 0 && (
        <div className="rounded-lg bg-status-warning/10 border border-status-warning/30 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-status-warning">{pendingCount} {translateCopy("ui.queued_action_s_will_send_when_o_186a14f")}</span>
          <span className="text-xs text-text-muted">{translateCopy("ui.idempotency_keys_preserved_no_du_0f369d4")}</span>
        </div>
      )}

      <div className="flex gap-3">
        <button
          disabled={loading}
          onClick={() => setStep(2)}
          className="flex-1 h-12 rounded-full border border-border-default text-text-secondary hover:border-border-hover transition-colors disabled:opacity-40"
        >
          {translateCopy("common.back")}
        </button>
        {xdrExpired ? (
          <button
            disabled={refreshingXdr}
            onClick={() => void handleRefreshXdr()}
            className="flex-1 h-12 rounded-full bg-gradient-gold-cta text-text-inverse font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {refreshingXdr ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                Refreshing…
              </>
            ) : (
              "Refresh Quote / XDR"
            )}
          </button>
        ) : (
          <button
            disabled={loading || !isFormValid}
            onClick={() => setShowDisclaimer(true)}
            className="flex-1 h-12 rounded-full bg-gradient-gold-cta text-text-inverse font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                {translateCopy("ui.creating_trade_776cf21")}
              </>
            ) : (
              translateCopy("ui.lock_funds_create_trade")
            )}
          </button>
        )}
      </div>
      <LegalDisclaimerModal
        isOpen={showDisclaimer}
        onAccept={handleDisclaimerAccept}
        onDecline={() => setShowDisclaimer(false)}
        lossRatio={{ buyer: data.buyerRatio, seller: data.sellerRatio }}
        tradeValueCngn={Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount.toFixed(2) : "0"}
      />
    </div>
  );
}

export default Step3Review;
