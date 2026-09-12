import { test, expect } from "@playwright/test";

/**
 * Seed exemplar for /10x-e2e. Generated specs must follow these patterns:
 * getByRole, one isolated cycle, wait-for-state, risk-tied name.
 */
test("guest search heading persists after page reload", async ({ page }) => {
  await page.goto("http://localhost:4321/search");

  const heading = page.getByRole("heading", { name: "Find a decorator" });
  await expect(heading).toBeVisible();

  await page.reload();
  await expect(heading).toBeVisible();
});
