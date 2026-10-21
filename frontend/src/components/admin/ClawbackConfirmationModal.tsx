"use client";
import { useEffect, useId, useState } from "react";
import { t as translateCopy } from "@/lib/i18n";


import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { ClawbackReasonCode } from "@/lib/clawbackValidation";

export interface ClawbackConfirmationModalProps {
  open: boolean;
  streamId: string;
  amount: string;
  remainingVested: string;
  /** Structured reason category selected by the operator. */
  reasonCode: ClawbackReasonCode | "";
  /** Audit reference ticket ID for the clawback request. */
  auditTicketId: string;
  onPreview: () => void;
  onCancel: () => void;
  /** true while the read-only preview request is in flight. */
  previewing?: boolean;
}

/**
 * Review gate for the read-only clawback preview. Dismissing the modal never
 * sends a request.
 */
export function ClawbackConfirmationModal({
  open,
  streamId,
  amount,
  remainingVested,
  reasonCode,
  auditTicketId,
  onPreview,
  onCancel,
  previewing = false,
}: ClawbackConfirmationModalProps) {
  const confirmationInputId = useId();
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [touched, setTouched] = useState(false);

  // Reset the typed phrase whenever the modal is (re)opened or the target changes.
  useEffect(() => {
    if (open) {
      setConfirmationPhrase("");
      setTouched(false);
    }
  }, [open, streamId]);

  const phraseMatches = confirmationPhrase === streamId;
  const showMismatch = touched && !phraseMatches;
  const canPreview = phraseMatches && !previewing;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <ModalContent mobileFullScreen={false}>
        <ModalHeader>
          <ModalTitle>{translateCopy("ui.confirm_clawback_57d9d44")}</ModalTitle>
          <ModalDescription>
            {translateCopy("ui.this_immediately_reduces_the_str_1e72f81")}
          </ModalDescription>
        </ModalHeader>

        <ModalBody>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-text-secondary">{translateCopy("ui.stream_id_ca9cac7")}</dt>
              <dd className="font-medium text-text-primary break-all text-right">{streamId}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-text-secondary">{translateCopy("ui.requested_amount_fc34a66")}</dt>
              <dd className="font-medium text-text-primary">{amount}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-text-secondary">{translateCopy("ui.remaining_vested_b10806c")}</dt>
              <dd className="font-medium text-text-primary">{remainingVested}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-text-secondary">Reason code</dt>
              <dd className="font-medium text-text-primary break-all text-right">
                {reasonCode || "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-text-secondary">Audit ticket</dt>
              <dd className="font-medium text-text-primary break-all text-right">
                {auditTicketId || "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 space-y-1">
            <label
              htmlFor={confirmationInputId}
              className="block text-sm text-text-secondary"
            >
              Type the stream ID to confirm
            </label>
            <input
              id={confirmationInputId}
              type="text"
              value={confirmationPhrase}
              onChange={(event) => setConfirmationPhrase(event.target.value)}
              onBlur={() => setTouched(true)}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={showMismatch}
              aria-describedby={showMismatch ? `${confirmationInputId}-error` : undefined}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={streamId}
            />
            {showMismatch && (
              <p
                id={`${confirmationInputId}-error`}
                role="alert"
                className="text-sm text-danger"
              >
                Confirmation phrase does not match the stream ID.
              </p>
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" onClick={onCancel} disabled={previewing}>
            {translateCopy("common.cancel")}
          </Button>
          <Button variant="primary" onClick={onPreview} disabled={!canPreview}>
            {previewing ? "Loading preview…" : "Run preview"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
