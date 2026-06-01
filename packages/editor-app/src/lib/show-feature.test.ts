// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_EDITOR_CONFIG,
  type EditorConfig,
  isPanelVisible,
  resolveConfig,
  showFeature,
} from "./editor-config";
import { _resetUnwiredForTests, isUnwired, markUnwired } from "./unwired";

afterEach(() => {
  _resetUnwiredForTests();
});

describe("showFeature — four-gate truth table", () => {
  const baseCfg: EditorConfig = resolveConfig("pro");

  it("returns true when all four gates are open", () => {
    expect(showFeature(baseCfg, "tool_rect")).toBe(true);
  });

  it("returns false when enable_<f> is explicitly false", () => {
    const cfg: EditorConfig = { ...baseCfg, enable_tool_rect: false };
    expect(showFeature(cfg, "tool_rect")).toBe(false);
  });

  it("returns false when plan_gates[f] is explicitly false", () => {
    const cfg: EditorConfig = { ...baseCfg, plan_gates: { tool_rect: false } };
    expect(showFeature(cfg, "tool_rect")).toBe(false);
  });

  it("returns true when plan_gates[f] is absent (defaults open)", () => {
    const cfg: EditorConfig = { ...baseCfg, plan_gates: {} };
    expect(showFeature(cfg, "tool_rect")).toBe(true);
  });

  it("returns false when capabilities[f] is explicitly false", () => {
    const cfg: EditorConfig = { ...baseCfg, capabilities: { tool_rect: false } };
    expect(showFeature(cfg, "tool_rect")).toBe(false);
  });

  it("returns false when feature is marked unwired", () => {
    markUnwired("tool_rect");
    expect(isUnwired("tool_rect")).toBe(true);
    expect(showFeature(baseCfg, "tool_rect")).toBe(false);
  });

  it("plan_gates and capabilities are independent — both must be open", () => {
    const cfg: EditorConfig = {
      ...baseCfg,
      plan_gates: { tool_rect: false },
      capabilities: { tool_rect: true },
    };
    expect(showFeature(cfg, "tool_rect")).toBe(false);
  });

  it("explicit true on plan/capability is the same as absent", () => {
    const cfg: EditorConfig = {
      ...baseCfg,
      plan_gates: { tool_rect: true },
      capabilities: { tool_rect: true },
    };
    expect(showFeature(cfg, "tool_rect")).toBe(true);
  });
});

describe("isPanelVisible", () => {
  it("returns true for an absent visibility entry", () => {
    expect(isPanelVisible(DEFAULT_EDITOR_CONFIG, "layers")).toBe(true);
  });

  it("returns false when the entry is explicitly false", () => {
    const cfg: EditorConfig = { ...DEFAULT_EDITOR_CONFIG, panelVisibility: { layers: false } };
    expect(isPanelVisible(cfg, "layers")).toBe(false);
  });

  it("forces visibility on when enable_palettes is false", () => {
    const cfg: EditorConfig = {
      ...DEFAULT_EDITOR_CONFIG,
      enable_palettes: false,
      panelVisibility: { layers: false },
    };
    // Hiding the toggle UI must not silently hide content — the
    // visibility map is opt-in, not a kill switch.
    expect(isPanelVisible(cfg, "layers")).toBe(true);
  });
});

describe("unwired registry", () => {
  it("markUnwired is idempotent", () => {
    markUnwired("tool_rect");
    markUnwired("tool_rect");
    expect(isUnwired("tool_rect")).toBe(true);
  });

  it("isUnwired is false for unknown features", () => {
    expect(isUnwired("never_marked")).toBe(false);
  });
});
