const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const inquiryRateLimitBuckets = new Map<string, RateLimitBucket>();

export function hasInquiryHoneypotContent(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function getInquiryClientIp(headers: Headers): string {
  const forwarded = headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}

export function consumeInquiryRateLimit(ip: string, decoratorProfileId: string, now = Date.now()) {
  const key = `${ip}:${decoratorProfileId}`;
  const existing = inquiryRateLimitBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    inquiryRateLimitBuckets.set(key, { count: 1, resetAt });
    return { limited: false, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { limited: true, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  inquiryRateLimitBuckets.set(key, existing);
  return { limited: false, remaining: RATE_LIMIT_MAX_REQUESTS - existing.count, resetAt: existing.resetAt };
}

export function resetInquiryRateLimitBuckets() {
  inquiryRateLimitBuckets.clear();
}

export { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS };
