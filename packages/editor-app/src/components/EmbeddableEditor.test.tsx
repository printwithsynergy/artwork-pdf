// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { resolveConfig, showFeature } from "../lib/editor-config";
import {
  type AiAssistService,
  defaultEditorServices,
  type SpotSearchService,
} from "../services/services";
import {
  capabilitiesForServices,
  type EmbeddableEditorProps,
  SERVICE_BACKED_FEATURES,
} from "./EmbeddableEditor";

/**
 * EmbeddableEditor renders React + the konva/three peer deps, which the
 * no-jsdom test setup can't mount as a plain function (see the note in
 * SwatchesPicker.test.tsx). The drop-in component's *contract* is the
 * capability auto-posture: which tools self-hide given an injected
 * service surface. That logic lives in the pure, exported
 * capabilitiesForServices / SERVICE_BACKED_FEATURES so it's testable
 * here without a DOM; full mount behaviour lands as e2e coverage when
 * the package adopts jsdom.
 */

describe("SERVICE_BACKED_FEATURES integrity", () => {
  it("every entry names a real service key", () => {
    const services = defaultEditorServices();
    for (const { service } of SERVICE_BACKED_FEATURES) {
      expect(service in services).toBe(true);
    }
  });

  it("every entry's feature flows through showFeature without throwing", () => {
    const cfg = resolveConfig("pro");
    for (const { feature } of SERVICE_BACKED_FEATURES) {
      expect(typeof showFeature(cfg, feature)).toBe("boolean");
    }
  });
});

describe("capabilitiesForServices — auto self-hide posture", () => {
  it("forces every backend-backed feature off when no service is injected", () => {
    const caps = capabilitiesForServices(defaultEditorServices());
    for (const { feature } of SERVICE_BACKED_FEATURES) {
      expect(caps[feature]).toBe(false);
    }
  });

  it("leaves a feature's capability open when its service is wired", () => {
    const spotSearch: SpotSearchService = {
      search: async () => ({ results: [], total: 0, limit: 0 }),
    };
    const caps = capabilitiesForServices(defaultEditorServices({ spotSearch }));
    // spotSearch-backed features are no longer forced off...
    expect(caps.swatches).toBeUndefined();
    expect(caps.smart_spot_match).toBeUndefined();
    expect(caps.palette_to_spot).toBeUndefined();
    // ...but ai-backed features stay forced off.
    expect(caps.copy_generation).toBe(false);
  });

  it("a single wired service unlocks all features it backs", () => {
    const ai: AiAssistService = { run: async () => ({}) };
    const caps = capabilitiesForServices(defaultEditorServices({ ai }));
    for (const { feature, service } of SERVICE_BACKED_FEATURES) {
      if (service === "ai") {
        expect(caps[feature]).toBeUndefined();
      } else {
        expect(caps[feature]).toBe(false);
      }
    }
  });

  it("host-supplied capabilities win over the auto-posture", () => {
    // Host knows swatches works even though it didn't use the typed seam.
    const caps = capabilitiesForServices(defaultEditorServices(), { swatches: true });
    expect(caps.swatches).toBe(true);
    // Other unwired features remain forced off.
    expect(caps.copy_generation).toBe(false);
  });

  it("composes into a config so showFeature hides the unwired tool", () => {
    const caps = capabilitiesForServices(defaultEditorServices());
    const cfg = resolveConfig("pro", { capabilities: caps });
    // Backend-backed tool self-hides...
    expect(showFeature(cfg, "swatches")).toBe(false);
    // ...while a pure in-browser tool stays visible.
    expect(showFeature(cfg, "tool_rect")).toBe(true);
  });

  it("autoHideUnwired and services props are part of the public prop shape", () => {
    // Type-level lock: the embeddable surface accepts the host-injection props.
    const props: EmbeddableEditorProps = {
      services: { spotSearch: { search: async () => ({ results: [], total: 0, limit: 0 }) } },
      autoHideUnwired: false,
    };
    expect(props.autoHideUnwired).toBe(false);
    expect(props.services?.spotSearch).toBeDefined();
  });
});
