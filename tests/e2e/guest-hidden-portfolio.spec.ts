// risk: test-plan.md #1 — guest sees pending/rejected portfolio on a public profile
// seed: tests/seed.spec.ts

import { test, expect } from "@playwright/test";

const PROFILE_URL = "http://localhost:4321/d/2a2083c9-63a2-42a2-90ce-f417b23302f4";
const APPROVED_CAPTION = "Wesele - dekoracja sali i kościoła";
const REJECTED_CAPTION = "Badge test rejected";

test.describe("Risk #1 — hidden portfolio must not appear to guests", () => {
  test("guest public profile hides rejected portfolio and still shows an approved entry", async ({ page }) => {
    // Open a published profile that has both an approved and a rejected portfolio entry.
    await page.goto(PROFILE_URL);
    await expect(page.getByRole("heading", { name: "WeddPlan" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Portfolio" })).toBeVisible();

    // Approved caption must be visible so an empty gallery cannot pass as "safe".
    await expect(page.getByText(APPROVED_CAPTION)).toBeVisible();

    // Rejected caption must not appear — this is the named risk.
    await expect(page.getByText(REJECTED_CAPTION)).toHaveCount(0);

    // Same contract after SSR reload (guest navigation, not a cached island).
    await page.reload();
    await expect(page.getByText(APPROVED_CAPTION)).toBeVisible();
    await expect(page.getByText(REJECTED_CAPTION)).toHaveCount(0);
  });
});
