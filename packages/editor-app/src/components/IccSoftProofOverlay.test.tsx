// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  IccSoftProofLoaderFn,
  IccSoftProofOverlayProps,
  IccSoftProofResult,
  SoftProofIntent,
} from "./IccSoftProofOverlay";

// Type-contract surface for C5 — pins the wire shape and the loader
// adapter signature. The visual canvas behaviour is host-driven
// (host wires a real compile-pdf endpoint); this file guards the
// public types so a host's adapter stays well-typed.

// vitest's default node env doesn't ship `ImageData`; a minimal
// structural stub is enough because these tests only check the
// type contract, not pixel walking.
function stubImageData(w: number, h: number): ImageData {
  return {
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
    colorSpace: "srgb",
  } as ImageData;
}

describe("SoftProofIntent literal union", () => {
  it("accepts the four ICC v4 rendering intents", () => {
    const intents: SoftProofIntent[] = [
      "perceptual",
      "relative-colorimetric",
      "saturation",
      "absolute-colorimetric",
    ];
    expect(intents).toHaveLength(4);
  });
});

describe("IccSoftProofResult contract", () => {
  it("carries deltaE ImageData + max + avg", () => {
    const result: IccSoftProofResult = {
      deltaE: stubImageData(2, 2),
      max: 12.4,
      avg: 3.1,
    };
    expect(result.deltaE.width).toBe(2);
    expect(result.max).toBeCloseTo(12.4);
    expect(result.avg).toBeCloseTo(3.1);
  });
});

describe("IccSoftProofLoaderFn contract", () => {
  it("accepts a four-field input and resolves to IccSoftProofResult", async () => {
    const loader: IccSoftProofLoaderFn = async (input) => {
      expect(input.documentB64).toBe("...");
      expect(input.sourceProfile).toBe("ISOcoated_v2_eci");
      expect(input.destinationProfile).toBe("USWebUncoated");
      expect(input.intent).toBe("perceptual");
      return { deltaE: stubImageData(1, 1), max: 0, avg: 0 };
    };
    const r = await loader({
      documentB64: "...",
      sourceProfile: "ISOcoated_v2_eci",
      destinationProfile: "USWebUncoated",
      intent: "perceptual",
    });
    expect(r.max).toBe(0);
  });
});

describe("IccSoftProofOverlayProps contract", () => {
  it("requires documentB64?, profiles, loader, width, height — intent is optional", () => {
    const loader: IccSoftProofLoaderFn = async () => ({
      deltaE: stubImageData(1, 1),
      max: 0,
      avg: 0,
    });
    const minimal: IccSoftProofOverlayProps = {
      documentB64: undefined,
      sourceProfile: undefined,
      destinationProfile: undefined,
      loader,
      width: 100,
      height: 100,
    };
    const full: IccSoftProofOverlayProps = {
      ...minimal,
      documentB64: "...",
      sourceProfile: "ISOcoated_v2_eci",
      destinationProfile: "USWebUncoated",
      intent: "saturation",
    };
    expect(full.intent).toBe("saturation");
    expect(minimal.intent).toBeUndefined();
  });
});
