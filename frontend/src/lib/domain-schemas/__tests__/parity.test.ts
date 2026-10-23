/**
 * Divergence / acceptance-parity test for the shared trade domain schema.
 *
 * `createTradeInputSchema` is consumed by BOTH the backend request validator
 * (maintained in the yakzagri-flow backend repository) and the frontend
 * trade-creation form (`Step3Review.tsx`). This suite fuzzes thousands of
 * inputs and asserts the
 * schema's accept/reject decision matches an independent reference predicate
 * derived from the documented domain rules — so client and server can never
 * disagree about what a valid trade is.
 */
import fc from "fast-check";
import { StrKey } from "@stellar/stellar-sdk";
import {
  COMMODITY_UNITS,
  createTradeInputSchema,
  DEFAULT_LOSS_BPS,
  LOSS_BPS_SUM,
  USDC_AMOUNT_REGEX,
} from "../trade";

/** Independent restatement of the rules — intentionally NOT importing the schema logic. */
function referenceAccepts(input: Record<string, unknown>): boolean {
  const {
    buyerAddress,
    sellerAddress,
    amountUsdc,
    buyerLossBps,
    sellerLossBps,
    description,
    quantity,
    unit,
  } = input;

  const isValidAddress = (address: unknown): boolean => {
    if (typeof address !== "string") return false;
    const trimmed = address.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("G")) return StrKey.isValidEd25519PublicKey(trimmed);
    if (trimmed.startsWith("C")) return StrKey.isValidContract(trimmed);
    return false;
  };

  if (typeof sellerAddress !== "string" || !isValidAddress(sellerAddress)) {
    return false;
  }
  if (buyerAddress !== undefined && !isValidAddress(buyerAddress)) {
    return false;
  }

  const amountOk =
    (typeof amountUsdc === "string" && USDC_AMOUNT_REGEX.test(amountUsdc)) ||
    (typeof amountUsdc === "number" && Number.isFinite(amountUsdc) && amountUsdc > 0);
  if (!amountOk) return false;

  for (const bps of [buyerLossBps, sellerLossBps]) {
    if (bps === undefined) continue;
    if (typeof bps !== "number" || !Number.isInteger(bps) || bps < 0 || bps > 10_000) {
      return false;
    }
  }

  const buyer = (buyerLossBps as number | undefined) ?? DEFAULT_LOSS_BPS;
  const seller = (sellerLossBps as number | undefined) ?? DEFAULT_LOSS_BPS;
  if (buyer + seller !== LOSS_BPS_SUM) return false;

  if (description !== undefined && typeof description !== "string") return false;

  if (
    quantity !== undefined &&
    (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0)
  ) {
    return false;
  }

  if (unit !== undefined && !(COMMODITY_UNITS as readonly unknown[]).includes(unit)) {
    return false;
  }

  return true;
}

const validKey = fc.oneof(
  fc.uint8Array({ minLength: 32, maxLength: 32 }).map((bytes) => StrKey.encodeEd25519PublicKey(bytes)),
  fc.uint8Array({ minLength: 32, maxLength: 32 }).map((bytes) => StrKey.encodeContract(bytes)),
);

const maybeKey = fc.oneof(
  validKey,
  fc.string(),
  fc.constant("not-a-key"),
  fc.constant("GABC"),
);

const amountArb = fc.oneof(
  fc.stringMatching(/^[0-9]{1,6}(\.[0-9]{1,7})?$/),
  fc.integer({ min: -50, max: 50 }),
  fc.double({ min: -10, max: 10, noNaN: true }),
  fc.string(),
);

const bpsArb = fc.oneof(
  fc.integer({ min: -200, max: 10_200 }),
  fc.double({ min: 0, max: 10_000 }),
  fc.constant(undefined),
);

const quantityArb = fc.oneof(
  fc.double({ min: 0.0001, max: 1_000_000, noNaN: true }),
  fc.integer({ min: -100, max: 100 }),
  fc.constant(0),
  fc.constant(undefined),
);

const unitArb = fc.oneof(
  fc.constantFrom(...COMMODITY_UNITS),
  fc.string(),
  fc.constant("bushels"),
  fc.constant(undefined),
);

const inputArb = fc.record(
  {
    sellerAddress: maybeKey,
    buyerAddress: fc.oneof(maybeKey, fc.constant(undefined)),
    amountUsdc: amountArb,
    buyerLossBps: bpsArb,
    sellerLossBps: bpsArb,
    description: fc.oneof(fc.string(), fc.constant(undefined)),
    quantity: quantityArb,
    unit: unitArb,
  },
  { requiredKeys: ["sellerAddress", "amountUsdc"] },
);

describe("shared trade schema — client/server acceptance parity", () => {
  it("accept/reject decision matches the reference predicate on fuzz inputs", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const schemaAccepts = createTradeInputSchema.safeParse(input).success;
        expect(schemaAccepts).toBe(referenceAccepts(input));
      }),
      { numRuns: 3000 },
    );
  });

  it("accepts a canonical valid trade", () => {
    const sellerAddress = StrKey.encodeEd25519PublicKey(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
    expect(
      createTradeInputSchema.safeParse({
        sellerAddress,
        amountUsdc: "1000.50",
        buyerLossBps: 4000,
        sellerLossBps: 6000,
      }).success,
    ).toBe(true);
  });

  it("rejects a loss split that does not sum to 10000", () => {
    const sellerAddress = StrKey.encodeEd25519PublicKey(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
    expect(
      createTradeInputSchema.safeParse({
        sellerAddress,
        amountUsdc: "1000",
        buyerLossBps: 4000,
        sellerLossBps: 5000,
      }).success,
    ).toBe(false);
  });

  it("accepts a trade with a valid quantity and unit", () => {
    expect(
      createTradeInputSchema.safeParse({
        sellerAddress: "G" + "A".repeat(55),
        amountUsdc: "1000",
        quantity: 50,
        unit: "bags",
      }).success,
    ).toBe(true);
  });

  it("rejects a zero or negative quantity", () => {
    for (const quantity of [0, -1, -50.5]) {
      expect(
        createTradeInputSchema.safeParse({
          sellerAddress: "G" + "A".repeat(55),
          amountUsdc: "1000",
          quantity,
          unit: "bags",
        }).success,
      ).toBe(false);
    }
  });

  it("rejects an unknown unit", () => {
    expect(
      createTradeInputSchema.safeParse({
        sellerAddress: "G" + "A".repeat(55),
        amountUsdc: "1000",
        quantity: 10,
        unit: "bushels",
      }).success,
    ).toBe(false);
  });
});
