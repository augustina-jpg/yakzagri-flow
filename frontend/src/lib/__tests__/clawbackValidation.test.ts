import {
  CLAWBACK_REASON_CODES,
  validateClawbackAmount,
  validateClawbackRequest,
} from "../clawbackValidation";

describe("validateClawbackAmount", () => {
  it("is invalid when the input is empty", () => {
    expect(validateClawbackAmount("", "7500")).toEqual({
      valid: false,
      error: "Enter an amount.",
    });
  });

  it("is invalid when the input is whitespace only", () => {
    expect(validateClawbackAmount("   ", "7500")).toEqual({
      valid: false,
      error: "Enter an amount.",
    });
  });

  it("rejects non-numeric input", () => {
    const result = validateClawbackAmount("abc", "7500");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/whole number/i);
  });

  it("rejects a decimal amount", () => {
    const result = validateClawbackAmount("100.5", "7500");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/whole number/i);
  });

  it("rejects a negative amount", () => {
    const result = validateClawbackAmount("-100", "7500");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/whole number/i);
  });

  it("rejects zero (non-positive boundary)", () => {
    const result = validateClawbackAmount("0", "7500");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/greater than zero/i);
  });

  it("rejects an amount greater than the remaining vested balance", () => {
    const result = validateClawbackAmount("7501", "7500");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot exceed/i);
    expect(result.error).toContain("7500");
  });

  it("accepts an amount exactly equal to the remaining vested balance (boundary)", () => {
    expect(validateClawbackAmount("7500", "7500")).toEqual({ valid: true, error: null });
  });

  it("accepts an amount of 1 (smallest positive boundary)", () => {
    expect(validateClawbackAmount("1", "7500")).toEqual({ valid: true, error: null });
  });

  it("accepts a valid amount strictly less than remaining", () => {
    expect(validateClawbackAmount("3000", "7500")).toEqual({ valid: true, error: null });
  });

  it("handles very large amounts without precision loss", () => {
    const huge = "123456789012345678901234567890";
    expect(validateClawbackAmount(huge, huge)).toEqual({ valid: true, error: null });
    expect(validateClawbackAmount(huge, "1")).toMatchObject({ valid: false });
  });

  it("treats an unparsable remainingVested as zero remaining", () => {
    const result = validateClawbackAmount("1", "not-a-number");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot exceed/i);
  });
});

describe("validateClawbackRequest", () => {
  const targetId = "stream-42";

  const validRequest = {
    amount: "3000",
    remainingVested: "7500",
    reasonCode: "FRAUD_CONFIRMED" as const,
    auditTicketId: "SEC-1234",
    confirmationPhrase: "stream-42",
    targetId,
  };

  it("exposes the supported structured reason codes", () => {
    expect(CLAWBACK_REASON_CODES).toEqual([
      "FRAUD_CONFIRMED",
      "COURT_ORDER",
      "SANCTIONS_COMPLIANCE",
      "PROTOCOL_EMERGENCY",
    ]);
  });

  it("accepts a fully valid submission", () => {
    expect(validateClawbackRequest(validRequest)).toEqual({ valid: true, error: null });
  });

  it("rejects a missing reason code", () => {
    const result = validateClawbackRequest({ ...validRequest, reasonCode: "" });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/reason code/i);
  });

  it("rejects an unrecognized reason code", () => {
    const result = validateClawbackRequest({
      ...validRequest,
      reasonCode: "BECAUSE_I_SAID_SO" as unknown as typeof validRequest.reasonCode,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/reason code/i);
  });

  it("rejects a missing audit ticket reference", () => {
    const result = validateClawbackRequest({ ...validRequest, auditTicketId: "" });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/audit ticket/i);
  });

  it("rejects a whitespace-only audit ticket reference", () => {
    const result = validateClawbackRequest({ ...validRequest, auditTicketId: "   " });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/audit ticket/i);
  });

  it("rejects a missing confirmation phrase", () => {
    const result = validateClawbackRequest({ ...validRequest, confirmationPhrase: "" });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/confirmation/i);
  });

  it("rejects a confirmation phrase that does not match the target ID", () => {
    const result = validateClawbackRequest({
      ...validRequest,
      confirmationPhrase: "stream-43",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/confirmation/i);
    expect(result.error).toContain(targetId);
  });

  it("rejects a confirmation phrase that only differs by case or padding", () => {
    expect(
      validateClawbackRequest({ ...validRequest, confirmationPhrase: "STREAM-42" }).valid,
    ).toBe(false);
    expect(
      validateClawbackRequest({ ...validRequest, confirmationPhrase: " stream-42 " }).valid,
    ).toBe(false);
  });

  it("still surfaces amount validation errors", () => {
    const result = validateClawbackRequest({ ...validRequest, amount: "7501" });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot exceed/i);
  });
});
