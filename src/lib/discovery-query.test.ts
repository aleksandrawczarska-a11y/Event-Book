import { describe, expect, it } from "vitest";

import { buildDiscoverySearchHref, parseDiscoverySearchParams } from "@/lib/discovery-query";

describe("parseDiscoverySearchParams", () => {
  it("parses city, multi filters, and page", () => {
    const params = new URLSearchParams("city=Warszawa&event=Wesele&event=Urodziny&style=Boho&page=2");
    expect(parseDiscoverySearchParams(params)).toEqual({
      city: "Warszawa",
      eventTypes: ["Wesele", "Urodziny"],
      decorationStyles: ["Boho"],
      page: 2,
    });
  });

  it("drops invalid taxonomy values and clamps bad page", () => {
    const params = new URLSearchParams("event=Nope&style=AlsoNope&page=0");
    expect(parseDiscoverySearchParams(params)).toEqual({
      city: "",
      eventTypes: [],
      decorationStyles: [],
      page: 1,
    });
  });
});

describe("buildDiscoverySearchHref", () => {
  it("omits page=1 and empty filters", () => {
    expect(buildDiscoverySearchHref({ city: "", eventTypes: [], decorationStyles: [], page: 1 })).toBe("/search");
  });

  it("serializes filters and page>1", () => {
    expect(
      buildDiscoverySearchHref({
        city: "Kraków",
        eventTypes: ["Wesele"],
        decorationStyles: ["Boho"],
        page: 3,
      }),
    ).toBe("/search?city=Krak%C3%B3w&event=Wesele&style=Boho&page=3");
  });
});
