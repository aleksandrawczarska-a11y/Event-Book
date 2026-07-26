import { describe, expect, it } from "vitest";

import { parseProfileBody, toSafeHttpUrl } from "./profile-schema";

const validDraft = {
  company_name: "Test Decorator",
  city: "Warsaw",
  description: null,
  contact_email: null,
  is_published: false,
  event_types: ["Wesele"],
  decoration_styles: ["Boho"],
};

describe("parseProfileBody", () => {
  it("accepts a valid draft without publish fields", () => {
    const result = parseProfileBody(validDraft);
    expect(result.success).toBe(true);
  });

  it("blocks publish without description", () => {
    const result = parseProfileBody({
      ...validDraft,
      contact_email: "decorator@example.com",
      is_published: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("description"))).toBe(true);
    }
  });

  it("blocks publish without contact_email", () => {
    const result = parseProfileBody({
      ...validDraft,
      description: "We decorate weddings",
      is_published: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("contact_email"))).toBe(true);
    }
  });

  it("accepts publish when all required fields are present", () => {
    const result = parseProfileBody({
      ...validDraft,
      description: "We decorate weddings",
      contact_email: "decorator@example.com",
      is_published: true,
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid taxonomy values", () => {
    const result = parseProfileBody({
      ...validDraft,
      event_types: ["Invalid event"],
    });

    expect(result.success).toBe(false);
  });

  it("accepts http(s) Instagram URLs and rejects other schemes", () => {
    expect(
      parseProfileBody({
        ...validDraft,
        instagram_url: "https://instagram.com/studio",
      }).success,
    ).toBe(true);

    expect(
      parseProfileBody({
        ...validDraft,
        instagram_url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
});

describe("toSafeHttpUrl", () => {
  it("allows http(s) and rejects other schemes", () => {
    expect(toSafeHttpUrl("https://instagram.com/studio")).toBe("https://instagram.com/studio");
    expect(toSafeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(toSafeHttpUrl("data:text/html,hi")).toBeNull();
  });
});
