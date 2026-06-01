// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Length unit → PDF points (1 pt = 1/72 in). `px` uses CSS's
// 96 DPI convention (the same one pdf-lib applies internally for
// CSS-equivalent pixel sizing); `mm` and `in` derive from the SI
// inch (25.4 mm).

import type { PageV3 } from "@artworkpdf/document-model";

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;
const CSS_PX_PER_INCH = 96;

const POINTS_PER_UNIT: Record<PageV3["unit"], number> = {
  pt: 1,
  in: PT_PER_INCH,
  mm: PT_PER_INCH / MM_PER_INCH,
  px: PT_PER_INCH / CSS_PX_PER_INCH,
};

/**
 * Convert a length in one of the document-model units (`pt`, `in`,
 * `mm`, `px`) to PDF points.
 *
 * The conversion factor is a compile-time constant per unit; this
 * is a single multiply and inlines cleanly. Use it for every length
 * crossing the document-model → PDF boundary so pages, bleed, and
 * object positions all share the same unit semantics.
 */
export function toPoints(value: number, unit: PageV3["unit"]): number {
  return value * POINTS_PER_UNIT[unit];
}
