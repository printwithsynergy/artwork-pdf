// SPDX-License-Identifier: AGPL-3.0-or-later

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

  // ── Canvas overlays ──────────────────────────────────────────────
  enable_canvas_grid: boolean;
  enable_bleed_visualization: boolean;
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
  // Canvas
  enable_canvas_grid: true,
  enable_bleed_visualization: true,
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
