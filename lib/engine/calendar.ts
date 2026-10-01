/** Onboarding-day arithmetic. Dates are ISO yyyy-mm-dd strings (UTC calendar dates). */

const MS_DAY = 86_400_000;

export function toDateOnly(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function parse(d: string): number {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

function isWeekend(ts: number) {
  const wd = new Date(ts).getUTCDay();
  return wd === 0 || wd === 6;
}

/**
 * Onboarding day number for `today`. Day 1 is the start date. Before the start
 * the result is 0. With BUSINESS counting, weekends don't advance the day.
 * The result is not capped at the programme length — callers decide how to
 * show days beyond it (e.g. an extension).
 */
export function onboardingDay(startDate: string, today: string, counting: "CALENDAR" | "BUSINESS" = "CALENDAR"): number {
  const s = parse(startDate);
  const t = parse(today);
  if (t < s) return 0;
  if (counting === "CALENDAR") return Math.floor((t - s) / MS_DAY) + 1;
  let n = 0;
  for (let ts = s; ts <= t; ts += MS_DAY) if (!isWeekend(ts)) n++;
  return Math.max(n, 1);
}

/** Calendar date on which a given onboarding day falls. */
export function dateForDay(startDate: string, day: number, counting: "CALENDAR" | "BUSINESS" = "CALENDAR"): string {
  const s = parse(startDate);
  if (counting === "CALENDAR") return new Date(s + (day - 1) * MS_DAY).toISOString().slice(0, 10);
  let ts = s;
  let n = isWeekend(ts) ? 0 : 1;
  while (n < day) {
    ts += MS_DAY;
    if (!isWeekend(ts)) n++;
  }
  return new Date(ts).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return new Date(parse(date) + days * MS_DAY).toISOString().slice(0, 10);
}
