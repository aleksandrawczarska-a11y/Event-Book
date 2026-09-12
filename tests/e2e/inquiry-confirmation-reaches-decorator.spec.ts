// risk: test-plan.md #3 — client gets submit confirmation but the decorator never receives the lead
// seed: tests/seed.spec.ts

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { test, expect, type Page } from "@playwright/test";

const execFileAsync = promisify(execFile);

const BASE = "http://localhost:4321";
const FLORA_PROFILE = `${BASE}/d/6c310b9e-603f-4e58-ab94-34f212c5daa1`;
const DECORATOR_EMAIL = "florist@eventbook.local";
const DECORATOR_PASSWORD = process.env.E2E_FLORIST_PASSWORD ?? "EventBookDecor1!";

async function fillInquiryForm(
  page: Page,
  values: { name: string; email: string; date: string; needs: string },
) {
  const name = page.getByRole("textbox", { name: "Your name" });
  const email = page.getByRole("textbox", { name: "Your email" });
  const date = page.getByRole("textbox", { name: "Event date" });
  const needs = page.getByRole("textbox", { name: "What do you need?" });

  // Re-assert every field together so a mid-loop React hydrate cannot leave name empty.
  await expect(async () => {
    await name.fill(values.name);
    await email.fill(values.email);
    await date.fill(values.date);
    await needs.fill(values.needs);
    await expect(name).toHaveValue(values.name);
    await expect(email).toHaveValue(values.email);
    await expect(date).toHaveValue(values.date);
    await expect(needs).toHaveValue(values.needs);
  }).toPass();
}

test.describe("Risk #3 — inquiry confirmation must mean the decorator has the lead", () => {
  const stamp = Date.now();
  const clientName = `E2E Risk3 ${stamp}`;
  const clientEmail = `e2e-risk3-${stamp}@example.test`;

  test.afterEach(async () => {
    const escaped = clientEmail.replaceAll("'", "''");
    const dir = await mkdtemp(join(tmpdir(), "e2e-inquiry-"));
    const sqlFile = join(dir, "cleanup.sql");
    await writeFile(sqlFile, `delete from public.contact_inquiries where client_email = '${escaped}';\n`);
    try {
      await execFileAsync("npx", ["supabase", "db", "query", "--local", "-f", sqlFile], {
        cwd: process.cwd(),
        shell: true,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("guest confirmation is visible and the owning decorator sees the same lead", async ({ browser, page }) => {
    // Guest opens a published profile and submits a unique inquiry (honeypot left empty).
    await page.goto(FLORA_PROFILE, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Flora Test Studio" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Send an inquiry" })).toBeVisible();

    // Fill after the React island hydrates — SSR-controlled inputs reset pre-hydrate fills.
    await fillInquiryForm(page, {
      name: clientName,
      email: clientEmail,
      date: "2026-10-01",
      needs: `Need floral arch ${stamp}`,
    });

    const created = page.waitForResponse(
      (response) => response.url().includes("/api/inquiries") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Send inquiry" }).click();
    const apiResponse = await created;
    expect(apiResponse.status()).toBe(201);

    // Client-visible confirmation (200/201 is not enough — this is the island state).
    await expect(page.getByText(/Thanks — your inquiry was sent to Flora Test Studio/)).toBeVisible();

    // Decorator session via the sign-in API (not the login UI). The lead must appear in-panel.
    const decoratorContext = await browser.newContext();
    const signIn = await decoratorContext.request.post(`${BASE}/api/auth/signin`, {
      form: { email: DECORATOR_EMAIL, password: DECORATOR_PASSWORD },
      headers: { Origin: BASE },
      maxRedirects: 5,
    });
    expect(new URL(signIn.url()).pathname).toBe("/dashboard");

    const decoratorPage = await decoratorContext.newPage();
    await decoratorPage.goto(`${BASE}/dashboard/inquiries`);
    await expect(decoratorPage.getByRole("heading", { name: "Inquiries" })).toBeVisible();
    await expect(decoratorPage.getByText(clientName, { exact: true })).toBeVisible();
    await expect(decoratorPage.getByRole("link", { name: clientEmail })).toBeVisible();

    await decoratorContext.close();
  });
});
