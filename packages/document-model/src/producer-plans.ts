// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Producer-plan wire types for the artwork-pdf → compile-pdf chain.
//
// Each artwork.* render job can optionally request marks, trap, and
// imposition producers in addition to the always-on compose. These
// types describe the request payload for each producer; they ride on
// {@link JobSubmitRequest} as optional fields. The editor populates
// them from per-document config (page-level `trapConfig`, document-
// level marks/impose templates); apps/service threads the populated
// values through to `CompilePdfClient` in the render handler.
//
// Wave 1 ships the *minimum viable* shape for each producer; Wave 1's
// cross-repo PRs extend the trap and impose types with per-edge /
// per-color-pair / gutter / margin granularity. Consumers (the
// editor, compile-pdf's Pydantic mirrors) should treat unknown fields
// as additive — the wire is forward-compatible.

/**
 * Printer marks request. Each flag toggles a marks category at each
 * corner of the trim box. `colorBars` adds a CMYK + spot ink reference
 * strip along one margin.
 *
 * @public
 */
export type MarksPlan = {
  /** Registration marks (cross-hair targets) at each corner. */
  registration?: boolean;
  /** Trim marks (short line segments outside the trim box). */
  trim?: boolean;
  /** Bleed marks (line segments along the bleed box). */
  bleed?: boolean;
  /** CMYK + spot ink reference bars along the margin. */
  colorBars?: boolean;
};

/**
 * Color-trapping request.
 *
 * `widthMm` is the trap width applied uniformly to every color-pair
 * edge in the artwork. `mode` controls how the trap is shifted across
 * the color boundary: `spread` extends the lighter color into the
 * darker; `choke` extends the darker into the lighter; `auto` lets
 * compile-pdf decide per-edge based on density.
 *
 * Wave 1 ships only the uniform width + mode. A Wave 1 cross-repo
 * follow-up adds per-edge (`edgeOverrides`) and per-color-pair
 * (`colorPairOverrides`) granularity; those fields will be added
 * additively to this type when the compile-pdf trap producer exposes
 * them.
 *
 * @public
 */
export type TrapPolicy = {
  widthMm: number;
  mode?: "auto" | "spread" | "choke";
};

/**
 * Sheet-imposition request.
 *
 * `sheetWidthPt`/`sheetHeightPt` are in PDF points (1 pt = 1/72 in).
 * The `Pt` suffix is intentional — the rest of the codebase uses
 * unit-suffixed names (`widthMm`, `bleedMm`, `factorX`); explicit
 * units here prevent point/mm confusion in the editor's Impose panel
 * (Wave 1 PR-15) and the compile-pdf Pydantic mirror (Wave 1 PR-14).
 *
 * `rows`×`cols` cells tile the sheet; `pageMapping` controls how
 * source pages map to cells (`sequential`: page N → cell N; `repeat`:
 * every cell shows page 0).
 *
 * Wave 1 ships the minimum viable layout. A Wave 1 cross-repo
 * follow-up extends this with `gutterMm`, `marginMm`, and per-sheet
 * mark insertions when the compile-pdf impose producer adds them.
 *
 * @public
 */
export type ImposeTemplate = {
  sheetWidthPt: number;
  sheetHeightPt: number;
  rows: number;
  cols: number;
  pageMapping?: "sequential" | "repeat";
  /** Uniform inter-cell spacing in millimeters (converted to points
   *  at the wire boundary). Defaults to 0 when omitted. */
  gutterMm?: number;
  /** Uniform sheet-edge margin in millimeters reserved for marks /
   *  bleed handling, projected onto compile-pdf's `marks_zone` at
   *  submission. Defaults to 0 when omitted. */
  marginMm?: number;
  /** Request four-color registration targets in the margin area.
   *  Plumbs through to compile-pdf's `ImposePlan.registration_marks`
   *  (Wave 1 PR-14). Engine rendering is a follow-up; the toggle
   *  round-trips through the policy until then. */
  registrationMarks?: boolean;
  /** Request crop marks at per-cell trim corners — plumbs through
   *  to compile-pdf's `ImposePlan.crop_marks` with the same
   *  plumb-only semantics. */
  cropMarks?: boolean;
};
