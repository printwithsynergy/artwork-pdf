// SPDX-License-Identifier: AGPL-3.0-or-later

import { hexToCmyk, tacPercent } from "./color-math";

/**
 * Canvas → ImageData rasterization + per-pixel TAC sampling.
 *
 * The C4 "live total area coverage" feature reads the Konva Stage
 * as a raster, samples each pixel's effective CMYK contribution,
 * and surfaces the maximum + average TAC as a sanity-check overlay
 * for the user **before** they submit a render job.
 *
 * Browser-side approximation, not a substitute for compile-pdf's
 * ICC-aware server-side TAC check (`total_ink_coverage` preflight
 * rule). The editor flags obviously over-inked regions in real time;
 * the server-side check covers the colorimetric edge cases.
 *
 * Stage rasterization needs a live Konva instance + DOM, so the
 * functions here can't be unit-tested without jsdom. The pure pixel
 * sampler ({@link sampleTACFromImageData}) takes a synthetic
 * ImageData and is fully testable in node.
 */

/**
 * Konva Stage shape just deep enough for the rasterize call — keeps
 * this module from importing `konva` directly (the canvas already
 * pulls it; we just need the `toCanvas` method).
 */
type StageLike = {
  toCanvas: (cfg?: { pixelRatio?: number }) => HTMLCanvasElement;
};

/**
 * Render a Konva Stage to an `ImageData` buffer.
 *
 * `pixelRatio` defaults to `1` for performance; UIs that need
 * higher fidelity (separations panel, export preview) pass `2` or
 * more. The browser's own `HTMLCanvasElement.getContext("2d")
 * .getImageData()` does the heavy lift; this is a thin facade.
 *
 * Throws if the canvas's 2d context can't be acquired (extremely
 * rare; old browser quirks).
 *
 * @public
 */
export function rasterizeStage(
  stage: StageLike,
  opts: { pixelRatio?: number } = {},
): ImageData {
  const cfg: { pixelRatio?: number } = {};
  if (opts.pixelRatio !== undefined) cfg.pixelRatio = opts.pixelRatio;
  const canvas = stage.toCanvas(cfg);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("rasterizeStage: 2d context unavailable on stage canvas");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Per-pixel TAC summary across an `ImageData` buffer.
 *
 * Walks every pixel, converts its `(r, g, b)` to subtractive CMYK
 * (via the same {@link hexToCmyk}-equivalent math, applied directly
 * to the raw 0-255 bytes), and tracks the max + running sum so the
 * caller can compute the average.
 *
 * `perPixelPct` is a flat `Uint8ClampedArray` of `width × height`
 * entries; each is the TAC percent (0-400) clamped to a byte's
 * range (255 = >=255%, allowing the heatmap shader to render a
 * single-channel raster without scaling).
 *
 * **Alpha composite**: semi-transparent pixels are pre-blended onto
 * an opaque white background before the CMYK conversion. This
 * mirrors what the editor's canvas actually displays (everything
 * sits on the white page) so an `rgba(255,0,0,0.1)` pixel registers
 * as the ~20% TAC it'd actually print at, not the 200% full red it
 * would be without the composite step. Pass an `opts.background`
 * hex to composite onto a non-white substrate.
 *
 * **Approximation:** spot ink contribution is not modeled here. A
 * full per-separation pass requires masking pixels by ink (planned
 * for PR-9's UI overlay when the registered-spots map is available).
 *
 * Throws when `image.data.length !== image.width × image.height × 4`
 * — defensive against misuse from upstream callers that pass a
 * partially-constructed or mis-typed ImageData-shaped object.
 *
 * @public
 */
export function sampleTACFromImageData(
  image: ImageData,
  opts: { background?: [number, number, number] } = {},
): {
  maxPct: number;
  avgPct: number;
  perPixelPct: Uint8ClampedArray;
} {
  const { data, width, height } = image;
  const pixelCount = width * height;
  const expected = pixelCount * 4;
  if (data.length !== expected) {
    throw new Error(
      `sampleTACFromImageData: data.length=${data.length} but ${width}×${height}×4=${expected}`,
    );
  }

  const [bgR, bgG, bgB] = opts.background ?? [255, 255, 255];
  const perPixelPct = new Uint8ClampedArray(pixelCount);

  let maxPct = 0;
  let sumPct = 0;
  let i = 0;
  for (let p = 0; p < data.length; p += 4) {
    // Pre-multiply with the background ("over" composite) so
    // semi-transparent pixels reflect what's actually visible /
    // printable. Fully-opaque pixels (the common case) pass through
    // unchanged because alpha=1 collapses the lerp.
    const a = (data[p + 3] ?? 255) / 255;
    const inv = 1 - a;
    const r = ((data[p] ?? 0) * a + bgR * inv) / 255;
    const g = ((data[p + 1] ?? 0) * a + bgG * inv) / 255;
    const b = ((data[p + 2] ?? 0) * a + bgB * inv) / 255;
    // Subtractive RGB → CMYK with K-extraction; same math as
    // color-math.ts but inlined for the tight loop.
    const k = 1 - Math.max(r, g, b);
    let c = 0;
    let m = 0;
    let y = 0;
    if (k < 1) {
      const scale = 1 - k;
      c = (1 - r - k) / scale;
      m = (1 - g - k) / scale;
      y = (1 - b - k) / scale;
    }
    const tac = (c + m + y + k) * 100;
    if (tac > maxPct) maxPct = tac;
    sumPct += tac;
    perPixelPct[i++] = Math.min(255, Math.round(tac));
  }

  return {
    maxPct,
    avgPct: pixelCount > 0 ? sumPct / pixelCount : 0,
    perPixelPct,
  };
}

/**
 * Convenience: sample TAC from a raw hex color (single-pixel case).
 * Used by tests + the editor's color picker's at-a-glance feedback.
 *
 * @returns The TAC percent (0-400) or `null` for malformed hex.
 *
 * @public
 */
export function tacForHex(hex: string): number | null {
  const cmyk = hexToCmyk(hex);
  if (cmyk === null) return null;
  return tacPercent(cmyk);
}
