import { test, expect, type Page } from "@playwright/test";

/**
 * Trade lifecycle E2E coverage.
 *
 * Covers the seller dispatch manifest submission (DriverManifestForm) and the
 * buyer Proof-of-Delivery (PoD) video evidence upload flow end-to-end.
 */

const SELLER = { email: "seller@example.com", password: "Password123!" };
const BUYER = { email: "buyer@example.com", password: "Password123!" };

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe("trade lifecycle", () => {
  test("seller submits driver manifest", async ({ page }) => {
    await login(page, SELLER);

    await page.goto("/seller/dispatch");
    await expect(
      page.getByRole("heading", { name: /driver manifest/i }),
    ).toBeVisible();

    // Driver details
    await page.getByLabel(/driver name/i).fill("Jane Hauler");
    await page.getByLabel(/vehicle plate/i).fill("ABC-1234");
    await page.getByLabel(/driver phone/i).fill("+15555550123");

    // Manifest line items
    await page.getByLabel(/commodity/i).fill("Arabica Coffee");
    await page.getByLabel(/quantity/i).fill("120");
    await page.getByLabel(/unit/i).selectOption("kg");

    await page.getByRole("button", { name: /add item/i }).click();
    await expect(page.getByText("Arabica Coffee")).toBeVisible();

    // Submit the manifest
    await page.getByRole("button", { name: /submit manifest/i }).click();

    await expect(
      page.getByText(/manifest submitted|submission received/i),
    ).toBeVisible();
  });

  test("seller manifest rejects missing driver name", async ({ page }) => {
    await login(page, SELLER);
    await page.goto("/seller/dispatch");

    await page.getByRole("button", { name: /submit manifest/i }).click();

    await expect(page.getByText(/driver name is required/i)).toBeVisible();
  });

  test("buyer uploads PoD video evidence", async ({ page }) => {
    await login(page, BUYER);

    await page.goto("/buyer/deliveries");
    await page.getByRole("link", { name: /view delivery|open delivery/i }).first().click();

    await expect(
      page.getByRole("heading", { name: /proof of delivery/i }),
    ).toBeVisible();

    // Upload a small synthetic video as PoD evidence.
    const videoBuffer = Buffer.from("fake-mp4-bytes-for-e2e");
    await page.getByLabel(/video evidence/i).setInputFiles({
      name: "pod-evidence.mp4",
      mimeType: "video/mp4",
      buffer: videoBuffer,
    });

    await expect(page.getByText("pod-evidence.mp4")).toBeVisible();

    await page.getByRole("button", { name: /upload evidence|submit proof/i }).click();

    await expect(
      page.getByText(/evidence uploaded|proof of delivery recorded/i),
    ).toBeVisible();
  });

  test("buyer PoD upload rejects unsupported file type", async ({ page }) => {
    await login(page, BUYER);
    await page.goto("/buyer/deliveries");
    await page.getByRole("link", { name: /view delivery|open delivery/i }).first().click();

    await page.getByLabel(/video evidence/i).setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a video"),
    });

    await expect(page.getByText(/unsupported file type|must be a video/i)).toBeVisible();
  });
});
