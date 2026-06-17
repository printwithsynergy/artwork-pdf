// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  type AiAssistService,
  type CorrectionsService,
  defaultEditorServices,
  type EditorServices,
  isServiceUnwired,
  markServiceUnwired,
  type PreflightRulesService,
  type SpotSearchService,
} from "./services";

describe("isServiceUnwired / markServiceUnwired", () => {
  it("treats null / undefined as unwired", () => {
    expect(isServiceUnwired(null)).toBe(true);
    expect(isServiceUnwired(undefined)).toBe(true);
  });

  it("an un-marked plain object is considered wired", () => {
    const real: SpotSearchService = {
      search: async () => ({ results: [], total: 0, limit: 0 }),
    };
    expect(isServiceUnwired(real)).toBe(false);
  });

  it("a marked object is unwired", () => {
    const stub = markServiceUnwired<SpotSearchService>({
      search: async () => ({ results: [], total: 0, limit: 0 }),
    });
    expect(isServiceUnwired(stub)).toBe(true);
  });

  it("markServiceUnwired is idempotent and returns the same object", () => {
    const obj: PreflightRulesService = { getRules: async () => [] };
    const a = markServiceUnwired(obj);
    const b = markServiceUnwired(obj);
    expect(a).toBe(obj);
    expect(b).toBe(obj);
    expect(isServiceUnwired(obj)).toBe(true);
  });

  it("the marker is non-enumerable (does not leak into spreads / JSON)", () => {
    const stub = markServiceUnwired<PreflightRulesService>({ getRules: async () => [] });
    expect(Object.keys(stub)).toEqual(["getRules"]);
    expect(JSON.stringify({ ...stub })).toBe("{}");
  });
});

describe("defaultEditorServices", () => {
  it("fills every gap with an unwired stub when nothing is injected", () => {
    const s = defaultEditorServices();
    expect(isServiceUnwired(s.preflightRules)).toBe(true);
    expect(isServiceUnwired(s.spotSearch)).toBe(true);
    expect(isServiceUnwired(s.separations)).toBe(true);
    expect(isServiceUnwired(s.ai)).toBe(true);
    expect(isServiceUnwired(s.notifications)).toBe(true);
    expect(isServiceUnwired(s.telemetry)).toBe(true);
    expect(isServiceUnwired(s.corrections)).toBe(true);
  });

  it("keeps an injected corrections service wired", () => {
    const corrections: CorrectionsService = {
      correct: async ({ document }) => ({ document, contentHash: "sha256:abc" }),
    };
    const s = defaultEditorServices({ corrections });
    expect(isServiceUnwired(s.corrections)).toBe(false);
    expect(s.corrections).toBe(corrections);
  });

  it("the corrections stub echoes the document with a structured none: hash sentinel", async () => {
    const s = defaultEditorServices();
    const out = await s.corrections?.correct({ document: { version: "3" }, operations: [] });
    expect(out?.contentHash).toBe("none:");
    expect(out?.document).toEqual({ version: "3" });
  });

  it("keeps host-injected services wired and stubs the rest", () => {
    const spotSearch: SpotSearchService = {
      search: async () => ({ results: [{ name: "PANTONE 185 C" }], total: 1, limit: 1 }),
    };
    const s = defaultEditorServices({ spotSearch });
    expect(isServiceUnwired(s.spotSearch)).toBe(false);
    expect(s.spotSearch).toBe(spotSearch);
    // Everything else falls through to a stub.
    expect(isServiceUnwired(s.preflightRules)).toBe(true);
    expect(isServiceUnwired(s.ai)).toBe(true);
  });

  it("unwired stubs are callable and return empty results (never crash)", async () => {
    const s = defaultEditorServices();
    expect(await s.preflightRules?.getRules()).toEqual([]);
    expect(await s.spotSearch?.search({ q: "x", limit: 5 })).toEqual({
      results: [],
      total: 0,
      limit: 5,
    });
    expect(await s.separations?.listInks()).toEqual([]);
    // telemetry stub is a silent no-op.
    expect(() => s.telemetry?.track("evt")).not.toThrow();
    // notifications stub resolves.
    await expect(s.notifications?.notify({ channel: "x", payload: {} })).resolves.toBeUndefined();
  });

  it("the AI stub throws so a tool can distinguish 'not wired' from 'empty'", async () => {
    const s = defaultEditorServices();
    await expect((s.ai as AiAssistService).run({ kind: "copy", request: {} })).rejects.toThrow();
  });

  it("a host can mark its own service unwired to simulate the unwired state", () => {
    const lazy = markServiceUnwired<SpotSearchService>({
      search: async () => ({ results: [], total: 0, limit: 0 }),
    });
    const s: EditorServices = defaultEditorServices({ spotSearch: lazy });
    expect(isServiceUnwired(s.spotSearch)).toBe(true);
  });
});
