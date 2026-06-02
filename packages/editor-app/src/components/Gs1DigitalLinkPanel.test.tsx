// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GS1_DOMAIN,
  type Gs1AiEntry,
  type Gs1DigitalLinkPanelProps,
  type Gs1DigitalLinkResult,
  composeGs1DigitalLink,
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
