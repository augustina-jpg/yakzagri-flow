import {
  appUrlForPath,
  screenForPath,
  stellarExplorerTxUrl,
  webUrlForTrade,
} from "@/lib/links";

describe("web <-> app link mapping", () => {
  it("maps a trade detail path to the app scheme URL", () => {
    expect(appUrlForPath("/trades/T-123")).toBe("amanavault://trades/T-123");
    expect(screenForPath("/trades/T-123")).toBe("TradeDetail");
  });

  it("maps dispute + evidence + list paths", () => {
    expect(appUrlForPath("/disputes/D9")).toBe("amanavault://disputes/D9");
    expect(appUrlForPath("/trades/T1/evidence")).toBe("amanavault://evidence/T1");
    expect(appUrlForPath("/trades")).toBe("amanavault://trades");
  });

  it("returns null for non-deep-linkable paths", () => {
    expect(appUrlForPath("/dashboard")).toBeNull();
    expect(screenForPath("/settings")).toBeNull();
  });

  it("builds a shareable web URL for a trade", () => {
    expect(webUrlForTrade("T-123")).toBe("https://amanavault.app/trades/T-123");
  });
});

describe("stellarExplorerTxUrl", () => {
  const HASH = "3389e9f0f1a65f19736cacf544c2e825313e8447f569233bb8db39aa607c8889";

  it("builds a Stellar explorer URL for a transaction hash", () => {
    expect(stellarExplorerTxUrl(HASH)).toBe(
      `https://stellar.expert/explorer/testnet/tx/${HASH}`,
    );
  });

  it("supports a configurable network", () => {
    expect(stellarExplorerTxUrl(HASH, "public")).toBe(
      `https://stellar.expert/explorer/public/tx/${HASH}`,
    );
  });

  it("trims surrounding whitespace from the hash", () => {
    expect(stellarExplorerTxUrl(`  ${HASH}  `)).toBe(
      `https://stellar.expert/explorer/testnet/tx/${HASH}`,
    );
  });

  it("returns null for an empty hash", () => {
    expect(stellarExplorerTxUrl("")).toBeNull();
    expect(stellarExplorerTxUrl("   ")).toBeNull();
  });
});