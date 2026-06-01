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
  | "swatches"
  | "inks"
  | "graphic-styles"
  | "history"
  | "fold-preview";

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
  /** C1 — inks palette. Surfaces the live ink list extracted from the
   *  most recently rendered PDF, alongside the existing swatches
   *  palette (which still handles PANTONE search). Hosts can disable
   *  to avoid the `/v1/separations/list` round-trip on every export. */
  enable_inks_panel: boolean;

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
  enable_inks_panel: true,
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
