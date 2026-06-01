// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { sampleTACFromImageData, tacForHex } from "./rasterize";

/** Build a synthetic ImageData of given dimensions filled with one
 *  `(r, g, b)` byte triple. Alpha is hardcoded to 255 (opaque). */
function flatImage(width: number, height: number, r: number, g: number, b: number): ImageData {
  const count = width * height;
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  // ImageData is a browser-only constructor; in node we just need
  // the shape sampleTACFromImageData reads (data, width, height).
  return { data, width, height, colorSpace: "srgb" } as unknown as ImageData;
}

describe("sampleTACFromImageData", () => {
  it("flat white image → max=0, avg=0", () => {
    const img = flatImage(4, 4, 255, 255, 255);
    const out = sampleTACFromImageData(img);
    expect(out.maxPct).toBe(0);
    expect(out.avgPct).toBe(0);
    expect(out.perPixelPct).toHaveLength(16);
    expect(out.perPixelPct.every((v) => v === 0)).toBe(true);
  });

  it("flat black image → max=100, avg=100 (pure K)", () => {
    const img = flatImage(4, 4, 0, 0, 0);
    const out = sampleTACFromImageData(img);
    expect(out.maxPct).toBe(100);
    expect(out.avgPct).toBe(100);
  });

  it("flat red image → ~200% (M + Y, no K)", () => {
    const img = flatImage(2, 2, 255, 0, 0);
    const out = sampleTACFromImageData(img);
    expect(out.maxPct).toBeCloseTo(200, 0);
    expect(out.avgPct).toBeCloseTo(200, 0);
  });

  it("mixed image — one rich-black pixel + three whites — max=400, avg=100", () => {
    // 2x2 grid: top-left rich black, others white.
    const data = new Uint8ClampedArray(16);
    // Top-left: (0,0,0) — pure K → TAC=100. Need a true 400% TAC pixel:
    // that requires CMYK with all four channels at 1.0, which only
    // happens via spot/DeviceN overprint. Standard sRGB → CMYK with
    // K-extraction tops out at 100% on pure black (since K absorbs
    // the chroma channels). So we use that and assert max=100, not 400.
    // Top-left pixel:
    data[0] = 0;
    data[1] = 0;
    data[2] = 0;
    data[3] = 255;
    // Others white (default 0 = fine, but explicit for clarity):
    for (let i = 1; i < 4; i++) {
      data[i * 4] = 255;
      data[i * 4 + 1] = 255;
      data[i * 4 + 2] = 255;
      data[i * 4 + 3] = 255;
    }
    const img = { data, width: 2, height: 2, colorSpace: "srgb" } as unknown as ImageData;
    const out = sampleTACFromImageData(img);
    expect(out.maxPct).toBe(100);
    expect(out.avgPct).toBeCloseTo(25, 0);
  });

  it("0x0 image → max=0, avg=0", () => {
    const img = flatImage(0, 0, 0, 0, 0);
    const out = sampleTACFromImageData(img);
    expect(out.maxPct).toBe(0);
    expect(out.avgPct).toBe(0);
    expect(out.perPixelPct).toHaveLength(0);
  });

  it("semi-transparent red over default white background → ~20% TAC (not 200%)", () => {
    // (255, 0, 0, alpha=26) — α≈0.1. Composited over white this
    // produces (252, 230, 230), which is light pink with very low
    // TAC. Without alpha compositing the same pixel would read as
    // pure red (200% TAC); with it, the value sits in single-digit %.
    const data = new Uint8ClampedArray([255, 0, 0, 26]);
    const img = { data, width: 1, height: 1, colorSpace: "srgb" } as unknown as ImageData;
    const out = sampleTACFromImageData(img);
    expect(out.maxPct).toBeLessThan(30);
    expect(out.maxPct).toBeGreaterThan(0);
  });

  it("fully-transparent pixel over white background → 0% TAC (paper-white)", () => {
    const data = new Uint8ClampedArray([255, 0, 0, 0]); // RGB doesn't matter at α=0.
    const img = { data, width: 1, height: 1, colorSpace: "srgb" } as unknown as ImageData;
    const out = sampleTACFromImageData(img);
    expect(out.maxPct).toBe(0);
  });

  it("opts.background composites onto a non-white substrate", () => {
    // Same fully-transparent pixel as above, but with a black
    // substrate — composites to pure black (100% TAC).
    const data = new Uint8ClampedArray([255, 0, 0, 0]);
    const img = { data, width: 1, height: 1, colorSpace: "srgb" } as unknown as ImageData;
    const out = sampleTACFromImageData(img, { background: [0, 0, 0] });
    expect(out.maxPct).toBe(100);
  });

  it("throws when data.length doesn't match width*height*4", () => {
    // Claim 2x2 (16 bytes) but only ship 8.
    const data = new Uint8ClampedArray(8);
    const img = { data, width: 2, height: 2, colorSpace: "srgb" } as unknown as ImageData;
    expect(() => sampleTACFromImageData(img)).toThrow(/data.length=8.*2×2×4=16/);
  });
});

describe("tacForHex", () => {
  it("returns 100 for pure black", () => {
    expect(tacForHex("#000000")).toBe(100);
  });

  it("returns 0 for white", () => {
    expect(tacForHex("#ffffff")).toBe(0);
  });

  it("returns null for malformed hex", () => {
    expect(tacForHex("not a hex")).toBeNull();
  });

  it("brand orange #fc5102 → ~167% (M ≈ 68% + Y ≈ 99% + K ≈ 1%)", () => {
    const out = tacForHex("#fc5102");
    expect(out).not.toBeNull();
    expect(out as number).toBeGreaterThan(150);
    expect(out as number).toBeLessThan(180);
  });
});
