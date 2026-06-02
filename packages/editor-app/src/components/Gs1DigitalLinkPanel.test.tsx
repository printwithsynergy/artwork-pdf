// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GS1_DOMAIN,
  type Gs1AiEntry,
  type Gs1DigitalLinkPanelProps,
  type Gs1DigitalLinkResult,
  composeGs1DigitalLink,
  isValidGs1Ai17,
} from "./Gs1DigitalLinkPanel";

// Type-contract surface + pure-function tests for G3. The composer is
// the meat of the feature (the panel is a thin form on top), so test
// the canonical Digital Link shapes here against the GS1 Digital Link
// Standard v1.3 examples.

describe("DEFAULT_GS1_DOMAIN", () => {
  it("is the GS1 community default resolver", () => {
    expect(DEFAULT_GS1_DOMAIN).toBe("id.gs1.org");
  });
});

describe("composeGs1DigitalLink", () => {
  it("composes a GTIN-only URL", () => {
    const result = composeGs1DigitalLink({
      domain: "id.gs1.org",
      gtin: "09506000134376",
    });
    expect(result.url).toBe("https://id.gs1.org/01/09506000134376");
    expect(result.pathSegment).toBe("/01/09506000134376");
    expect(result.querySegment).toBe("");
  });

  it("adds path-AIs in canonical 22 → 10 → 21 order regardless of input order", () => {
    const pathAis: Gs1AiEntry[] = [
      { ai: "21", value: "SN-001" },
      { ai: "10", value: "ABC123" },
      { ai: "22", value: "V1" },
    ];
    const result = composeGs1DigitalLink({
      domain: "id.gs1.org",
      gtin: "09506000134376",
      pathAis,
    });
    expect(result.pathSegment).toBe("/01/09506000134376/22/V1/10/ABC123/21/SN-001");
  });

  it("strips empty path-AI values", () => {
    const result = composeGs1DigitalLink({
      domain: "id.gs1.org",
      gtin: "09506000134376",
      pathAis: [
        { ai: "22", value: "" },
        { ai: "10", value: "ABC123" },
      ],
    });
    expect(result.pathSegment).toBe("/01/09506000134376/10/ABC123");
  });

  it("encodes query AIs and strips trailing slash on domain", () => {
    const result = composeGs1DigitalLink({
      domain: "id.gs1.org/",
      gtin: "09506000134376",
      queryAis: [
        { ai: "17", value: "270101" },
        { ai: "15", value: "260301" },
      ],
    });
    expect(result.url).toBe("https://id.gs1.org/01/09506000134376?17=270101&15=260301");
    expect(result.querySegment).toBe("?17=270101&15=260301");
  });

  it("percent-encodes values with reserved characters", () => {
    const result = composeGs1DigitalLink({
      domain: "id.gs1.org",
      gtin: "09506000134376",
      pathAis: [{ ai: "10", value: "lot/with spaces" }],
    });
    expect(result.pathSegment).toBe("/01/09506000134376/10/lot%2Fwith%20spaces");
  });
});

describe("composeGs1DigitalLink domain normalization", () => {
  it("strips a pasted https:// scheme so it doesn't double up", () => {
    const result = composeGs1DigitalLink({
      domain: "https://id.gs1.org",
      gtin: "09506000134376",
    });
    expect(result.url).toBe("https://id.gs1.org/01/09506000134376");
  });

  it("strips a pasted http:// scheme too", () => {
    const result = composeGs1DigitalLink({
      domain: "http://brand.example.com/",
      gtin: "09506000134376",
    });
    expect(result.url).toBe("https://brand.example.com/01/09506000134376");
  });

  it("trims leading/trailing whitespace from the domain", () => {
    const result = composeGs1DigitalLink({
      domain: "  id.gs1.org  ",
      gtin: "09506000134376",
    });
    expect(result.url).toBe("https://id.gs1.org/01/09506000134376");
  });

  it("falls back to DEFAULT_GS1_DOMAIN when the domain is empty/whitespace", () => {
    const result = composeGs1DigitalLink({
      domain: "   ",
      gtin: "09506000134376",
    });
    expect(result.url).toBe(`https://${DEFAULT_GS1_DOMAIN}/01/09506000134376`);
  });
});

describe("isValidGs1Ai17", () => {
  it("accepts a canonical YYMMDD", () => {
    expect(isValidGs1Ai17("270101")).toBe(true);
    expect(isValidGs1Ai17("250228")).toBe(true);
  });

  it("rejects wrong length / non-digit input", () => {
    expect(isValidGs1Ai17("27010")).toBe(false);
    expect(isValidGs1Ai17("2701011")).toBe(false);
    expect(isValidGs1Ai17("27-01-01")).toBe(false);
    expect(isValidGs1Ai17("abcdef")).toBe(false);
    expect(isValidGs1Ai17("")).toBe(false);
  });

  it("rejects out-of-range months and days", () => {
    expect(isValidGs1Ai17("271301")).toBe(false); // month 13
    expect(isValidGs1Ai17("270132")).toBe(false); // day 32
    expect(isValidGs1Ai17("270230")).toBe(false); // 2027 has no Feb 30
  });
});

describe("Gs1DigitalLinkResult contract", () => {
  it("carries url + pathSegment + querySegment", () => {
    const result: Gs1DigitalLinkResult = {
      url: "https://example.com/01/x",
      pathSegment: "/01/x",
      querySegment: "",
    };
    expect(result.url).toBe("https://example.com/01/x");
  });
});

describe("Gs1DigitalLinkPanelProps contract", () => {
  it("requires nothing — all props are optional", () => {
    const minimal: Gs1DigitalLinkPanelProps = {};
    expect(minimal.renderer).toBeUndefined();
    expect(minimal.onLink).toBeUndefined();
    expect(minimal.defaultDomain).toBeUndefined();
  });
});
