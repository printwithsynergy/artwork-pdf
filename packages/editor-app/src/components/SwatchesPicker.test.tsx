// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { Spot, SpotLibrary, SpotSearchFn, SwatchesPickerProps } from "./SwatchesPicker";

/**
 * SwatchesPicker uses React hooks (useState / useEffect for debounced
 * search), so the existing no-jsdom test setup can't invoke it as a
 * plain function. Adding jsdom + React Testing Library would expand
 * the editor-app dep surface significantly for one component's
 * tests.
 *
 * The component's wire-shape contract is locked at the type level
 * via SpotSearchFn / Spot / SpotLibrary; full DOM-level behavior
 * (debounced search, click-to-select, library filter) lands as
 * end-to-end coverage in a later wave when the jsdom infra is added.
 *
 * Here we lock the type signatures themselves so future refactors
 * surface contract changes.
 */
describe("SwatchesPicker — type-level contract", () => {
  it("Spot carries name + optional library/lab/cmyk_bridge", () => {
    const spot: Spot = {
      name: "PANTONE 185 C",
      library: "Formula Guide Coated",
      lab: [52, 75, 49],
      cmyk_bridge: [0, 92, 71, 0],
    };
    expect(spot.name).toBe("PANTONE 185 C");
    // Optional fields can be null (codex shape) or absent.
    const minimal: Spot = { name: "x" };
    expect(minimal.lab).toBeUndefined();
  });

  it("SpotSearchFn returns { results, total, limit }", async () => {
    const stub: SpotSearchFn = async (opts) => ({
      results: [],
      total: 0,
      limit: opts.limit ?? 50,
    });
    const res = await stub({ q: "185" });
    expect(res.total).toBe(0);
    expect(res.limit).toBe(50);
  });

  it("SpotLibrary carries id + count", () => {
    const lib: SpotLibrary = { id: "Formula Guide Coated", count: 2000 };
    expect(lib.count).toBe(2000);
  });

  it("SwatchesPickerProps minimum shape is { search, onSelect }", () => {
    const props: SwatchesPickerProps = {
      search: async () => ({ results: [], total: 0, limit: 50 }),
      onSelect: () => {},
    };
    expect(props.search).toBeDefined();
    expect(props.libraries).toBeUndefined();
  });
});
