import { test, expect } from "@playwright/test";

/**
 * E2E coverage for unauthorized (non-admin wallet) access to admin routes.
 * Non-admin wallets must be redirected to /access-denied.
 */

const ADMIN_ROUTES = ["/admin/streams", "/admin/audit"];

for (const route of ADMIN_ROUTES) {
  test.describe(`unauthorized access to ${route}`, () => {
    test(`redirects non-admin wallet from ${route} to /access-denied`, async ({
      page,
    }) => {
      await page.goto(route);

      await expect(page).toHaveURL(/\/access-denied$/);
      await expect(page).not.toHaveURL(new RegExp(`${route}$`));
    });

    test(`does not render admin content for ${route}`, async ({ page }) => {
      await page.goto(route);

      await expect(page).toHaveURL(/\/access-denied$/);
      await expect(
        page.getByRole("heading", { name: /access denied/i }),
      ).toBeVisible();
    });
  });
}
