// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Bleed value helpers. The editor accepts a single `bleedMm` number
 * everywhere internally; this module owns the parsing of user-facing
 * strings (URL query params, UI inputs) and the formatting of
 * human-readable labels.
 *
 * @public
 */

const MM_PER_INCH = 25.4;

/**
 * Industry-standard digital-print bleed: 0.125 in ≈ 3.175 mm. Used as
 * the fallback when neither a URL param, prop, nor template value is
 * supplied.
 *
 * @public
 */
export const DEFAULT_BLEED_MM = 3.175;

/**
 * Parse a user-supplied bleed string into mm.
 *
 * Accepts `"0.125in"`, `"3mm"`, or a bare number (assumed mm). Returns
 * `undefined` for missing or unparseable input so the caller can fall
 * back to its own default.
 *
 * @public
 */
export function parseBleed(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*(in|mm)?$/i);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1] ?? "");
  if (!Number.isFinite(value) || value < 0) return undefined;
  const unit = (match[2] ?? "mm").toLowerCase();
  return unit === "in" ? value * MM_PER_INCH : value;
}

/**
 * Format a bleed value (in mm) as a human-readable string in the given
 * unit. Used for the on-canvas "BLEED 0.125 in" label and the drawer
 * input placeholder.
 *
 * @public
 */
export function formatBleed(mm: number, unit: "in" | "mm" = "in"): string {
  if (unit === "in") {
    const inches = mm / MM_PER_INCH;
    return `${trimNum(inches)} in`;
  }
  return `${trimNum(mm)} mm`;
}

function trimNum(n: number): string {
  return Number.parseFloat(n.toFixed(4)).toString();
}
