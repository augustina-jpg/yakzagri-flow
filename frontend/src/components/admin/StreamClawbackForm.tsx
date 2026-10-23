"use client";
import { t as translateCopy } from "@/lib/i18n";


import { useMemo, useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { ClawbackConfirmationModal } from "./ClawbackConfirmationModal";
import {
  validateClawbackAmount,
  validateClawbackRequest,
  CLAWBACK_REASON_CODES,
  type ClawbackReasonCode,
} from "@/lib/clawbackValidation";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { useToast } from "@/hooks/useToast";
import { api } from "@/lib/api";
import type { StreamClawbackPreviewResponse } from "@/lib/api";

export interface StreamClawbackFormProps {
  token: string;
  streamId: string;
  /** The stream's current remaining vested (unclaimed) balance, as an integer string. */
  remainingVested: string;
  onPreview?: (result: StreamClawbackPreviewResponse) => void;
}

/**
 * Admin clawback preview amount entry with client-side validation (#57).
 * Errors from the backend preview call
 * (invalid/too-large amount, 403, 500, ...) are surfaced via the shared
 * error-code -> message mapping (#59).
 */
export function StreamClawbackForm({
  token,
  streamId,
  remainingVested,
  onPreview,
}: StreamClawbackFormProps) {
  const [amount, setAmount] = useState("");
  const [reasonCode, setReasonCode] = useState<ClawbackReasonCode | "">("");
  const [auditTicketRef, setAuditTicketRef] = useState("");
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [touched, setTouched] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<StreamClawbackPreviewResponse | null>(null);

  const { handleError } = useErrorHandler();
  const { addToast } = useToast();

  const validation = useMemo(
    () => validateClawbackAmount(amount, remainingVested),
    [amount, remainingVested],
  );

  const requestValidation = useMemo(
    () =>
      validateClawbackRequest({
        reasonCode,
        auditTicketRef,
        confirmationPhrase,
        targetId: streamId,
      }),
    [reasonCode, auditTicketRef, confirmationPhrase, streamId],
  );

  const allValid = validation.valid && requestValidation.valid;

  const handleReviewClick = () => {
    setTouched(true);
    if (!allValid) return;
    setModalOpen(true);
  };

  const handleCancel = () => {
    setModalOpen(false);
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const result = await api.adminStreams.clawbackPreview(token, streamId, amount);
      setPreviewResult(result);
      addToast({
        type: "success",
        title: "Clawback preview ready",
        message: `Post-clawback balance would be ${result.postClawbackBalance}.`,
      });
      setModalOpen(false);
      onPreview?.(result);
    } catch (error) {
      handleError(error);
      setModalOpen(false);
    } finally {
      setPreviewing(false);
    }
  };

  const showError = touched && !validation.valid;
  const showRequestErrors = touched && !requestValidation.valid;

  return (
    <div className="space-y-4">
      <FormField
        label="Clawback amount"
        name="clawback-amount"
        required
        hint={`Remaining vested: ${remainingVested}`}
        error={showError ? (validation.error ?? undefined) : undefined}
      >
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setTouched(true);
            setPreviewResult(null);
          }}
          onBlur={() => setTouched(true)}
          className="w-full rounded-md border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-gold"
          placeholder="0"
        />
      </FormField>

      <FormField
        label="Regulatory reason code"
        name="clawback-reason-code"
        required
        error={showRequestErrors ? (requestValidation.errors.reasonCode ?? undefined) : undefined}
      >
        <select
          value={reasonCode}
          onChange={(e) => {
            setReasonCode(e.target.value as ClawbackReasonCode | "");
            setTouched(true);
            setPreviewResult(null);
          }}
          onBlur={() => setTouched(true)}
          className="w-full rounded-md border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-gold"
        >
          <option value="">Select a reason code</option>
          {CLAWBACK_REASON_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Audit ticket reference"
        name="clawback-audit-ticket"
        required
        error={showRequestErrors ? (requestValidation.errors.auditTicketRef ?? undefined) : undefined}
      >
        <input
          type="text"
          value={auditTicketRef}
          onChange={(e) => {
            setAuditTicketRef(e.target.value);
            setTouched(true);
            setPreviewResult(null);
          }}
          onBlur={() => setTouched(true)}
          className="w-full rounded-md border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-gold"
          placeholder="e.g. SEC-2024-00123"
        />
      </FormField>

      <FormField
        label={`Type "${streamId}" to confirm`}
        name="clawback-confirmation-phrase"
        required
        error={showRequestErrors ? (requestValidation.errors.confirmationPhrase ?? undefined) : undefined}
      >
        <input
          type="text"
          value={confirmationPhrase}
          onChange={(e) => {
            setConfirmationPhrase(e.target.value);
            setTouched(true);
            setPreviewResult(null);
          }}
          onBlur={() => setTouched(true)}
          className="w-full rounded-md border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-gold"
          placeholder={streamId}
        />
      </FormField>

      <Button variant="primary" onClick={handleReviewClick} disabled={!allValid}>
        {translateCopy("ui.review_clawback_043eda9")}
      </Button>

      {previewResult && (
        <div role="status" className="rounded-md border border-border-default bg-bg-elevated p-3 text-sm">
          <p className="font-medium text-text-primary">{translateCopy("ui.read_only_preview")}</p>
          <p className="mt-1 text-text-secondary">
            {translateCopy("ui.projected_vested_balance", { balance: previewResult.postClawbackBalance })}
          </p>
        </div>
      )}

      <ClawbackConfirmationModal
        open={modalOpen}
        streamId={streamId}
        amount={amount}
        remainingVested={remainingVested}
        reasonCode={reasonCode}
        auditTicketRef={auditTicketRef}
        confirmationPhrase={confirmationPhrase}
        onPreview={handlePreview}
        onCancel={handleCancel}
        previewing={previewing}
      />
    </div>
  );
}
