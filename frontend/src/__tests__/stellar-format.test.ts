import {
  formatStroops,
  parseAmount,
  MAX_INT64_STROOPS,
} from "../lib/stellar-format";

describe("stellar-format edge cases", () => {
  describe("negative numbers", () => {
    it("rejects negative amounts on parse", () => {
      expect(() => parseAmount("-1")).toThrow();
      expect(() => parseAmount("-0.0000001")).toThrow();
    });

    it("formats negative stroops with a leading minus", () => {
      expect(formatStroops(-1n)).toBe("-0.0000001");
      expect(formatStroops(-10_000_000n)).toBe("-1");
    });
  });

  describe("scientific notation", () => {
    it("rejects scientific notation on parse", () => {
      expect(() => parseAmount("1e7")).toThrow();
      expect(() => parseAmount("1.5E-3")).toThrow();
    });
  });

  describe("max Int64 stroops", () => {
    it("parses the max Int64 stroop value", () => {
      expect(parseAmount("922337203685477.5807")).toBe(MAX_INT64_STROOPS);
    });

    it("rejects values above max Int64 stroops", () => {
      expect(() => parseAmount("922337203685477.5808")).toThrow();
    });

    it("round-trips the max Int64 stroop value", () => {
      expect(formatStroops(MAX_INT64_STROOPS)).toBe("922337203685477.5807");
    });
  });

  describe("trailing zeroes", () => {
    it("preserves significant trailing zeroes in the fraction", () => {
      expect(formatStroops(1_500_000n)).toBe("0.15");
      expect(formatStroops(1_000_000n)).toBe("0.1");
    });

    it("trims insignificant trailing zeroes", () => {
      expect(formatStroops(10_000_000n)).toBe("1");
      expect(formatStroops(0n)).toBe("0");
    });

    it("parses amounts with trailing zeroes", () => {
      expect(parseAmount("1.5000000")).toBe(15_000_000n);
      expect(parseAmount("1.0000000")).toBe(10_000_000n);
    });
  });

  describe("fuzz / mutation invariants", () => {
    const randomStroops = (): bigint => {
      const hi = BigInt(Math.floor(Math.random() * 0x1_0000_0000));
      const lo = BigInt(Math.floor(Math.random() * 0x1_0000_0000));
      return (hi << 32n) | lo;
    };

    it("round-trips random stroop values within Int64 range", () => {
      for (let i = 0; i < 200; i += 1) {
        const stroops = randomStroops() % (MAX_INT64_STROOPS + 1n);
        const formatted = formatStroops(stroops);
        expect(parseAmount(formatted)).toBe(stroops);
      }
    });

    it("round-trips random negative stroop values", () => {
      for (let i = 0; i < 100; i += 1) {
        const stroops = -(randomStroops() % (MAX_INT64_STROOPS + 1n));
        const formatted = formatStroops(stroops);
        expect(parseAmount(formatted)).toBe(stroops);
      }
    });

    it("never emits more than 7 fractional digits", () => {
      for (let i = 0; i < 200; i += 1) {
        const stroops = randomStroops() % (MAX_INT64_STROOPS + 1n);
        const [, fraction = ""] = formatStroops(stroops).split(".");
        expect(fraction.length).toBeLessThanOrEqual(7);
      }
    });

    it("rejects mutated inputs with invalid characters", () => {
      const base = "123.4567890";
      const mutations = ["1e3", "-1", "1,5", " 1", "1 ", "abc", "1.2.3", ""];
      for (const mutation of mutations) {
        expect(() => parseAmount(mutation)).toThrow();
      }
      expect(parseAmount(base)).toBe(1_234_567_890n);
    });
  });
});
