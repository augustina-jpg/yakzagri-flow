import {
  appUrlForPath,
  buildIpfsGatewayUrl,
  extractIpfsCid,
  screenForPath,
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

describe("IPFS CID extraction", () => {
  const cidV0 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
  const cidV1 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

  it("extracts the CID from ipfs:// URIs", () => {
    expect(extractIpfsCid(`ipfs://${cidV0}`)).toBe(cidV0);
    expect(extractIpfsCid(`ipfs://${cidV1}`)).toBe(cidV1);
    expect(extractIpfsCid(`ipfs://${cidV1}/video.mp4`)).toBe(cidV1);
  });

  it("extracts bare CIDv0 and CIDv1 strings", () => {
    expect(extractIpfsCid(cidV0)).toBe(cidV0);
    expect(extractIpfsCid(cidV1)).toBe(cidV1);
    expect(extractIpfsCid(`  ${cidV0}  `)).toBe(cidV0);
  });

  it("extracts the CID from gateway URLs", () => {
    expect(extractIpfsCid(`https://ipfs.io/ipfs/${cidV0}`)).toBe(cidV0);
    expect(extractIpfsCid(`https://gateway.pinata.cloud/ipfs/${cidV1}/video.mp4`)).toBe(
      cidV1,
    );
    expect(extractIpfsCid(`https://dweb.link/ipfs/${cidV1}?filename=video.mp4`)).toBe(
      cidV1,
    );
  });

  it("returns null for invalid input", () => {
    expect(extractIpfsCid("")).toBeNull();
    expect(extractIpfsCid("   ")).toBeNull();
    expect(extractIpfsCid("not-a-cid")).toBeNull();
    expect(extractIpfsCid("https://example.com/video.mp4")).toBeNull();
    expect(extractIpfsCid("ipfs://")).toBeNull();
  });
});

describe("IPFS gateway URL building", () => {
  const cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

  it("builds a URL for each gateway index", () => {
    const primary = buildIpfsGatewayUrl(cid, 0);
    const fallback = buildIpfsGatewayUrl(cid, 1);

    expect(primary).not.toBeNull();
    expect(fallback).not.toBeNull();
    expect(primary).not.toBe(fallback);
    expect(primary).toContain(cid);
    expect(fallback).toContain(cid);
    expect(primary).toMatch(/^https:\/\//);
    expect(fallback).toMatch(/^https:\/\//);
  });

  it("returns null for out-of-range indices", () => {
    expect(buildIpfsGatewayUrl(cid, -1)).toBeNull();
    expect(buildIpfsGatewayUrl(cid, 999)).toBeNull();
  });

  it("returns null for an invalid CID", () => {
    expect(buildIpfsGatewayUrl("not-a-cid", 0)).toBeNull();
    expect(buildIpfsGatewayUrl("", 0)).toBeNull();
  });
});