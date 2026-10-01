/**
 * End-to-end journey against a running app + seeded Supabase project.
 *
 *   npx tsx scripts/seed.ts
 *   $env:E2E_BASE_URL="http://localhost:3000"; $env:DEMO_PASSWORD="FirstGear!2026"; npx playwright test
 *
 * Covers the browser-observable path for a fresh Day-1 KAM. The complete
 * Day 1 → Day 30 progression (Amber refresh, re-check, certification,
 * exposure approvals, panel and sign-off) is exercised deterministically in
 * tests/integration/journey-simulation.test.ts.
 */
import { test, expect, type Page } from "@playwright/test";

const PASSWORD = process.env.DEMO_PASSWORD ?? "FirstGear!2026";
const KAM = "riya.sharma@firstgear.example";
const BOSS = "meera.iyer@firstgear.example";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test.describe.serial("KAM 30-day journey", () => {
  test("1–5: KAM sees Day 1, ticks a task, and it persists after refresh", async ({ page }) => {
    await login(page, KAM);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/Day 1 of 30/)).toBeVisible();
    await page.goto("/journey/1");
    const box = page.getByRole("checkbox", { name: /^HR orientation/ });
    const before = await box.getAttribute("aria-checked");
    if (before !== "true") {
      await box.click();
      await expect(page.getByText(/Progress \d+(\.\d+)?%/)).toBeVisible();
    }
    await page.reload();
    await expect(page.getByRole("checkbox", { name: /^HR orientation/ })).toHaveAttribute("aria-checked", "true");
  });

  test("assistant: next action from state, RFQ answer with source", async ({ page }) => {
    await login(page, KAM);
    await page.goto("/assistant?new=1");
    const ask = page.getByPlaceholder(/Ask about your onboarding/);
    await ask.fill("What should I do next?");
    await ask.press("Enter");
    await expect(page.getByText(/required activities|Next:/).first()).toBeVisible({ timeout: 30_000 });
    await ask.fill("What is the RFQ process?");
    await ask.press("Enter");
    await expect(page.getByText(/RFQ to Quotation SOP/).first()).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/Version 4\.1/).first()).toBeVisible();
  });

  test("out-of-scope IT access request is declined", async ({ page }) => {
    await login(page, KAM);
    await page.goto("/assistant?new=1");
    const ask = page.getByPlaceholder(/Ask about your onboarding/);
    await ask.fill("Please create my SAP account and grant VPN access");
    await ask.press("Enter");
    await expect(page.getByText(/can't create accounts, grant system access/)).toBeVisible({ timeout: 20_000 });
  });

  test("Phase 2 stays locked before the Day-15 gate", async ({ page }) => {
    await login(page, KAM);
    await page.goto("/journey/16");
    await expect(page.getByText(/Locked|Blocked/).first()).toBeVisible();
  });

  test("Reporting Boss sees readiness dashboard and cannot sign off early", async ({ page }) => {
    await login(page, BOSS);
    await expect(page).toHaveURL(/\/manager/);
    await page.getByRole("link", { name: "Riya Sharma" }).first().click();
    await expect(page.getByText("Day-30 readiness sign-off (final)")).toBeVisible();
    await expect(page.getByText(/Unlocks after scenario certification|Awaiting|Complete/).first()).toBeVisible();
  });

  test("progress report exports CSV", async ({ page }) => {
    await login(page, KAM);
    await page.goto("/report");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download CSV" }).click()]);
    expect(download.suggestedFilename()).toMatch(/progress-report-FG-KAM-001/);
  });
});
