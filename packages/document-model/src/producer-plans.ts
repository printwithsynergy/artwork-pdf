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
 * `sheetWidth`/`sheetHeight` are in PDF points. `rows`×`cols` cells
 * tile the sheet; `pageMapping` controls how source pages map to
 * cells (`sequential`: page N → cell N; `repeat`: every cell shows
 * page 0).
 *
 * Wave 1 ships the minimum viable layout. A Wave 1 cross-repo
 * follow-up extends this with `gutterMm`, `marginMm`, and per-sheet
 * mark insertions when the compile-pdf impose producer adds them.
 *
 * @public
 */
export type ImposeTemplate = {
  sheetWidth: number;
  sheetHeight: number;
  rows: number;
  cols: number;
  pageMapping?: "sequential" | "repeat";
};
