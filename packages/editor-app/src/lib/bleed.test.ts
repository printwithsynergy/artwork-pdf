// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { DEFAULT_BLEED_MM, formatBleed, parseBleed } from "./bleed";

describe("bleed", () => {
  it("DEFAULT_BLEED_MM is 0.125 in expressed in mm", () => {
    expect(DEFAULT_BLEED_MM).toBeCloseTo(3.175, 4);
  });

  it('parseBleed handles "0.125in"', () => {
    expect(parseBleed("0.125in")).toBeCloseTo(3.175, 4);
  });

  it('parseBleed handles "3mm" and bare numbers (default unit mm)', () => {
    expect(parseBleed("3mm")).toBe(3);
    expect(parseBleed("3.175")).toBeCloseTo(3.175, 4);
  });

  it("parseBleed returns undefined for missing or malformed input", () => {
    expect(parseBleed(undefined)).toBeUndefined();
    expect(parseBleed(null)).toBeUndefined();
    expect(parseBleed("")).toBeUndefined();
    expect(parseBleed("bogus")).toBeUndefined();
    expect(parseBleed("-1mm")).toBeUndefined();
  });

  it("formatBleed renders inches and mm without trailing zeros", () => {
    expect(formatBleed(3.175, "in")).toBe("0.125 in");
    expect(formatBleed(3, "mm")).toBe("3 mm");
  });
});
