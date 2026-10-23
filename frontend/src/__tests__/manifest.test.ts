import { readFileSync } from "fs";
import { join } from "path";

interface ManifestShortcut {
  name: string;
  url: string;
  icons?: unknown[];
}

interface WebManifest {
  start_url?: string;
  shortcuts?: ManifestShortcut[];
}

const manifest = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "public", "manifest.json"), "utf8"),
) as WebManifest;

describe("PWA manifest shortcuts", () => {
  it("exposes a shortcuts array", () => {
    expect(Array.isArray(manifest.shortcuts)).toBe(true);
  });

  it("provides the Create Trade, My Trades and Disputes shortcuts", () => {
    const urls = (manifest.shortcuts ?? []).map((shortcut) => shortcut.url);
    expect(urls).toEqual(
      expect.arrayContaining(["/trades/create", "/trades", "/mediator/disputes"]),
    );
  });

  it("gives every shortcut a name and at least one icon", () => {
    for (const shortcut of manifest.shortcuts ?? []) {
      expect(shortcut.name).toBeTruthy();
      expect(Array.isArray(shortcut.icons)).toBe(true);
      expect(shortcut.icons?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("keeps shortcut urls site-relative", () => {
    for (const shortcut of manifest.shortcuts ?? []) {
      expect(shortcut.url.startsWith("/")).toBe(true);
    }
  });
});
