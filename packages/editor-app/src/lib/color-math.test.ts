// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { hexToCmyk, parseHex, rgbToCmyk, tacPercent } from "./color-math";

describe("parseHex", () => {
  it("parses standard #rrggbb", () => {
    expect(parseHex("#000000")).toEqual([0, 0, 0]);
    expect(parseHex("#FFFFFF")).toEqual([1, 1, 1]);
    expect(parseHex("#FF0000")).toEqual([1, 0, 0]);
  });

  it("accepts the hash-less form", () => {
    expect(parseHex("00ff00")).toEqual([0, 1, 0]);
  });

  it("is case-insensitive", () => {
    expect(parseHex("#fc5102")).toEqual(parseHex("#FC5102"));
  });

  it("returns null on malformed input", () => {
    expect(parseHex("")).toBeNull();
    expect(parseHex("#xyz")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("#1234567")).toBeNull();
    expect(parseHex("notahex")).toBeNull();
  });

  it("short-form #rgb is not supported (returns null)", () => {
    expect(parseHex("#abc")).toBeNull();
  });
});

describe("rgbToCmyk", () => {
  it("pure white → all zero", () => {
    expect(rgbToCmyk(1, 1, 1)).toEqual({ c: 0, m: 0, y: 0, k: 0 });
  });

  it("pure black → k=1 only", () => {
    expect(rgbToCmyk(0, 0, 0)).toEqual({ c: 0, m: 0, y: 0, k: 1 });
  });

  it("pure red → m=1, y=1, c=0, k=0", () => {
    expect(rgbToCmyk(1, 0, 0)).toEqual({ c: 0, m: 1, y: 1, k: 0 });
  });

  it("pure green → c=1, y=1, m=0, k=0", () => {
    expect(rgbToCmyk(0, 1, 0)).toEqual({ c: 1, m: 0, y: 1, k: 0 });
  });

  it("pure blue → c=1, m=1, y=0, k=0", () => {
    expect(rgbToCmyk(0, 0, 1)).toEqual({ c: 1, m: 1, y: 0, k: 0 });
  });

  it("50% grey → k=0.5, no chroma", () => {
    const out = rgbToCmyk(0.5, 0.5, 0.5);
    expect(out.k).toBeCloseTo(0.5, 6);
    expect(out.c).toBeCloseTo(0, 6);
    expect(out.m).toBeCloseTo(0, 6);
    expect(out.y).toBeCloseTo(0, 6);
  });

  it("clamps inputs outside [0, 1]", () => {
    expect(rgbToCmyk(-1, 2, 0.5)).toEqual(rgbToCmyk(0, 1, 0.5));
  });
});

describe("hexToCmyk", () => {
  it("delegates to parseHex + rgbToCmyk", () => {
    const black = hexToCmyk("#000000");
    expect(black).toEqual({ c: 0, m: 0, y: 0, k: 1 });

    const white = hexToCmyk("#ffffff");
    expect(white).toEqual({ c: 0, m: 0, y: 0, k: 0 });
  });

  it("brand orange #fc5102", () => {
    const out = hexToCmyk("#fc5102");
    // R=252/255≈0.988, G=81/255≈0.318, B=2/255≈0.008.
    // k = 1 - 0.988 = 0.012. scale = 0.988.
    // c = (1 - 0.988 - 0.012)/0.988 ≈ 0
    // m = (1 - 0.318 - 0.012)/0.988 ≈ 0.679
    // y = (1 - 0.008 - 0.012)/0.988 ≈ 0.992
    expect(out).not.toBeNull();
    expect(out?.k).toBeCloseTo(0.012, 2);
    expect(out?.m).toBeCloseTo(0.679, 2);
    expect(out?.y).toBeCloseTo(0.992, 2);
    expect(out?.c).toBeCloseTo(0, 2);
  });

  it("returns null on malformed hex", () => {
    expect(hexToCmyk("not a color")).toBeNull();
  });
});

describe("tacPercent", () => {
  it("rich black ≈ 400%", () => {
    expect(tacPercent({ c: 1, m: 1, y: 1, k: 1 })).toBe(400);
  });

  it("white ≈ 0%", () => {
    expect(tacPercent({ c: 0, m: 0, y: 0, k: 0 })).toBe(0);
  });

  it("PANTONE-ish red (m=1, y=1) ≈ 200%", () => {
    expect(tacPercent({ c: 0, m: 1, y: 1, k: 0 })).toBe(200);
  });
});
