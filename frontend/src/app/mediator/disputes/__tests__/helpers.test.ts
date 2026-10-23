import {
  getMediatorAddresses,
  isMediatorAddress,
  formatDate,
  formatAddress,
  getSlaStatus,
  sortDisputes,
  canSubmitResolution,
  getResolutionSplit,
  MIN_JUSTIFICATION_LENGTH,
  type MediatorDispute,
} from "../helpers";

describe("getMediatorAddresses", () => {
  it("falls back to the dev default when no env value is set", () => {
    expect(getMediatorAddresses(undefined)).toEqual(["GEXAMPLEMEDIATORPUBLICKEY1"]);
  });

  it("falls back to the dev default when the env value is empty", () => {
    expect(getMediatorAddresses("")).toEqual(["GEXAMPLEMEDIATORPUBLICKEY1"]);
  });

  it("parses a comma-separated allowlist and trims whitespace", () => {
    expect(getMediatorAddresses("GABC123, GDEF456 ,GHI789")).toEqual([
      "GABC123",
      "GDEF456",
      "GHI789",
    ]);
  });

  it("drops empty entries produced by trailing commas", () => {
    expect(getMediatorAddresses("GABC123,,")).toEqual(["GABC123"]);
  });
});

describe("isMediatorAddress", () => {
  const allowlist = ["GABC123", "GDEF456"];

  it("returns true when the address is on the allowlist", () => {
    expect(isMediatorAddress("GABC123", allowlist)).toBe(true);
  });

  it("returns false when the address is not on the allowlist", () => {
    expect(isMediatorAddress("GNOTALLOWED", allowlist)).toBe(false);
  });

  it("returns false for null or undefined addresses", () => {
    expect(isMediatorAddress(null, allowlist)).toBe(false);
    expect(isMediatorAddress(undefined, allowlist)).toBe(false);
  });
});

describe("formatDate", () => {
  it("formats an ISO string as 'Mon D, YYYY'", () => {
    expect(formatDate("2026-01-05T00:00:00Z")).toBe("5 Jan 2026");
  });
});

describe("formatAddress", () => {
  it("truncates long addresses to the first 6 and last 4 characters", () => {
    expect(formatAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ")).toBe("GABCDE...WXYZ");
  });

  it("passes short addresses through untouched", () => {
    expect(formatAddress("GSHORT")).toBe("GSHORT");
  });

  it("passes addresses exactly at the 12-character boundary through untouched", () => {
    expect(formatAddress("123456789012")).toBe("123456789012");
  });
});

describe("getSlaStatus", () => {
  const now = new Date("2026-01-10T12:00:00Z");
  const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  it("returns 'normal' for disputes younger than 12 hours", () => {
    expect(getSlaStatus(hoursAgo(0), now)).toBe("normal");
    expect(getSlaStatus(hoursAgo(11.99), now)).toBe("normal");
  });

  it("returns 'warning' at exactly 12 hours", () => {
    expect(getSlaStatus(hoursAgo(12), now)).toBe("warning");
  });

  it("returns 'warning' just under 24 hours", () => {
    expect(getSlaStatus(hoursAgo(23.99), now)).toBe("warning");
  });

  it("returns 'critical' at exactly 24 hours", () => {
    expect(getSlaStatus(hoursAgo(24), now)).toBe("critical");
  });

  it("returns 'critical' for disputes older than 24 hours", () => {
    expect(getSlaStatus(hoursAgo(72), now)).toBe("critical");
  });

  it("returns 'normal' for invalid dates", () => {
    expect(getSlaStatus("not-a-date", now)).toBe("normal");
    expect(getSlaStatus("", now)).toBe("normal");
  });
});

describe("sortDisputes", () => {
  const now = new Date("2026-01-10T12:00:00Z");
  const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  const makeDispute = (
    id: string,
    createdAt: string,
    amount: number,
  ): MediatorDispute =>
    ({
      id,
      createdAt,
      amount,
      status: "open",
    }) as unknown as MediatorDispute;

  const disputes = [
    makeDispute("recent-small", hoursAgo(1), 100),
    makeDispute("oldest-large", hoursAgo(48), 5000),
    makeDispute("middle-medium", hoursAgo(20), 1000),
  ];

  it("sorts by SLA urgency (oldest first) for 'sla'", () => {
    const sorted = sortDisputes(disputes, "sla", now);
    expect(sorted.map((d) => d.id)).toEqual([
      "oldest-large",
      "middle-medium",
      "recent-small",
    ]);
  });

  it("sorts by trade value descending for 'value'", () => {
    const sorted = sortDisputes(disputes, "value", now);
    expect(sorted.map((d) => d.id)).toEqual([
      "oldest-large",
      "middle-medium",
      "recent-small",
    ]);
  });

  it("sorts by creation date (oldest first) for 'date'", () => {
    const sorted = sortDisputes(disputes, "date", now);
    expect(sorted.map((d) => d.id)).toEqual([
      "oldest-large",
      "middle-medium",
      "recent-small",
    ]);
  });

  it("does not mutate the input array", () => {
    const original = [...disputes];
    sortDisputes(disputes, "sla", now);
    expect(disputes).toEqual(original);
  });
});

describe("canSubmitResolution", () => {
  it("returns false when the outcome is missing", () => {
    expect(canSubmitResolution("", "a".repeat(40))).toBe(false);
    expect(canSubmitResolution(null, "a".repeat(40))).toBe(false);
    expect(canSubmitResolution(undefined, "a".repeat(40))).toBe(false);
  });

  it("returns false when the justification is shorter than the minimum", () => {
    expect(canSubmitResolution("buyer", "too short")).toBe(false);
  });

  it("returns true when the justification is exactly the minimum length", () => {
    expect(
      canSubmitResolution("buyer", "a".repeat(MIN_JUSTIFICATION_LENGTH)),
    ).toBe(true);
  });

  it("returns false when the justification is whitespace-only", () => {
    expect(canSubmitResolution("buyer", " ".repeat(40))).toBe(false);
  });

  it("returns true when outcome and a long enough justification are provided", () => {
    expect(
      canSubmitResolution(
        "split",
        "Goods arrived damaged; partial refund agreed by both parties.",
      ),
    ).toBe(true);
  });
});

describe("getResolutionSplit", () => {
  it("assigns the full amount to the buyer for 'buyer'", () => {
    expect(getResolutionSplit("buyer", 1000)).toEqual({
      buyer: 1000,
      seller: 0,
    });
  });

  it("assigns the full amount to the seller for 'seller'", () => {
    expect(getResolutionSplit("seller", 1000)).toEqual({
      buyer: 0,
      seller: 1000,
    });
  });

  it("splits the amount 50/50 for 'split'", () => {
    expect(getResolutionSplit("split", 1000)).toEqual({
      buyer: 500,
      seller: 500,
    });
  });

  it("handles odd amounts without losing precision for 'split'", () => {
    const { buyer, seller } = getResolutionSplit("split", 1001);
    expect(buyer + seller).toBe(1001);
  });
});
