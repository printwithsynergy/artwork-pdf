// SPDX-License-Identifier: AGPL-3.0-or-later
// Length unit → PDF points (1pt = 1/72 in). Px assumes CSS's 96 DPI convention.

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

export function toPoints(value: number, unit: PageV3["unit"]): number {
  return value * POINTS_PER_UNIT[unit];
}
