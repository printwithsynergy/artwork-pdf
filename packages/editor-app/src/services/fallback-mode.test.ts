// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type EditorConfig, resolveConfig } from "../lib/editor-config";
import { _resetUnwiredForTests } from "../lib/unwired";
import { _resetUnwiredWarnings, logUnwiredHide, resolveServiceFallbackMode } from "./fallback-mode";
import { defaultEditorServices, type SpotSearchService } from "./services";

const baseCfg: EditorConfig = resolveConfig("pro");

afterEach(() => {
  _resetUnwiredForTests();
  _resetUnwiredWarnings();
  vi.restoreAllMocks();
});

describe("resolveServiceFallbackMode — capability self-hide", () => {
  const wiredSpot: SpotSearchService = {
    search: async () => ({ results: [], total: 0, limit: 0 }),
  };

  it("returns 'wired' when the flag is open and the service is injected", () => {
    const services = defaultEditorServices({ spotSearch: wiredSpot });
    const mode = resolveServiceFallbackMode({
      config: baseCfg,
      services,
      feature: "swatches",
      service: "spotSearch",
    });
    expect(mode).toBe("wired");
  });

  it("returns 'hidden' when the service is unwired and there is no fallback", () => {
    const services = defaultEditorServices(); // nothing injected
    const mode = resolveServiceFallbackMode({
      config: baseCfg,
      services,
      feature: "swatches",
      service: "spotSearch",
    });
    expect(mode).toBe("hidden");
  });

  it("returns 'fallback' when the service is unwired but the tool degrades gracefully", () => {
    const services = defaultEditorServices();
    const mode = resolveServiceFallbackMode({
      config: baseCfg,
      services,
      feature: "process_preflight",
      service: "preflightRules",
      hasFallback: true,
    });
    expect(mode).toBe("fallback");
  });

  it("returns 'hidden' when the feature flag is closed, even if the service is wired", () => {
    const services = defaultEditorServices({ spotSearch: wiredSpot });
    const cfg: EditorConfig = { ...baseCfg, enable_swatches: false };
    const mode = resolveServiceFallbackMode({
      config: cfg,
      services,
      feature: "swatches",
      service: "spotSearch",
    });
    expect(mode).toBe("hidden");
  });

  it("respects the capabilities gate from showFeature", () => {
    const services = defaultEditorServices({ spotSearch: wiredSpot });
    const cfg: EditorConfig = { ...baseCfg, capabilities: { swatches: false } };
    const mode = resolveServiceFallbackMode({
      config: cfg,
      services,
      feature: "swatches",
      service: "spotSearch",
    });
    expect(mode).toBe("hidden");
  });

  it("applies only the service layer when no feature is given", () => {
    const wired = resolveServiceFallbackMode({
      config: baseCfg,
      services: defaultEditorServices({ spotSearch: wiredSpot }),
      service: "spotSearch",
    });
    expect(wired).toBe("wired");

    const hidden = resolveServiceFallbackMode({
      config: baseCfg,
      services: defaultEditorServices(),
      service: "spotSearch",
    });
    expect(hidden).toBe("hidden");
  });
});

describe("logUnwiredHide", () => {
  beforeEach(() => {
    _resetUnwiredWarnings();
  });

  it("does not warn for a wired tool", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logUnwiredHide("spotSearch", "wired");
    expect(spy).not.toHaveBeenCalled();
  });

  it("warns once per (service, mode) and then dedupes", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logUnwiredHide("spotSearch", "hidden");
    logUnwiredHide("spotSearch", "hidden");
    expect(spy).toHaveBeenCalledTimes(1);
    // A different mode for the same service is a distinct warning.
    logUnwiredHide("spotSearch", "fallback");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("stays silent in production builds", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      logUnwiredHide("ai", "hidden");
      expect(spy).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
