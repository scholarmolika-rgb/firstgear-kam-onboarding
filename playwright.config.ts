import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests run against a running app connected to a seeded Supabase project.
 *   $env:E2E_BASE_URL="http://localhost:3000"; npm run test:e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
});
