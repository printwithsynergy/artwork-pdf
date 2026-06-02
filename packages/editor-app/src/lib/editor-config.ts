// SPDX-License-Identifier: AGPL-3.0-or-later

import { isUnwired } from "./unwired";

/**
 * The palettes the editor can host. Each id maps to a registered
 * panel via {@link import("./palette-registry").PALETTE_REGISTRY}.
 * Visibility is controlled by `EditorConfig.panelVisibility` (an
 * absent / `true` entry means "show"); the `PaletteManager`
 * component renders an overflow toggle on desktop, and
 * `MobileToolDrawer` renders the same toggles in a "Panels" section.
 *
 * `layers` and `preflight` are wired today. The remaining ids are
 * registered for forward compatibility — Wave 1+ components will
 * mount them.
 *
 * @public
 */
export type PaletteId =
  | "layers"
  | "preflight"
  | "dieline-library"
  | "dieline-parameters"
  | "dieline-preview"
  | "swatches"
  | "inks"
  | "graphic-styles"
  | "history"
  | "fold-preview"
  | "variant-matrix"
  | "process-rules"
  | "preflight-diff"
  | "brand-assets"
  | "mark-library"
  | "slack-notify"
  | "preflight-autofix"
  | "smart-spot-match"
  | "design-suggestions"
  | "annotations-sidebar"
  | "brand-consistency"
  | "webhook-notify"
  | "email-notify"
  | "accessibility-hints"
  | "palette-to-spot";

/**
 * Helper type — only the boolean `enable_*` keys of {@link EditorConfig}
 * (the optional gating-layer keys are filtered out).
 */
type EnableKey = Extract<keyof EditorConfig, `enable_${string}`>;

/**
 * Derived feature-key alphabet — every `enable_<feature>` flag becomes
 * a `<feature>` key. Used as the *intended* shape for
 * {@link EditorConfig}'s `capabilities` / `plan_gates` keys and as the
 * parameter type for {@link showFeature}'s lookup.
 *
 * The maps below are typed `Record<string, boolean>` to break the
 * circular type dependency (the keys-of-EditorConfig derivation
 * referencing EditorConfig itself); hosts should still pass
 * `FeatureKey`-shaped strings for compile-time-via-the-helper safety.
 *
 * @public
 */
export type FeatureKey = EnableKey extends `enable_${infer F}` ? F : never;

/**
 * Programmer-facing feature-flag layer for the editor. Modeled on
 * `lens-pdf`'s `ViewerConfig`: every host-visible feature is a typed
 * boolean, defaults are explicit, and overrides resolve in a fixed
 * precedence so behaviour is predictable.
 *
 * Resolution order (later wins):
 *   1. {@link DEFAULT_EDITOR_CONFIG}
 *   2. {@link BASIC_MODE_OVERRIDES} or {@link PRO_MODE_OVERRIDES} (per
 *      the `mode` argument)
 *   3. Per-instance overrides passed by the host
 *
 * The `panelVisibility`, `capabilities`, and `plan_gates` layers are
 * optional — absent entries preserve identity behaviour, so existing
 * consumers don't have to set them.
 *
 * @public
 */
export interface EditorConfig {
  // ── Chrome ───────────────────────────────────────────────────────
  enable_brand_logo: boolean;
  enable_export_button: boolean;
  enable_source_link: boolean;
  enable_mode_toggle: boolean;
  enable_new_file_button: boolean;
  enable_demo_badge: boolean;

  // ── Toolbar tools ────────────────────────────────────────────────
  enable_tool_select: boolean;
  enable_tool_rect: boolean;
  enable_tool_ellipse: boolean;
  enable_tool_text: boolean;
  enable_tool_image: boolean;
  enable_undo_redo: boolean;
  enable_fit_button: boolean;
  enable_zoom_indicator: boolean;
  enable_fill_picker: boolean;
  enable_stroke_picker: boolean;
  enable_dieline_chooser: boolean;
  enable_bleed_input: boolean;

  // ── Panels (pro-tier by default) ─────────────────────────────────
  enable_layers_panel: boolean;
  enable_preflight_banner: boolean;
  /** F0 — host-toggleable palette overflow menu (desktop) + mobile
   *  drawer "Panels" section. When false, all palettes render
   *  regardless of their per-id `panelVisibility` entry. */
  enable_palettes: boolean;
  /** F1 plumb — separation-aware UI surface. UI ships in Wave 1+;
   *  flag prepares the surface so hosts can opt out preemptively. */
  enable_separations: boolean;
  /** S1 — parametric dieline parameter panel. When enabled, hosts can
   *  surface a width/height/depth/bleed editor on top of a parametric
   *  dieline template (CF2 or codex-pdf carton macro); the panel
   *  emits new parameters via `onChange` and the host wires the
   *  regen step. Disable for hosts that only ship the bundled
   *  static library. */
  enable_dieline_parameters: boolean;
  /** S6 — lightweight 2D dieline preview panel. When enabled, hosts
   *  can mount the {@link DielinePreview} thumbnail next to the
   *  parametric editor so a width/height edit and the resulting
   *  folded-layout preview update side by side. Distinct from
   *  `enable_3d_fold_preview` (which spins up Three.js); this is the
   *  cheap always-on chrome companion. */
  enable_dieline_preview: boolean;
  /** C1 — inks palette. Surfaces the live ink list extracted from the
   *  most recently rendered PDF, alongside the existing swatches
   *  palette (which still handles PANTONE search). Hosts can disable
   *  to avoid the `/v1/separations/list` round-trip on every export. */
  enable_inks_panel: boolean;
  /** S3 — panel-anchored objects. When enabled, hosts can bind
   *  artwork objects to a specific {@link DielinePanel} via
   *  `anchorPanelId`; objects re-position with their parent panel
   *  when the dieline is folded or regenerated. The flag controls
   *  whether the editor surfaces the "Anchor to panel" affordance —
   *  the wire model already carries `anchorPanelId` regardless. */
  enable_panel_anchored_objects: boolean;
  /** P3 — compliance findings panel. Surfaces substrate / market /
   *  regulation findings from lint-pdf's `P3_compliance_v1` profile
   *  separately from the existing generic preflight panel. Hosts
   *  that don't run lint-pdf opt out via this flag. */
  enable_compliance_panel: boolean;
  /** P2 — process-specific preflight panel. Surfaces process-physics
   *  findings (flexo white-knock, gravure max line freq, screen
   *  halftone limit) separately from generic preflight and from the
   *  P3 compliance panel. Hosts that don't run lint-pdf's
   *  process-aware profile opt out via this flag. */
  enable_process_rules_panel: boolean;
  /** P4 — preflight-diff panel. Compares current preflight findings
   *  against a previous {@link import("@artworkpdf/document-model").PreflightSnapshot}
   *  from `DocumentV3.preflightHistory` and surfaces what changed
   *  (cleared / still firing / new since baseline). Hosts that don't
   *  carry preflight history opt out via this flag. */
  enable_preflight_diff: boolean;
  /** B1 — brand-assets registry panel. Surfaces
   *  `DocumentV3.brandAssets` as a browsable list grouped by kind
   *  (logo, swatch, typography, graphic-style, other). Pairs with
   *  the Wave 4 B2 brand-consistency rule (lint-pdf side) — the rule
   *  consults the same registry. Hosts that don't carry brand assets
   *  opt out via this flag. */
  enable_brand_assets_panel: boolean;
  /** X2 — history scrubber panel. When enabled, hosts mount the
   *  {@link HistoryPanel} on the right rail; the panel renders the
   *  per-page snapshot stack from {@link EditorCanvas} as a clickable
   *  list so users can revert to any prior commit. The panel + palette
   *  id were registered in earlier waves; this flag formally gates the
   *  surface. */
  enable_history: boolean;
  /** S2 — dieline import (CF2 / DDES / ARD file-drop). When enabled,
   *  {@link FileDropZone} accepts the three legacy packaging-industry
   *  formats and routes them through `@artworkpdf/dieline-parser` →
   *  {@link dielineToPage}, bypassing the PDF preflight phase and
   *  seeding the canvas directly. Disable for hosts that only ship
   *  PDF artwork (the dropzone falls back to PDF-only). */
  enable_dieline_import: boolean;
  /** X3 — annotation overlay. When enabled, hosts mount the
   *  {@link AnnotationOverlay} SVG layer over the canvas to surface
   *  `PageV3.annotations` (point / area / text). The overlay is
   *  read-only; mutation (add / resolve / delete) is a host concern.
   *  Disable for view-only / print-preview surfaces where comments
   *  shouldn't appear. */
  enable_annotation_overlay: boolean;
  /** V3 — versioned variant matrix diff viewer. When enabled, hosts
   *  can mount the {@link VariantMatrixVersionPanel} to compare two
   *  matrix snapshots from their persisted version history. Pairs
   *  with the optional `version` field on `VariantMatrix` (Wave 4
   *  PR-A). Disable for hosts that don't ship versioned variants. */
  enable_variant_matrix_versions: boolean;
  /** M1 — mark library picker panel. When enabled, hosts mount the
   *  {@link MarkLibraryPanel} to browse a host-provided catalogue of
   *  printer marks (crop, registration, color bar, slug, other) and
   *  wire the selected entry into the active page's marks template.
   *  Pairs with compile-pdf's marks producer; disable when no
   *  catalogue source is wired. */
  enable_mark_library: boolean;
  /** I3 — Slack-notify panel. When enabled, hosts mount the
   *  {@link SlackNotifyPanel} so users can emit a Slack notification
   *  keyed to a typed editor event (preflight cleared, job submitted,
   *  approval requested, …). Pairs with the synergy `slack.notify`
   *  workflow node when one is deployed; disable when no Slack
   *  bridge is wired. */
  enable_slack_notify: boolean;
  /** AI3 — Preflight auto-fix suggestions panel. When enabled, hosts
   *  mount the {@link PreflightAutoFixPanel} alongside the preflight
   *  panel; an AI / rules-engine loader resolves each finding to a
   *  list of remediation suggestions the user can apply. Pairs with
   *  the synergy `preflight.fix` workflow node when one is deployed;
   *  disable when no fix-suggestion adapter is wired. */
  enable_preflight_autofix: boolean;
  /** AI2 — Smart spot-match panel. When enabled, hosts mount the
   *  {@link SmartSpotMatchPanel} so users can resolve a picked CMYK
   *  / Lab / hex color to ranked nearest-PANTONE candidates with ΔE
   *  chips. Pairs with compile-pdf's `/v1/spots/match` endpoint or a
   *  tenant-local ΔE engine; disable when no matcher is wired. */
  enable_smart_spot_match: boolean;
  /** AI1 — AI design-suggestions panel. When enabled, hosts mount
   *  the {@link DesignSuggestionsPanel} alongside the canvas; a host
   *  loader resolves a stream of proactive design hints (typography,
   *  color, contrast, layout, imagery) the user can apply or
   *  dismiss. Pairs with the synergy `design.suggest` node when one
   *  is deployed; disable when no suggestion adapter is wired. */
  enable_design_suggestions: boolean;
  /** X1 — Annotations sidebar. Companion list view to the X3
   *  {@link AnnotationOverlay}; surfaces the same annotation stream
   *  as a scrollable, filterable list so reviewers can read the
   *  thread without hunting for pins. Disable when the host doesn't
   *  ship annotations (view-only surfaces, print-preview, …). */
  enable_annotations_sidebar: boolean;
  /** B2 — Brand-consistency findings panel. Companion to the B1
   *  brand-assets panel; surfaces a host-loader-supplied list of
   *  violations against the brand-asset registry (logo placed too
   *  small, fill color outside the swatches set, typography pairing
   *  off the brand kit, etc.). Pairs with lint-pdf's brand-consistency
   *  profile when one is deployed; disable when no brand-consistency
   *  loader is wired. */
  enable_brand_consistency: boolean;
  /** I1 — Generic webhook-notify panel. Companion to the I3
   *  {@link SlackNotifyPanel}; emits a structured
   *  {@link WebhookNotificationEvent} through a host adapter so any
   *  outbound HTTP integration (Zapier, n8n, GitHub Actions
   *  `repository_dispatch`, internal worker queues, custom tenant
   *  endpoints) can subscribe to editor events without their own
   *  panel. Pairs with the synergy `webhook.notify` workflow node when
   *  one is deployed; disable when no webhook adapter is wired. */
  enable_webhook_notify: boolean;
  /** I2 — Email-notify panel. Third member of the Wave 4 integration
   *  family (alongside I3 Slack and I1 webhook); emits a composed
   *  subject + body through a host-supplied {@link EmailNotifyFn}
   *  (SMTP relay, SendGrid, Postmark, AWS SES, internal Synergy node,
   *  etc.). Pairs with the synergy `email.notify` workflow node when
   *  one is deployed; disable when no email transport is wired. */
  enable_email_notify: boolean;
  /** AI4 — Palette → spot conversion panel. Closes the Wave 1 AI
   *  family. AI2 {@link SmartSpotMatchPanel} matches a user-picked
   *  color to PANTONE; AI4 takes the inverse direction — given the
   *  document's existing palette (every distinct fill/stroke on the
   *  active page), route each entry through the same matcher and let
   *  the user commit the best match into the spot registry in one
   *  click. Reuses AI2's {@link SpotMatchLoaderFn} so one host
   *  adapter serves both panels. Disable when no matcher is wired. */
  enable_palette_to_spot: boolean;
  /** AI5 — Accessibility hints panel. Fifth member of the AI family
   *  (alongside AI1 design-suggestions, AI2 smart spot-match, AI3
   *  preflight auto-fix, AI4 palette-to-spot); surfaces a host-loader
   *  -supplied list of accessibility findings (low contrast, missing
   *  alt text, text-size
   *  minimums, color-only signalling). Pairs with a tenant-deployed
   *  lint-pdf accessibility profile or an in-house rules engine;
   *  disable when no accessibility loader is wired. */
  enable_accessibility_hints: boolean;

  // ── Job setup (F2) ───────────────────────────────────────────────
  /** F2 — Print-context modal (process, substrate, ICC, TAC, target
   *  markets). When false, hosts get a `printContext`-less wire model. */
  enable_print_context: boolean;

  // ── Canvas overlays ──────────────────────────────────────────────
  enable_canvas_grid: boolean;
  enable_bleed_visualization: boolean;
  /** C4 — debounced rasterize-and-sample on every commit, surfaces a
   *  red heatmap over pixels above the TAC threshold plus a chip with
   *  `max / avg`. Hosts can disable on low-end devices where the
   *  ~250 ms rasterize is too costly. */
  enable_total_ink_coverage_live: boolean;
  /** D1 — background trap-preview overlay. When enabled, the editor
   *  posts trap policies to compile-pdf's `/v1/trap/preview` endpoint
   *  and renders the predicted trap regions on top of the canvas.
   *  Hosts can disable to avoid network chatter on every edit. */
  enable_trap_preview: boolean;
  /** D2 — interactive trap policy editor (modal panel). When
   *  enabled, the editor surfaces width / mode controls that write
   *  into the active page's `trapConfig`. Per-edge and per-color-pair
   *  overrides will follow when the compile-pdf trap producer
   *  exposes them. */
  enable_trap_editor: boolean;
  /** O1 — sheet-imposition builder (modal panel). When enabled, the
   *  editor surfaces sheet size, rows × cols, gutter / margin in mm,
   *  and registration / crop-mark toggles that flow into the
   *  compile-pdf impose producer at submission. */
  enable_impose: boolean;
  /** S4 — 3D fold preview overlay. When enabled and the active page
   *  carries `panelMetadata`, the editor mounts a Three.js scene
   *  showing the dieline's panels in 3D with hinge lines along each
   *  fold edge. Hosts on bandwidth-constrained networks can opt out;
   *  the Three.js code path stays cold when the flag is `false`. */
  enable_3d_fold_preview: boolean;
  /** S4 (PR-4) — interactive fold editor panel. When enabled,
   *  hosts surface an angle slider per fold edge that writes into
   *  `document.pages[i].foldConfig`. The {@link FoldPreviewOverlay}
   *  re-renders the 3D scene on every commit. Pairs with
   *  `enable_3d_fold_preview` — hosts that only want the read-only
   *  overlay (no editing) leave this `false`. */
  enable_fold_editor: boolean;
  /** O2 — "Send to MIS" emit. When enabled, hosts surface a button
   *  that gathers the document's print-relevant metadata into a
   *  manifest and POSTs it to the synergy `mis.estimate` workflow
   *  node. Hosts that don't run a MIS bridge opt out via this flag. */
  enable_mis_estimate: boolean;
  /** P1 — process-aware preflight. Gating is at the *call site* —
   *  hosts check this flag before mounting the substrate-class
   *  dropdown and before forwarding the helper output to lint-pdf's
   *  `/v1/preflight/process`. `preflightContextOf` itself is
   *  unconditional (a pure projection), so the flag controls the UI
   *  surface and the host's outbound wiring, not the helper. */
  enable_process_preflight: boolean;
  /** C5 — ICC soft-proof overlay. When enabled, hosts can mount the
   *  {@link IccSoftProofOverlay} on top of the canvas; the overlay's
   *  loader adapter resolves to a per-pixel delta-E map (typically
   *  via compile-pdf's `/v1/soft-proof/apply`). Disable to skip the
   *  rasterize + round-trip cost on devices where the overlay would
   *  be too expensive. */
  enable_soft_proof: boolean;
  /** V2 — variant matrix UI for variable-data overrides. When
   *  enabled, the editor surfaces a rows-times-columns table of
   *  variants and token keys that writes into `document.variants`.
   *  The actual merge pipeline (one rendered page-instance per
   *  variant) lands in Wave 3 V1; this flag just gates the editing
   *  surface. */
  enable_variant_matrix: boolean;
  /** G2g — barcode generator panel. When enabled, hosts can mount the
   *  {@link BarcodeGeneratorPanel} on the canvas chrome; the panel's
   *  renderer adapter resolves a format + payload to an ImageData
   *  bitmap the host then places as a `CanvasObj`. Disable when the
   *  host doesn't ship a barcode-rendering backend (no library wired,
   *  no compile-pdf endpoint reachable) — surfacing the panel without
   *  a working adapter would only frustrate users. */
  enable_barcode_generate: boolean;
  /** G2v — barcode validation preflight rule. When enabled, the
   *  client-side `barcode_validation` preflight rule rasterizes the
   *  active page, runs {@link scanBarcodes} over the resulting
   *  ImageData, then validates each detection via
   *  {@link validateBarcode} (EAN-13 check digit, UPC-A length,
   *  GS1-128 AI sequence). Detected codes that fail their format's
   *  validator surface as warn-severity findings. Disable when the
   *  host doesn't ship barcode-bearing artwork (skips the
   *  rasterize+scan round-trip on every preflight pass). */
  enable_barcode_validation: boolean;
  /** P5 — Braille layout panel (EN 15823 / Marburg Medium). When
   *  enabled, hosts can mount the {@link BraillePanel} to compose
   *  Grade 1 English Braille cells. Disable for hosts that don't
   *  ship pharma-grade packaging or already wire a tenant-owned
   *  Braille translator. */
  enable_braille_panel: boolean;
  /** V1 — variable-data merge helpers. When enabled, hosts can wire
   *  `{{token}}` placeholders into Wave 2 V2's variant matrix and use
   *  {@link mergeRow} / {@link mergeAllRows} to preview each rendered
   *  variant before submitting to compose. Disable for hosts that
   *  don't ship variable-data printing. */
  enable_variable_data_merge: boolean;
  /** G3 — GS1 Digital Link composer panel. When enabled, hosts can
   *  mount the {@link Gs1DigitalLinkPanel} to assemble a GTIN + AIs
   *  into a canonical GS1 Digital Link URL (optionally rendered as a
   *  QR via the same renderer adapter the G2g panel uses). Disable
   *  when the host's workflow doesn't ship GS1-encoded artwork. */
  enable_gs1_digital_link: boolean;
  /** G1 — FDA Nutrition Facts label data-entry panel. When enabled,
   *  hosts can mount the {@link NutritionPanel} to compose a typed
   *  {@link NutritionFacts} record into an ordered
   *  {@link NutritionPanelSpec} the host renders onto the canvas.
   *  Disable for hosts that don't deal with food / supplement
   *  labelling. */
  enable_nutrition_panel: boolean;

  // ── Optional gating layers (host or backend supplied) ────────────
  /**
   * Per-palette visibility. Absent or `true` means visible; `false`
   * hides without removing the toggle from the {@link PaletteId}
   * registry. Hosts that want sticky visibility persist this object
   * keyed by user + document.
   */
  panelVisibility?: Partial<Record<PaletteId, boolean>>;

  /**
   * Runtime capability declarations from the backend (e.g. "this
   * tenant's compile-pdf instance has /v1/impose/apply enabled").
   * Absent entry defaults to `true`. `false` hides the feature.
   * Separate from `plan_gates` so the UI can distinguish "capability
   * absent" from "plan doesn't include this".
   *
   * Keys are {@link FeatureKey}-shaped (typed `string` to break a
   * circular dep — hosts should pass `FeatureKey` values).
   */
  capabilities?: Record<string, boolean>;

  /**
   * Plan-tier gating (e.g. "spot library is paid"). Same shape as
   * `capabilities` but conceptually orthogonal — a feature can be
   * capable + plan-gated, in which case both must be true.
   */
  plan_gates?: Record<string, boolean>;
}

/**
 * Default flag set — every feature on. Hosts that want a minimal
 * embed (e.g. an inline `<EditorApp>` on a landing page) layer their
 * own overrides on top.
 *
 * @public
 */
export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  // Chrome
  enable_brand_logo: true,
  enable_export_button: true,
  enable_source_link: true,
  enable_mode_toggle: true,
  enable_new_file_button: true,
  enable_demo_badge: true,
  // Toolbar
  enable_tool_select: true,
  enable_tool_rect: true,
  enable_tool_ellipse: true,
  enable_tool_text: true,
  enable_tool_image: true,
  enable_undo_redo: true,
  enable_fit_button: true,
  enable_zoom_indicator: true,
  enable_fill_picker: true,
  enable_stroke_picker: true,
  enable_dieline_chooser: true,
  enable_bleed_input: true,
  // Panels
  enable_layers_panel: true,
  enable_preflight_banner: true,
  enable_palettes: true,
  enable_separations: true,
  enable_dieline_parameters: true,
  enable_dieline_preview: true,
  enable_inks_panel: true,
  enable_panel_anchored_objects: true,
  enable_compliance_panel: true,
  enable_process_rules_panel: true,
  enable_preflight_diff: true,
  enable_brand_assets_panel: true,
  enable_history: true,
  enable_dieline_import: true,
  enable_annotation_overlay: true,
  enable_variant_matrix_versions: true,
  enable_mark_library: true,
  enable_slack_notify: true,
  enable_preflight_autofix: true,
  enable_smart_spot_match: true,
  enable_design_suggestions: true,
  enable_annotations_sidebar: true,
  enable_brand_consistency: true,
  enable_webhook_notify: true,
  enable_email_notify: true,
  enable_accessibility_hints: true,
  enable_palette_to_spot: true,
  // Job setup
  enable_print_context: true,
  // Canvas
  enable_canvas_grid: true,
  enable_bleed_visualization: true,
  enable_total_ink_coverage_live: true,
  enable_trap_preview: true,
  enable_trap_editor: true,
  enable_impose: true,
  enable_3d_fold_preview: true,
  enable_fold_editor: true,
  enable_mis_estimate: true,
  enable_process_preflight: true,
  enable_soft_proof: true,
  enable_variant_matrix: true,
  enable_barcode_generate: true,
  enable_barcode_validation: true,
  enable_gs1_digital_link: true,
  enable_nutrition_panel: true,
  enable_braille_panel: true,
  enable_variable_data_merge: true,
};

/**
 * Basic-mode preset: hides the heavyweight pro panels and the source
 * link. Matches the historical "basic" mode behaviour from before the
 * flag system existed.
 *
 * @public
 */
export const BASIC_MODE_OVERRIDES: Partial<EditorConfig> = {
  enable_layers_panel: false,
  enable_source_link: false,
};

/**
 * Pro-mode preset: identity. Defaults are already pro-friendly.
 *
 * @public
 */
export const PRO_MODE_OVERRIDES: Partial<EditorConfig> = {};

/**
 * Merge defaults, the mode preset, and per-instance overrides into a
 * concrete `EditorConfig`. Per-instance always wins.
 *
 * @public
 */
export function resolveConfig(
  mode: "basic" | "pro",
  instanceOverrides?: Partial<EditorConfig>,
): EditorConfig {
  const modeOverrides = mode === "basic" ? BASIC_MODE_OVERRIDES : PRO_MODE_OVERRIDES;
  return { ...DEFAULT_EDITOR_CONFIG, ...modeOverrides, ...instanceOverrides };
}

/**
 * Resolve whether a feature should be visible right now.
 *
 * Evaluates four gates and returns true iff *all* are open:
 *   1. `enable_<f>` is not explicitly `false`.
 *   2. `plan_gates[f]` is not explicitly `false` (absent = open).
 *   3. `capabilities[f]` is not explicitly `false` (absent = open).
 *   4. `f` hasn't been marked unwired via
 *      {@link import("./unwired").markUnwired}.
 *
 * Use this at every render site that gates a feature; the four-layer
 * separation lets hosts distinguish "we hid it" from "the plan
 * doesn't include it" from "the backend can't do it right now" from
 * "the editor build doesn't ship this UI yet" without losing the
 * underlying boolean flag.
 *
 * @public
 */
export function showFeature(cfg: EditorConfig, f: FeatureKey): boolean {
  const enabled = cfg[`enable_${f}` as keyof EditorConfig] !== false;
  const plan = cfg.plan_gates?.[f] !== false;
  const capable = cfg.capabilities?.[f] !== false;
  const wired = !isUnwired(f);
  return enabled && plan && capable && wired;
}

/**
 * Resolve whether a palette should render.
 *
 * Two gates:
 *   1. `enable_palettes` is not explicitly `false`. When the
 *      palettes feature is off, *all* palettes are forced visible —
 *      the visibility map is a UI toggle, not a kill switch, so
 *      hiding the toggle UI must not silently hide content.
 *   2. `panelVisibility[id]` is not explicitly `false` (absent or
 *      `true` means visible).
 *
 * @public
 */
export function isPanelVisible(cfg: EditorConfig, id: PaletteId): boolean {
  if (cfg.enable_palettes === false) return true;
  return cfg.panelVisibility?.[id] !== false;
}
