// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Preflight types and the compiled default ruleset.
//
// Two parties share these types:
//
//   1. `apps/service` `GET /preflight-rules` returns a merged rule set
//      (defaults + tenant overrides) so editor + platform can validate
//      with the same shape.
//   2. compile-pdf accepts `PreflightReport` on the compose call so
//      server-side checks can be skipped if the client already ran
//      them (`clientSide: true` rules).

/**
 * Severity of a preflight rule. `"block"` prevents render submission;
 * `"warn"` surfaces in the UI but does not block.
 */
export type PreflightSeverity = "block" | "warn";

/**
 * One configurable preflight check.
 *
 * `clientSide: true` rules can be evaluated entirely in the editor
 * (no PDF needed); the server skips them when an evaluated
 * {@link PreflightReport} is attached to the job. `clientSide: false`
 * rules require the composed PDF and run inside compile-pdf.
 *
 * `params` is rule-specific (e.g. `{ minDpi: 300 }` for `dpi_min`); the
 * shape is determined by `checkName` and validated at evaluation time,
 * not here.
 */
export type PreflightRule = {
  checkName: string;
  enabled: boolean;
  severity: PreflightSeverity;
  clientSide: boolean;
  params: Record<string, unknown>;
};

/**
 * A single finding emitted by a preflight check.
 *
 * `page` is 1-indexed (matching the PDF page numbering convention),
 * absent for document-level findings. `detail` is rule-specific
 * structured context — e.g. `{ actualDpi, x, y }` for `dpi_min`.
 */
export type PreflightIssue = {
  checkName: string;
  severity: PreflightSeverity;
  message: string;
  page?: number;
  detail?: Record<string, unknown>;
};

/**
 * Aggregate result of evaluating every enabled rule against a document.
 *
 * `passed` is true iff `issues` is empty *or* contains only `"warn"`
 * findings; `hasBlockingIssues` is the inverse predicate for fast UI
 * gating. `skippedChecks` lists `checkName`s that could not run (e.g.
 * a `clientSide: false` check evaluated in the editor) so the
 * server-side run knows what's still owed.
 *
 * `checkedAt` is an ISO 8601 timestamp; consumers may treat it as
 * cache key input.
 */
export type PreflightReport = {
  passed: boolean;
  hasBlockingIssues: boolean;
  issues: PreflightIssue[];
  skippedChecks: string[];
  checkedAt: string;
};

/**
 * Print process category for tenant-scoped rule resolution.
 *
 * Used as the `label_class` query parameter on
 * `GET /preflight-rules` to narrow which override rows apply.
 */
export type LabelClass = "flexo" | "offset" | "digital" | "screen" | "gravure";

/**
 * Substrate category for process-aware preflight gating.
 *
 * Mirrors lint-pdf's `substrate` matcher vocabulary (see Wave 2 PR-B
 * on `printwithsynergy/lint-pdf`). The categories collapse the long
 * tail of named stocks into rule-relevant buckets:
 *
 * - `coated` — clay-coated, gloss/matte/satin; tolerates the highest
 *   TAC (typically 300%) and the finest line weights.
 * - `uncoated` — fiber-felt papers; lower TAC (typically 240%) due to
 *   dot gain.
 * - `newsprint` — high absorbency; aggressively low TAC (typically
 *   220%).
 * - `synthetic` — film / synthetic-paper substrates (BOPP, PET, etc.)
 *   where ink lay-down is closer to coated behaviour.
 *
 * Passed as a `substrate` query parameter to lint-pdf's
 * `/v1/preflight/process` endpoint (Wave 2 PR-E) and carried on the
 * job-level `PrintContext.substrate` for client-side rule filtering.
 */
export type SubstrateClass = "coated" | "uncoated" | "newsprint" | "synthetic";

/**
 * A {@link PreflightRule} extended with optional process / substrate
 * matchers — only applies when the job's `PrintContext` satisfies the
 * declared matchers, falls through (does not run) otherwise.
 *
 * Mirrors lint-pdf's `ConditionBlock.when` vocabulary (Wave 2 PR-C)
 * so the same rule set evaluated client-side and server-side produces
 * identical findings — both matchers are arrays here for parity with
 * lint-pdf's `list[LabelClass] | None` Python wire shape. Callers
 * passing a single value wrap it in a one-element array; consumers
 * never branch on scalar-vs-array.
 *
 * Empty-array contract: `[]` means "no match possible" — the rule is
 * effectively disabled. `undefined`/absent means "match all".
 */
export type ProcessAwareRule = PreflightRule & {
  /** When set, rule applies iff the job's process is in the list. */
  process?: LabelClass[];
  /** When set, rule applies iff the job's substrate is in the list. */
  substrate?: SubstrateClass[];
};

/**
 * The compiled default preflight ruleset — the floor that
 * tenant/label overrides in the `preflight_rules` table merge on top
 * of. Order is not significant; consumers match by `checkName`.
 *
 * Five `clientSide: true` rules (dpi, font embedding, bleed, spot
 * colors, image mode) run in the editor for instant feedback; the
 * remaining rules require the composed PDF and run server-side
 * inside compile-pdf.
 */
export const DEFAULT_PREFLIGHT_RULES: PreflightRule[] = [
  {
    checkName: "dpi_min",
    enabled: true,
    severity: "block",
    clientSide: true,
    params: { minDpi: 300 },
  },
  {
    checkName: "font_embedding",
    enabled: true,
    severity: "block",
    clientSide: true,
    params: {},
  },
  {
    checkName: "bleed_required",
    enabled: true,
    severity: "block",
    clientSide: true,
    params: { bleedMm: 3 },
  },
  {
    checkName: "spot_color_validation",
    enabled: true,
    severity: "warn",
    clientSide: true,
    params: { allowUnknown: false },
  },
  {
    checkName: "min_font_size_pt",
    enabled: true,
    severity: "block",
    clientSide: false,
    params: { minPt: 4 },
  },
  {
    checkName: "min_line_weight_pt",
    enabled: true,
    severity: "block",
    clientSide: false,
    params: { minPt: 0.25 },
  },
  {
    checkName: "total_ink_coverage",
    enabled: true,
    severity: "warn",
    clientSide: false,
    params: { maxPercent: 300 },
  },
  {
    checkName: "color_profile",
    enabled: true,
    severity: "warn",
    clientSide: false,
    params: { allowedProfiles: ["ISOcoated_v2_eci", "Fogra51", "GRACoL2006_Coated"] },
  },
  {
    checkName: "overprint_settings",
    enabled: true,
    severity: "warn",
    clientSide: false,
    params: { requireBlackOverprint: true },
  },
  {
    checkName: "image_mode",
    enabled: true,
    severity: "block",
    clientSide: false,
    params: { allowedModes: ["CMYK", "Spot", "DeviceN", "Gray"] },
  },
  {
    // G2v — detect barcodes in raster uploads and flag ones whose
    // check digit / structure fails their format spec. Client-side
    // because the editor already rasterizes for the live TAC overlay
    // (PR-9) and reuses the same path here.
    checkName: "barcode_validation",
    enabled: true,
    severity: "warn",
    clientSide: true,
    params: {},
  },
];
