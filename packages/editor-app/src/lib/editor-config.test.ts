// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { DEFAULT_EDITOR_CONFIG, resolveConfig } from "./editor-config";

describe("editor-config", () => {
  it("basic mode hides pro panels and the source link", () => {
    const cfg = resolveConfig("basic");
    expect(cfg.enable_layers_panel).toBe(false);
    expect(cfg.enable_separations_panel).toBe(false);
    expect(cfg.enable_source_link).toBe(false);
    // Non-pro features remain enabled
    expect(cfg.enable_tool_rect).toBe(true);
    expect(cfg.enable_dieline_chooser).toBe(true);
  });

  it("pro mode enables everything (DEFAULT_EDITOR_CONFIG)", () => {
    const cfg = resolveConfig("pro");
    expect(cfg).toEqual(DEFAULT_EDITOR_CONFIG);
  });

  it("per-instance overrides beat mode presets", () => {
    const cfg = resolveConfig("pro", { enable_export_button: false });
    expect(cfg.enable_export_button).toBe(false);
    expect(cfg.enable_layers_panel).toBe(true);

    const cfg2 = resolveConfig("basic", { enable_layers_panel: true });
    expect(cfg2.enable_layers_panel).toBe(true);
    expect(cfg2.enable_separations_panel).toBe(false);
  });
});
