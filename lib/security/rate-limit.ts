/**
 * Rate limiting abstraction. The default in-memory token bucket protects a
 * single instance; in production swap `limiter` for a shared store (e.g. an
 * Upstash/Redis implementation of the same interface) — call sites don't change.
 */
export interface RateLimiter {
  take(key: string): Promise<{ ok: boolean; retryAfterMs: number }>;
}

export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, { tokens: number; updated: number }>();
  constructor(private capacity: number, private refillPerSec: number) {}
  async take(key: string) {
    const now = Date.now();
    const b = this.buckets.get(key) ?? { tokens: this.capacity, updated: now };
    b.tokens = Math.min(this.capacity, b.tokens + ((now - b.updated) / 1000) * this.refillPerSec);
    b.updated = now;
    if (b.tokens < 1) {
      this.buckets.set(key, b);
      return { ok: false, retryAfterMs: Math.ceil(((1 - b.tokens) / this.refillPerSec) * 1000) };
    }
    b.tokens -= 1;
    this.buckets.set(key, b);
    return { ok: true, retryAfterMs: 0 };
  }
}

/** Assistant: 20 messages burst, then one every 3 seconds per user. */
export const assistantLimiter: RateLimiter = new MemoryRateLimiter(20, 1 / 3);
/** Mutations (checkboxes, submissions): generous, protects against runaway clients. */
export const mutationLimiter: RateLimiter = new MemoryRateLimiter(60, 2);
