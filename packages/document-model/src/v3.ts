// SPDX-License-Identifier: AGPL-3.0-or-later
//
// DocumentModel v3 — pages-first canonical wire shape.
//
// v2 (flat `layers` + doc-level dimensions, single-page by
// construction) is preserved in `extended.ts` for backward
// compatibility with the editor and existing persisted documents.
// `migrate.ts` lifts v2 into v3 deterministically. The render
// pipeline (apps/service → compile-pdf) accepts both via
// `ensureV3()`; new producers should target v3 directly.

import type { GraphicStyle, Layer, PrintContext, Separation } from "./extended.js";

/**
 * One page of a {@link DocumentV3}.
 *
 * Pages own their own dimensions, bleed, separations, and layer
 * stack — the document level only carries cross-page concerns
 * (swatches, graphic styles, variable data, print context).
 *
 * `dielineTemplateId` and `flexoDistortion` are per-page so multi-up
 * impositions can mix substrates / dies / distortion factors on the
 * same sheet.
 */
export type PageV3 = {
  id: string;
  name?: string;
  width: number;
  height: number;
  unit: "mm" | "in" | "px" | "pt";
  bleedMm: number;
  separations: Separation[];
  layers: Layer[];
  dielineTemplateId?: string;
  flexoDistortion?: { distortionFactorX: number; distortionFactorY: number };
};

/**
 * The v3 document — array of {@link PageV3} with cross-page concerns
 * (swatches, graphic styles, variable data, print context) lifted to
 * the document level.
 *
 * `version: "3"` is the discriminator against v2's `version: "2"`;
 * use {@link import("./migrate.js").isV3} for narrowing.
 */
export type DocumentV3 = {
  version: "3";
  pages: PageV3[];
  swatches?: string[];
  graphicStyles?: GraphicStyle[];
  variableData?: Record<string, string>;
  printContext?: PrintContext;
};
