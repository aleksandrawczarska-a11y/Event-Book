import { describe, expect, it } from "vitest";

import { parseModerationQueueStatus } from "./moderation-queue";

describe("parseModerationQueueStatus", () => {
  it("defaults to pending when the query param is missing or unknown", () => {
    expect(parseModerationQueueStatus(null)).toBe("pending");
    expect(parseModerationQueueStatus("")).toBe("pending");
    expect(parseModerationQueueStatus("hide")).toBe("pending");
  });

  it("accepts approved and rejected so an admin can reverse a decision", () => {
    expect(parseModerationQueueStatus("approved")).toBe("approved");
    expect(parseModerationQueueStatus("rejected")).toBe("rejected");
  });
});
