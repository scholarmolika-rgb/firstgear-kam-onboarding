import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, parseConfig, configToSettings, validateConfig } from "@/lib/engine/config";
import { SETTINGS } from "@/lib/seed-data/journey";
import { onboardingDay, dateForDay } from "@/lib/engine/calendar";

describe("programme configuration", () => {
  it("parses the seeded settings into the default config", () => {
    const c = parseConfig(SETTINGS.map((s) => ({ key: s.key, value: s.value })));
    expect(c.weights).toEqual({ GOVERNANCE: 25, PEOPLE: 20, PROCESS: 30, PRODUCT: 25 });
    expect(c.greenThreshold).toBe(80);
    expect(c.amberThreshold).toBe(60);
    expect(c.day21Required).toBe(true);
    expect(c.sessionTypes).toHaveLength(10);
    expect(validateConfig(c)).toEqual([]);
  });

  it("round-trips through setting rows", () => {
    expect(parseConfig(configToSettings(DEFAULT_CONFIG))).toEqual(DEFAULT_CONFIG);
  });

  it("rejects pillar weights that do not total 100%", () => {
    const errs = validateConfig({ ...DEFAULT_CONFIG, weights: { GOVERNANCE: 30, PEOPLE: 20, PROCESS: 30, PRODUCT: 25 } });
    expect(errs.join(" ")).toMatch(/total 100% \(currently 105%\)/);
  });

  it("rejects an Amber threshold at or above Green", () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, amberThreshold: 80 }).join(" ")).toMatch(/Amber threshold must be lower/);
    expect(validateConfig({ ...DEFAULT_CONFIG, greenThreshold: 120 }).join(" ")).toMatch(/between 0 and 100/);
  });

  it("rejects an Amber refresh outside 3–5 days and a readiness composition not totalling 100", () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, amberRefreshDays: 7 }).join(" ")).toMatch(/3–5 days/);
    expect(validateConfig({ ...DEFAULT_CONFIG, readinessWeights: { tasks: 50, knowledge: 30, scenario: 25, gates: 15 } }).join(" ")).toMatch(/must total 100%/);
  });

  it("parses booleans stored as strings", () => {
    expect(parseConfig([{ key: "DAY21_REQUIRED", value: "false" }]).day21Required).toBe(false);
  });
});

describe("onboarding calendar", () => {
  it("Day 1 is the start date", () => {
    expect(onboardingDay("2026-10-01", "2026-10-01")).toBe(1);
    expect(onboardingDay("2026-10-01", "2026-10-15")).toBe(15);
    expect(onboardingDay("2026-10-01", "2026-09-30")).toBe(0);
  });

  it("business-day counting skips weekends", () => {
    // 2026-10-01 is a Thursday; Fri=2, Mon=3
    expect(onboardingDay("2026-10-01", "2026-10-05", "BUSINESS")).toBe(3);
    expect(dateForDay("2026-10-01", 3, "BUSINESS")).toBe("2026-10-05");
    expect(dateForDay("2026-10-01", 30)).toBe("2026-10-30");
  });
});
