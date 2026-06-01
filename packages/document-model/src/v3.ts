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
import type { TrapPolicy } from "./producer-plans.js";

/**
 * One panel (cut/crease-bounded region) of a dieline, as exposed by
 * the editor's panel-aware authoring surface (Wave 2 S3).
 *
 * Panels are derived once when a dieline is loaded — the parser walks
 * the cut/crease graph and emits one `DielinePanel` per bounded
 * face. The `pathData` is an SVG `d`-string in page-local coordinates
 * suitable for hit-testing and 3D fold preview (S4); the `bbox` is a
 * pre-computed bounding box for fast object-anchoring lookups.
 *
 * `role` is a semantic label (front face, top flap, etc.) — optional,
 * inferred heuristically by the editor and overridable by the user.
 */
export type DielinePanel = {
  id: string;
  name?: string;
  pathData: string;
  bbox: { x: number; y: number; width: number; height: number };
  role?: "front" | "back" | "top" | "bottom" | "left" | "right" | "flap" | "glue" | "other";
};

/**
 * Panel registry for a page (Wave 2 S3).
 *
 * The presence of this field signals that the page's dieline has been
 * decomposed into addressable panels and {@link ArtworkObject.anchorPanelId}
 * can reference them. Absent: free-floating page coordinates only.
 */
export type PanelMetadata = {
  panels: DielinePanel[];
};

/**
 * One fold edge between two panels — drives the 3D fold preview
 * (Wave 2 S4).
 *
 * `panelA` / `panelB` reference {@link DielinePanel} ids on the same
 * page's `panelMetadata.panels`; `angleDeg` is the dihedral angle
 * between the two faces (0 = flat / unfolded, 90 = perpendicular,
 * 180 = fully folded back on itself). `direction` disambiguates
 * mountain (convex, positive z) from valley (concave) when needed by
 * a folding solver; renderers may ignore it for simple previews.
 */
export type FoldEdge = {
  id: string;
  panelA: string;
  panelB: string;
  angleDeg: number;
  direction?: "mountain" | "valley";
};

/**
 * Fold configuration for a page (Wave 2 S4).
 *
 * `edges` describes which panel pairs hinge together and at what
 * angle. `defaultAngleDeg`, when set, supplies an angle for edges
 * that don't carry one explicitly — useful for initial-state previews
 * of a flat-from-disk dieline.
 *
 * Invariant: `edges[i].panelA` and `edges[i].panelB` must be ids that
 * appear on the same page's `panelMetadata.panels`. The editor enforces
 * this on save; renderers should ignore dangling edges rather than
 * fail the render.
 */
export type FoldConfig = {
  edges: FoldEdge[];
  defaultAngleDeg?: number;
};

/**
 * One row of a {@link VariantMatrix} (Wave 2 V2).
 *
 * `overrides` maps a subset of `document.variableData` token keys to
 * variant-specific values; absent keys inherit the document's
 * variable-data defaults. `name` is the user-facing label shown in
 * the variant matrix UI.
 */
export type Variant = {
  id: string;
  name: string;
  overrides: Record<string, string>;
};

/**
 * Variant matrix for a document — the cross-product of variants ×
 * variable-data tokens that V2's matrix UI edits and V1's merge
 * pipeline (Wave 3) consumes.
 *
 * `tokenKeys` declares the columns in author-defined order;
 * `variants` carries the rows. The actual emitted page instances are
 * computed at render time: for each variant, the document's
 * `variableData` is shallow-merged with the variant's `overrides`,
 * and the result is rendered as one page-instance.
 */
export type VariantMatrix = {
  variants: Variant[];
  tokenKeys: string[];
};

/**
 * One page of a {@link DocumentV3}.
 *
 * Pages own their own dimensions, bleed, separations, and layer
 * stack — the document level only carries cross-page concerns
 * (swatches, graphic styles, variable data, print context).
 *
 * `dielineTemplateId` and `flexoDistortion` are per-page so multi-up
 * impositions can mix substrates / dies / distortion factors on the
 * same sheet. `trapConfig` is per-page so the interactive trap editor
 * (Wave 1 D2) can store per-edge / per-color-pair overrides
 * independently for each page in a multi-page document.
 *
 * `panelMetadata` and `foldConfig` are the Wave 2 additions for
 * panel-anchored authoring (S3) and 3D fold preview (S4); both are
 * additive — pages without them behave identically to Wave 1.
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
  trapConfig?: TrapPolicy;
  panelMetadata?: PanelMetadata;
  foldConfig?: FoldConfig;
};

/**
 * The v3 document — array of {@link PageV3} with cross-page concerns
 * (swatches, graphic styles, variable data, print context) lifted to
 * the document level.
 *
 * `version: "3"` is the discriminator against v2's `version: "2"`;
 * use {@link import("./migrate.js").isV3} for narrowing.
 *
 * `variants` (Wave 2 V2) is document-level because variant rows index
 * the *entire* document, not per-page — a 12-variant business card
 * emits 12 instances of every page in the document, not 12 of page 1.
 */
export type DocumentV3 = {
  version: "3";
  pages: PageV3[];
  swatches?: string[];
  graphicStyles?: GraphicStyle[];
  variableData?: Record<string, string>;
  printContext?: PrintContext;
  variants?: VariantMatrix;
};
