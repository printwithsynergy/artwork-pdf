// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  type BarcodeDetection,
  scanBarcodes,
  validateBarcode,
  validateEAN13,
  validateGS1128,
  validateUPCA,
} from "./barcode-scan";

describe("validateEAN13", () => {
  it("accepts a known-good code (4006381333931 — KitKat)", () => {
    expect(validateEAN13("4006381333931")).toBe(true);
  });

  it("accepts another known-good code (5901234123457 — GTIN spec example)", () => {
    expect(validateEAN13("5901234123457")).toBe(true);
  });

  it("rejects a code with wrong check digit", () => {
    // 4006381333930 — last digit deliberately wrong (correct is 1).
    expect(validateEAN13("4006381333930")).toBe(false);
  });

  it("rejects short input", () => {
    expect(validateEAN13("123456789012")).toBe(false);
    expect(validateEAN13("")).toBe(false);
  });

  it("rejects long input", () => {
    expect(validateEAN13("12345678901234")).toBe(false);
  });

  it("rejects non-digit characters", () => {
    expect(validateEAN13("40063813339A1")).toBe(false);
  });
});

describe("validateUPCA", () => {
  it("accepts a known-good code (036000291452)", () => {
    expect(validateUPCA("036000291452")).toBe(true);
  });

  it("rejects a code with wrong check digit", () => {
    expect(validateUPCA("036000291451")).toBe(false);
  });

  it("rejects short input", () => {
    expect(validateUPCA("03600029145")).toBe(false);
  });

  it("rejects non-digit characters", () => {
    expect(validateUPCA("03600029145X")).toBe(false);
  });
});

describe("validateGS1128", () => {
  it("accepts a plausibly-structured payload starting with two digits", () => {
    expect(validateGS1128("0104006381333931")).toBe(true); // AI 01 + GTIN-14
  });

  it("accepts payloads with the GS separator (0x1D)", () => {
    expect(validateGS1128(`10ABC123\x1D17251231`)).toBe(true);
  });

  it("rejects empty payload", () => {
    expect(validateGS1128("")).toBe(false);
  });

  it("rejects payload without a leading numeric AI", () => {
    expect(validateGS1128("ABC123")).toBe(false);
  });

  it("rejects payloads with non-printable / non-GS control chars", () => {
    expect(validateGS1128("01\x00abc")).toBe(false);
  });

  it("rejects payloads longer than 48 chars", () => {
    expect(validateGS1128("01".padEnd(50, "x"))).toBe(false);
  });
});

describe("validateBarcode", () => {
  it("delegates to the per-format validator (EAN-13 valid)", () => {
    const det: BarcodeDetection = { code: "4006381333931", format: "EAN-13" };
    expect(validateBarcode(det).valid).toBe(true);
  });

  it("returns a reason for an invalid EAN-13", () => {
    const det: BarcodeDetection = { code: "4006381333930", format: "EAN-13" };
    const v = validateBarcode(det);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/EAN-13/);
  });

  it("QR with a non-empty payload is always valid (Reed-Solomon is the detector's job)", () => {
    const det: BarcodeDetection = { code: "https://example.com", format: "QR" };
    expect(validateBarcode(det).valid).toBe(true);
  });

  it("QR with an empty payload is invalid", () => {
    const det: BarcodeDetection = { code: "", format: "QR" };
    expect(validateBarcode(det).valid).toBe(false);
  });
});

describe("scanBarcodes", () => {
  it("returns an empty array for arbitrary input (stub until detector lands)", async () => {
    const data = new Uint8ClampedArray(16);
    const image = { data, width: 2, height: 2, colorSpace: "srgb" } as unknown as ImageData;
    const out = await scanBarcodes(image);
    expect(out).toEqual([]);
  });
});
