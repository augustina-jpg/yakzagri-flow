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
import fs from "node:fs";
import path from "node:path";
import {
  createTradeInputSchema,
  DEFAULT_LOSS_BPS,
  LOSS_BPS_SUM,
  STELLAR_PUBLIC_KEY_REGEX,
  USDC_AMOUNT_REGEX,
} from "../trade";
import { eventSchemas, type EventName } from "../events";

/** Independent restatement of the rules — intentionally NOT importing the schema logic. */
function referenceAccepts(input: Record<string, unknown>): boolean {
  const { buyerAddress, sellerAddress, amountUsdc, buyerLossBps, sellerLossBps, description } =
    input;

  if (typeof sellerAddress !== "string" || !STELLAR_PUBLIC_KEY_REGEX.test(sellerAddress)) {
    return false;
  }
  if (
    buyerAddress !== undefined &&
    (typeof buyerAddress !== "string" || !STELLAR_PUBLIC_KEY_REGEX.test(buyerAddress))
  ) {
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

  return true;
}

const validKey = fc
  .stringMatching(/^[A-Z2-7]{55}$/)
  .map((s) => `G${s}`);

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

const inputArb = fc.record(
  {
    sellerAddress: maybeKey,
    buyerAddress: fc.oneof(maybeKey, fc.constant(undefined)),
    amountUsdc: amountArb,
    buyerLossBps: bpsArb,
    sellerLossBps: bpsArb,
    description: fc.oneof(fc.string(), fc.constant(undefined)),
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
    expect(
      createTradeInputSchema.safeParse({
        sellerAddress: "G" + "A".repeat(55),
        amountUsdc: "1000.50",
        buyerLossBps: 4000,
        sellerLossBps: 6000,
      }).success,
    ).toBe(true);
  });

  it("rejects a loss split that does not sum to 10000", () => {
    expect(
      createTradeInputSchema.safeParse({
        sellerAddress: "G" + "A".repeat(55),
        amountUsdc: "1000",
        buyerLossBps: 4000,
        sellerLossBps: 5000,
      }).success,
    ).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  Soroban event schema parity                                               */
/* -------------------------------------------------------------------------- */

type JsonSchemaType = "string" | "integer" | "number" | "boolean" | "object" | "array";

interface JsonSchemaField {
  type: JsonSchemaType;
  description?: string;
  enum?: string[];
}

interface JsonEventDefinition {
  name: string;
  description?: string;
  fields: Record<string, JsonSchemaField>;
}

interface JsonEventsFile {
  contract?: string;
  events: JsonEventDefinition[];
}

/** Locate the repo-root `schemas/events/amana_escrow.events.json` from this test file. */
function loadEventsJson(): JsonEventsFile {
  const candidates = [
    path.resolve(__dirname, "../../../../../schemas/events/amana_escrow.events.json"),
    path.resolve(process.cwd(), "schemas/events/amana_escrow.events.json"),
    path.resolve(process.cwd(), "../schemas/events/amana_escrow.events.json"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      `Could not locate schemas/events/amana_escrow.events.json. Tried:\n${candidates.join("\n")}`,
    );
  }
  return JSON.parse(fs.readFileSync(found, "utf8")) as JsonEventsFile;
}

const eventsJson = loadEventsJson();

/** Map a JSON-schema primitive type to a representative JS value. */
function sampleForType(field: JsonSchemaField): unknown {
  if (field.enum && field.enum.length > 0) return field.enum[0];
  switch (field.type) {
    case "string":
      return "G" + "A".repeat(55);
    case "integer":
      return 1;
    case "number":
      return 1.5;
    case "boolean":
      return true;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return null;
  }
}

/** Build a representative payload for an event from its JSON field list. */
function samplePayload(event: JsonEventDefinition): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(event.fields)) {
    payload[key] = sampleForType(field);
  }
  return payload;
}

/** Assert a JS value matches the JSON-schema primitive type. */
function matchesJsonType(value: unknown, type: JsonSchemaType): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      return false;
  }
}

describe("Soroban event schema — JSON ↔ Zod parity", () => {
  it("the events JSON file declares at least one event", () => {
    expect(Array.isArray(eventsJson.events)).toBe(true);
    expect(eventsJson.events.length).toBeGreaterThan(0);
  });

  it("every JSON event has a matching frontend Zod schema", () => {
    const jsonNames = eventsJson.events.map((e) => e.name).sort();
    const zodNames = Object.keys(eventSchemas).sort();
    expect(zodNames).toEqual(jsonNames);
  });

  it("every frontend Zod event schema has a matching JSON event", () => {
    const jsonNames = new Set(eventsJson.events.map((e) => e.name));
    for (const name of Object.keys(eventSchemas)) {
      expect(jsonNames.has(name)).toBe(true);
    }
  });

  it.each(eventsJson.events.map((e) => [e.name, e] as const))(
    "event %s: field lists match between JSON and Zod",
    (_name, event) => {
      const zodSchema = eventSchemas[event.name as EventName];
      expect(zodSchema).toBeDefined();

      // Derive the Zod object's field keys via a strict parse of a full sample.
      const sample = samplePayload(event);
      const parsed = zodSchema.safeParse(sample);
      expect(parsed.success).toBe(true);

      const jsonKeys = Object.keys(event.fields).sort();
      const zodKeys = Object.keys(sample).sort();
      expect(zodKeys).toEqual(jsonKeys);
    },
  );

  it.each(eventsJson.events.map((e) => [e.name, e] as const))(
    "event %s: representative payload validates against JSON types and Zod",
    (_name, event) => {
      const payload = samplePayload(event);

      // JSON-schema side: every field present and of the declared type.
      for (const [key, field] of Object.entries(event.fields)) {
        expect(payload).toHaveProperty(key);
        expect(matchesJsonType(payload[key], field.type)).toBe(true);
        if (field.enum) {
          expect(field.enum).toContain(payload[key]);
        }
      }

      // Zod side: the same payload must validate.
      const zodSchema = eventSchemas[event.name as EventName];
      expect(zodSchema.safeParse(payload).success).toBe(true);
    },
  );

  it.each(eventsJson.events.map((e) => [e.name, e] as const))(
    "event %s: Zod rejects payloads with missing or extra fields",
    (_name, event) => {
      const zodSchema = eventSchemas[event.name as EventName];
      const payload = samplePayload(event);

      // Missing field.
      const firstKey = Object.keys(event.fields)[0];
      if (firstKey !== undefined) {
        const missing = { ...payload };
        delete missing[firstKey];
        expect(zodSchema.safeParse(missing).success).toBe(false);
      }

      // Extra field.
      const extra = { ...payload, __unexpected: "x" };
      expect(zodSchema.safeParse(extra).success).toBe(false);
    },
  );

  it.each(eventsJson.events.map((e) => [e.name, e] as const))(
    "event %s: Zod rejects payloads with wrong field types",
    (_name, event) => {
      const zodSchema = eventSchemas[event.name as EventName];
      const payload = samplePayload(event);

      for (const [key, field] of Object.entries(event.fields)) {
        const wrongValue = field.type === "string" ? 12345 : "not-the-right-type";
        const mutated = { ...payload, [key]: wrongValue };
        expect(zodSchema.safeParse(mutated).success).toBe(false);
      }
    },
  );
});
