import { test, expect } from "@playwright/test";

/**
 * Visual regression specs for the dashboard and its sibling routes.
 *
 * Each route is captured across the desktop and mobile viewports defined in
 * `playwright.config.ts` (chromium-desktop / chromium-mobile). Snapshots are
 * stored per-project so desktop and mobile baselines never collide.
 */

const ROUTES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "reputation", path: "/reputation" },
  { name: "settings", path: "/settings" },
  { name: "stream-detail", path: "/streams/1" },
] as const;

test.describe("visual regression", () => {
  for (const route of ROUTES) {
    test(`${route.name} page matches snapshot`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "networkidle" });

      // Wait for fonts to settle so text rendering is deterministic.
      await page.evaluate(() => document.fonts.ready);

      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: true,
      });
    });
  }
});
