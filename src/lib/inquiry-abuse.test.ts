import { describe, expect, it } from "vitest";

import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  consumeInquiryRateLimit,
  getInquiryClientIp,
  hasInquiryHoneypotContent,
  resetInquiryRateLimitBuckets,
} from "./inquiry-abuse";

describe("hasInquiryHoneypotContent", () => {
  it("treats non-empty text as spam and ignores empty values", () => {
    expect(hasInquiryHoneypotContent("bot")).toBe(true);
    expect(hasInquiryHoneypotContent("   ")).toBe(false);
    expect(hasInquiryHoneypotContent(null)).toBe(false);
  });
});

describe("getInquiryClientIp", () => {
  it("prefers cf-connecting-ip and falls back to x-forwarded-for", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.1, 198.51.100.2",
    });
    expect(getInquiryClientIp(headers)).toBe("203.0.113.10");

    const forwardedOnly = new Headers({ "x-forwarded-for": "198.51.100.1, 198.51.100.2" });
    expect(getInquiryClientIp(forwardedOnly)).toBe("198.51.100.1");
  });
});

describe("consumeInquiryRateLimit", () => {
  it("limits repeated submits inside the time window", () => {
    resetInquiryRateLimitBuckets();
    const now = 1_000;

    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i += 1) {
      expect(consumeInquiryRateLimit("203.0.113.10", "profile-1", now).limited).toBe(false);
    }

    const blocked = consumeInquiryRateLimit("203.0.113.10", "profile-1", now);
    expect(blocked.limited).toBe(true);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the time window elapses", () => {
    resetInquiryRateLimitBuckets();
    const now = 5_000;
    consumeInquiryRateLimit("203.0.113.10", "profile-1", now);

    const afterWindow = consumeInquiryRateLimit("203.0.113.10", "profile-1", now + RATE_LIMIT_WINDOW_MS + 1);
    expect(afterWindow.limited).toBe(false);
    expect(afterWindow.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1);
  });
});
