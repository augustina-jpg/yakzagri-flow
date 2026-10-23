/**
 * Client-side validation for admin clawback amounts (#57), mirroring the
 * backend's `POST /admin/streams/:id/clawback/preview` checks so the submit
 * button can be disabled before a doomed request is ever sent.
 *
 * Amounts are arbitrary-precision integer strings (matching the backend's
 * `^\d+$` contract for `unclaimed`/`totalVested`), so this compares as
 * BigInt rather than risking float precision loss on large balances.
 *
 * Also validates the regulatory metadata required for administrative
 * clawbacks (#213): a structured reason code, an audit ticket reference, and
 * an exact confirmation phrase matching the target stream/trade ID.
 */
export interface ClawbackAmountValidation {
  valid: boolean;
  error: string | null;
}

export function validateClawbackAmount(
  amount: string,
  remainingVested: string,
): ClawbackAmountValidation {
  const trimmed = amount.trim();

  if (trimmed === "") {
    return { valid: false, error: "Enter an amount." };
  }

  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, error: "Amount must be a positive whole number." };
  }

  const requested = BigInt(trimmed);
  if (requested <= BigInt(0)) {
    return { valid: false, error: "Amount must be greater than zero." };
  }

  const remaining = /^\d+$/.test(remainingVested) ? BigInt(remainingVested) : BigInt(0);
  if (requested > remaining) {
    return {
      valid: false,
      error: `Amount cannot exceed the remaining vested balance of ${remainingVested}.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Structured regulatory reason categories permitted for an administrative
 * clawback. A free-text reason is not sufficient for audit purposes.
 */
export const CLAWBACK_REASON_CODES = [
  "FRAUD_CONFIRMED",
  "COURT_ORDER",
  "SANCTIONS_COMPLIANCE",
  "PROTOCOL_EMERGENCY",
] as const;

export type ClawbackReasonCode = (typeof CLAWBACK_REASON_CODES)[number];

export function isClawbackReasonCode(value: unknown): value is ClawbackReasonCode {
  return (
    typeof value === "string" &&
    (CLAWBACK_REASON_CODES as readonly string[]).includes(value)
  );
}

/**
 * Audit ticket references must be non-empty and contain only alphanumerics,
 * dashes, and underscores (e.g. `SEC-2024-00123`, `OPS_4567`).
 */
const AUDIT_TICKET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export interface ClawbackRequestValidation {
  valid: boolean;
  error: string | null;
}

export interface ClawbackRequestInput {
  /** Structured regulatory reason category. */
  reasonCode: string | null | undefined;
  /** Audit reference ticket ID tying the action to an external record. */
  auditTicket: string | null | undefined;
  /** Operator-typed confirmation phrase; must exactly match `targetId`. */
  confirmationPhrase: string | null | undefined;
  /** The stream or trade ID the clawback targets. */
  targetId: string;
}

export function validateAuditTicket(
  auditTicket: string | null | undefined,
): ClawbackRequestValidation {
  const trimmed = (auditTicket ?? "").trim();

  if (trimmed === "") {
    return { valid: false, error: "Enter an audit ticket reference." };
  }

  if (!AUDIT_TICKET_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error:
        "Audit ticket reference may only contain letters, numbers, dashes, and underscores.",
    };
  }

  return { valid: true, error: null };
}

export function validateConfirmationPhrase(
  confirmationPhrase: string | null | undefined,
  targetId: string,
): ClawbackRequestValidation {
  if ((confirmationPhrase ?? "") === "") {
    return { valid: false, error: "Type the confirmation phrase to proceed." };
  }

  if (confirmationPhrase !== targetId) {
    return {
      valid: false,
      error: `Confirmation phrase must exactly match the target ID "${targetId}".`,
    };
  }

  return { valid: true, error: null };
}

export function validateClawbackRequest(
  input: ClawbackRequestInput,
): ClawbackRequestValidation {
  if (!isClawbackReasonCode(input.reasonCode)) {
    return {
      valid: false,
      error: "Select a regulatory reason code.",
    };
  }

  const auditResult = validateAuditTicket(input.auditTicket);
  if (!auditResult.valid) {
    return auditResult;
  }

  return validateConfirmationPhrase(input.confirmationPhrase, input.targetId);
}