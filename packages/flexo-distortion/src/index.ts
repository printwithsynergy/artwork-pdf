// SPDX-License-Identifier: AGPL-3.0-or-later
//
// `@artworkpdf/flexo-distortion` — pre-press geometry compensation
// for the flexographic printing process.
//
// Flexo plates physically stretch when mounted to the print
// cylinder. The amount of stretch is anisotropic (different in the
// machine direction vs. the across-web direction) and depends on
// plate thickness, mounting tape, and cylinder radius. To get
// dimensionally-correct print output, artwork is *pre-shrunk* by
// the inverse of the expected stretch factors before plate-making,
// so that the on-press stretch lands back at nominal.
//
// Public surface:
// - {@link DistortionParams} — the X/Y factors + optional repeat.
// - {@link applyFlexoDistortion} — scale an SVG path's coordinates.
// - {@link compensatedDimensions} — scale a width/height pair.

/**
 * Flexo distortion compensation parameters.
 *
 * `factorX` / `factorY` are the *measured plate-stretch* factors
 * (e.g. `1.012` means the plate prints 1.2% larger than nominal in
 * that direction). Use values from a mounting-tape vendor's chart
 * or measure with a press fingerprint job.
 *
 * `repeatLengthMm` documents the cylinder repeat length for which
 * the factors were measured; informational for downstream consumers
 * that may need to interpolate factors for a different repeat. Not
 * used by the math in this module.
 *
 * **Invariant:** `factorX` and `factorY` must be finite and non-zero
 * (positive in practice — plates physically stretch, they don't
 * shrink). Both {@link applyFlexoDistortion} and
 * {@link compensatedDimensions} divide by these values; the
 * functions do *not* validate, so passing `0` produces `Infinity`,
 * `NaN` produces `NaN`, etc. Callers are responsible for sourcing
 * sensible factors (vendor charts, fingerprint measurements).
 */
export type DistortionParams = {
  factorX: number;
  factorY: number;
  repeatLengthMm?: number;
};

/**
 * Pre-shrink an SVG path by the inverse of the flexo distortion
 * factors, so that on-press stretch brings it back to nominal size.
 *
 * Every absolute or relative SVG command is handled with its
 * direction-correct factor:
 *
 * - `M`/`L`/`T` (and lowercase) — `(x, y)` pairs scaled by
 *   `(1/factorX, 1/factorY)`.
 * - `H` / `h` — x-only, scaled by `1/factorX`.
 * - `V` / `v` — y-only, scaled by `1/factorY`.
 * - `C` / `S` / `Q` (and lowercase) — all `(x, y)` pairs, scaled
 *   alternating.
 * - `A` / `a` — 7-parameter arc segments; `rx` and the endpoint x
 *   get `1/factorX`, `ry` and the endpoint y get `1/factorY`, the
 *   rotation / large-arc / sweep flags pass through.
 * - `Z` / `z` — close-path, no parameters.
 *
 * Identity case (`factorX === factorY === 1`) returns the input
 * unchanged. Only the standard SVG path-data alphabet
 * (`M L H V C S Q T A Z` and their lowercase forms) is recognized;
 * any other letters are stripped at tokenization time, so callers
 * with non-standard extensions must normalize before calling.
 *
 * Requires finite, non-zero `params.factorX` and `params.factorY`
 * — see the {@link DistortionParams} invariant. The function does
 * not validate; bad inputs propagate as `Infinity`/`NaN` in the
 * output coordinates.
 */
export function applyFlexoDistortion(pathData: string, params: DistortionParams): string {
  if (params.factorX === 1 && params.factorY === 1) return pathData;

  const { factorX, factorY } = params;
  const tokens = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
  if (!tokens) return pathData;

  return tokens
    .map((token) => {
      const type = token[0];
      const rest = token.slice(1).trim();
      const nums =
        rest === ""
          ? []
          : rest
              .split(/[\s,]+/)
              .filter(Boolean)
              .map(Number);

      const scaleXY = (arr: number[]): number[] =>
        arr.map((n, i) => (i % 2 === 0 ? n / factorX : n / factorY));

      switch (type) {
        case "M":
        case "L":
        case "T":
        case "m":
        case "l":
        case "t":
          return `${type}${scaleXY(nums).join(",")}`;

        case "H":
        case "h":
          return `${type}${nums.map((n) => n / factorX).join(",")}`;

        case "V":
        case "v":
          return `${type}${nums.map((n) => n / factorY).join(",")}`;

        case "C":
        case "c":
          return `${type}${scaleXY(nums).join(",")}`;

        case "S":
        case "s":
        case "Q":
        case "q":
          return `${type}${scaleXY(nums).join(",")}`;

        case "A":
        case "a": {
          const out: number[] = [];
          for (let i = 0; i + 6 < nums.length; i += 7) {
            const rx = nums[i] ?? 0;
            const ry = nums[i + 1] ?? 0;
            const xRot = nums[i + 2] ?? 0;
            const largeArc = nums[i + 3] ?? 0;
            const sweep = nums[i + 4] ?? 0;
            const ex = nums[i + 5] ?? 0;
            const ey = nums[i + 6] ?? 0;
            out.push(rx / factorX, ry / factorY, xRot, largeArc, sweep, ex / factorX, ey / factorY);
          }
          return `${type}${out.join(",")}`;
        }

        case "Z":
        case "z":
          return type;

        default:
          return token;
      }
    })
    .join("");
}

/**
 * Pre-shrink a (width, height) pair by the flexo distortion factors.
 *
 * Mirrors {@link applyFlexoDistortion}'s arithmetic for the trivial
 * case of a rectangular bounding box. Use for plate sizing,
 * imposition cell dimensions, or any other geometry that flows
 * through the distortion pipeline as a pair rather than as a path.
 *
 * Requires finite, non-zero `params.factorX` and `params.factorY`
 * — see the {@link DistortionParams} invariant. No validation; bad
 * factors yield `Infinity`/`NaN` dimensions.
 */
export function compensatedDimensions(
  originalWidthMm: number,
  originalHeightMm: number,
  params: DistortionParams,
): { widthMm: number; heightMm: number } {
  return {
    widthMm: originalWidthMm / params.factorX,
    heightMm: originalHeightMm / params.factorY,
  };
}
