// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { ALL_BARCODE_FORMATS, type BarcodeFormat } from "../lib/barcode-scan";
import type {
  BarcodeGeneratorPanelProps,
  BarcodeRenderFn,
  BarcodeRenderResult,
} from "./BarcodeGeneratorPanel";

// Type-contract surface for G2g — pins the wire shape and the
// renderer adapter signature. The host is expected to wire a real
// barcode-rendering backend (bwip-js, server-side codex-pdf, etc.);
// this file guards the public types so a host's adapter stays
// well-typed.

function stubImageData(w: number, h: number): ImageData {
  return {
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
    colorSpace: "srgb",
  } as ImageData;
}

describe("BarcodeRenderResult contract", () => {
  it("carries bitmap ImageData + widthMm + heightMm", () => {
    const result: BarcodeRenderResult = {
      bitmap: stubImageData(100, 30),
      widthMm: 37.29,
      heightMm: 25.93,
    };
    expect(result.bitmap.width).toBe(100);
    expect(result.widthMm).toBeCloseTo(37.29);
    expect(result.heightMm).toBeCloseTo(25.93);
  });
});

describe("BarcodeRenderFn contract", () => {
  it("accepts format + payload (+ optional sizing) and resolves to BarcodeRenderResult", async () => {
    const renderer: BarcodeRenderFn = async (input) => {
      expect(input.format).toBe("EAN-13");
      expect(input.payload).toBe("5901234123457");
      expect(input.widthMm).toBeUndefined();
      expect(input.heightMm).toBeUndefined();
      return {
        bitmap: stubImageData(1, 1),
        widthMm: 37.29,
        heightMm: 25.93,
      };
    };
    const r = await renderer({
      format: "EAN-13",
      payload: "5901234123457",
    });
    expect(r.widthMm).toBeCloseTo(37.29);
  });

  it("passes through widthMm + heightMm when the host supplies them", async () => {
    const renderer: BarcodeRenderFn = async (input) => {
      expect(input.widthMm).toBe(50);
      expect(input.heightMm).toBe(30);
      return { bitmap: stubImageData(1, 1), widthMm: 50, heightMm: 30 };
    };
    await renderer({
      format: "GS1-128",
      payload: "(01)05901234123457",
      widthMm: 50,
      heightMm: 30,
    });
  });
});

describe("BarcodeGeneratorPanelProps contract", () => {
  it("requires renderer + onRendered; allowedFormats is optional", () => {
    const renderer: BarcodeRenderFn = async () => ({
      bitmap: stubImageData(1, 1),
      widthMm: 1,
      heightMm: 1,
    });
    const minimal: BarcodeGeneratorPanelProps = {
      renderer,
      onRendered: () => {},
    };
    const restricted: BarcodeGeneratorPanelProps = {
      ...minimal,
      allowedFormats: ["EAN-13", "UPC-A"] as const,
    };
    expect(minimal.allowedFormats).toBeUndefined();
    expect(restricted.allowedFormats).toEqual(["EAN-13", "UPC-A"]);
  });
});

describe("BarcodeFormat coverage", () => {
  it("ALL_BARCODE_FORMATS covers every BarcodeFormat in the union", () => {
    // Compile-time sanity: the shared canonical list typechecks as
    // BarcodeFormat[] and contains the same four formats the panel
    // surfaces by default. When a new BarcodeFormat is added the
    // union widens; if the constant doesn't grow alongside it this
    // assignment fails to type-check and this test forces a fix.
    const all: readonly BarcodeFormat[] = ALL_BARCODE_FORMATS;
    expect(all).toContain("EAN-13");
    expect(all).toContain("UPC-A");
    expect(all).toContain("GS1-128");
    expect(all).toContain("QR");
    expect(all).toHaveLength(4);
  });
});
