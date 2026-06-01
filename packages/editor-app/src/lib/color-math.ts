// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Tiny color-math helpers used by the C4 live-TAC sampler.
 *
 * Intentionally simple — the editor's TAC heatmap is a sanity check,
 * not a colorimetric proof. Production color management lives
 * server-side in compile-pdf (`codex_pdf.color`'s ICC-profile-aware
 * conversion). These helpers do the cheap browser-side math so the
 * editor can flag obviously over-inked regions without round-tripping
 * to the server.
 *
 * Lab → CMYK is **not** here on purpose — that conversion is profile-
 * dependent and codex owns it. The editor's spots (`EditorSeparation`)
 * carry an optional `lab` for display, but TAC sampling uses the hex
 * source color (via {@link hexToCmyk}) for browser-side speed.
 */

/**
 * Subtractive RGB → CMYK with auto black extraction (the "K" channel
 * is the minimum of the inverted RGB values; C/M/Y rescale once K is
 * pulled).
 *
 * Each output channel is in the `[0, 1]` range — multiply by 100 for
 * a percentage. Inputs that fall outside `0..1` are clamped (defensive
 * against bad string parsing).
 *
 * @public
 */
export function rgbToCmyk(
  r: number,
  g: number,
  b: number,
): { c: number; m: number; y: number; k: number } {
  const R = Math.max(0, Math.min(1, r));
  const G = Math.max(0, Math.min(1, g));
  const B = Math.max(0, Math.min(1, b));
  const k = 1 - Math.max(R, G, B);
  if (k >= 1) {
    // Pure black — no chroma channels, all ink in K.
    return { c: 0, m: 0, y: 0, k: 1 };
  }
  const scale = 1 - k;
  return {
    c: (1 - R - k) / scale,
    m: (1 - G - k) / scale,
    y: (1 - B - k) / scale,
    k,
  };
}

/**
 * Parse a `#rrggbb` (or `rrggbb`) hex string into `[r, g, b]` floats
 * in the `[0, 1]` range. Returns `null` for malformed input — callers
 * fall back to whatever default they prefer.
 *
 * Accepts a leading `#` or not; case-insensitive. Short-form `#rgb`
 * is **not** supported — the editor canonicalizes to long form at
 * registration time (see `separations-registry.ts`'s lowercase
 * normalization).
 *
 * @public
 */
export function parseHex(hex: string): [number, number, number] | null {
  const trimmed = hex.trim();
  const body = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (body.length !== 6) return null;
  if (!/^[0-9a-fA-F]{6}$/.test(body)) return null;
  const r = Number.parseInt(body.slice(0, 2), 16) / 255;
  const g = Number.parseInt(body.slice(2, 4), 16) / 255;
  const b = Number.parseInt(body.slice(4, 6), 16) / 255;
  return [r, g, b];
}

/**
 * Convert a `#rrggbb` hex string into CMYK fractions.
 *
 * Returns `null` for malformed input (delegates parsing to
 * {@link parseHex}). Use the `.c + .m + .y + .k` sum × 100 for a
 * total-area-coverage estimate on the pixel.
 *
 * @public
 */
export function hexToCmyk(
  hex: string,
): { c: number; m: number; y: number; k: number } | null {
  const rgb = parseHex(hex);
  if (rgb === null) return null;
  return rgbToCmyk(rgb[0], rgb[1], rgb[2]);
}

/**
 * Total area coverage of a single CMYK quadruple, in percent (0-400).
 *
 * Sum of all four ink channels — the standard print-industry TAC
 * metric. The TAC limit on coated stock is usually 280-320%; on
 * newsprint, 240%. The editor's preflight default is 300%.
 *
 * @public
 */
export function tacPercent(cmyk: { c: number; m: number; y: number; k: number }): number {
  return (cmyk.c + cmyk.m + cmyk.y + cmyk.k) * 100;
}
