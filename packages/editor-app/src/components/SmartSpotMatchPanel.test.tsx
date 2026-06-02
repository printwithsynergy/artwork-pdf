// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  DeltaEQuality,
  SmartSpotMatchPanelProps,
  SpotMatch,
  SpotMatchLoaderFn,
  SpotMatchQuery,
} from "./SmartSpotMatchPanel";
import {
  deltaEQuality,
  formatDeltaE,
  isQueryReady,
  sortMatchesByDeltaE,
} from "./SmartSpotMatchPanel";
import type { Spot } from "./SwatchesPicker";

/**
 * Contract tests for SmartSpotMatchPanel (Wave 4 AI2).
 *
 * DOM behaviour (debounced fetch, click-to-select, loading / error
 * surfaces) lands when the editor adopts RTL. These tests pin the
 * wire shape so hosts wiring a ΔE backend (typically compile-pdf's
 * `/v1/spots/match`) have a stable contract, plus the four pure
 * helpers downstream renderers reuse.
 */

const PANTONE_185_C: Spot = {
  name: "PANTONE 185 C",
  library: "PMS",
  lab: [49.0, 71.0, 51.0],
  cmyk_bridge: [0, 91, 76, 0],
};
const PANTONE_186_C: Spot = {
  name: "PANTONE 186 C",
  library: "PMS",
  lab: [44.0, 70.0, 39.0],
  cmyk_bridge: [0, 100, 81, 4],
};
const PANTONE_RED_032_C: Spot = {
  name: "PANTONE Red 032 C",
  library: "PMS",
  lab: [52.0, 73.0, 50.0],
  cmyk_bridge: [0, 86, 74, 0],
};

describe("formatDeltaE", () => {
  it("renders two-decimal precision with the ΔE prefix", () => {
    expect(formatDeltaE(0)).toBe("ΔE 0.00");
    expect(formatDeltaE(1.234)).toBe("ΔE 1.23");
    expect(formatDeltaE(12.5)).toBe("ΔE 12.50");
  });
});

describe("deltaEQuality", () => {
  it("classifies under 1 as imperceptible", () => {
    expect(deltaEQuality(0)).toBe("imperceptible");
    expect(deltaEQuality(0.99)).toBe("imperceptible");
  });

  it("classifies 1 to under 3 as noticeable", () => {
    expect(deltaEQuality(1)).toBe("noticeable");
    expect(deltaEQuality(2.99)).toBe("noticeable");
  });

  it("classifies 3 to under 5 as fair", () => {
    expect(deltaEQuality(3)).toBe("fair");
    expect(deltaEQuality(4.99)).toBe("fair");
  });

  it("classifies 5+ as poor", () => {
    expect(deltaEQuality(5)).toBe("poor");
    expect(deltaEQuality(99)).toBe("poor");
  });

  it("enumerates four canonical bands", () => {
    const bands: DeltaEQuality[] = ["imperceptible", "noticeable", "fair", "poor"];
    expect(bands).toHaveLength(4);
  });
});

describe("sortMatchesByDeltaE", () => {
  it("returns best-first ordering", () => {
    const out = sortMatchesByDeltaE([
      { spot: PANTONE_185_C, deltaE: 3.2 },
      { spot: PANTONE_186_C, deltaE: 0.8 },
      { spot: PANTONE_RED_032_C, deltaE: 1.5 },
    ]);
    expect(out.map((m) => m.spot.name)).toEqual([
      "PANTONE 186 C",
      "PANTONE Red 032 C",
      "PANTONE 185 C",
    ]);
  });

  it("is stable on ties (preserves input order)", () => {
    const out = sortMatchesByDeltaE([
      { spot: PANTONE_185_C, deltaE: 1.0 },
      { spot: PANTONE_186_C, deltaE: 1.0 },
      { spot: PANTONE_RED_032_C, deltaE: 1.0 },
    ]);
    expect(out.map((m) => m.spot.name)).toEqual([
      "PANTONE 185 C",
      "PANTONE 186 C",
      "PANTONE Red 032 C",
    ]);
  });

  it("returns a new array (does not mutate input)", () => {
    const input: SpotMatch[] = [
      { spot: PANTONE_185_C, deltaE: 3.2 },
      { spot: PANTONE_186_C, deltaE: 0.8 },
    ];
    const snapshot = input.map((m) => m.spot.name);
    sortMatchesByDeltaE(input);
    expect(input.map((m) => m.spot.name)).toEqual(snapshot);
  });
});

describe("isQueryReady", () => {
  it("rejects an empty query", () => {
    expect(isQueryReady({})).toBe(false);
  });

  it("accepts a hex-only query", () => {
    expect(isQueryReady({ hex: "#ff5102" })).toBe(true);
  });

  it("accepts a cmyk-only query", () => {
    expect(isQueryReady({ cmyk: [0, 91, 76, 0] })).toBe(true);
  });

  it("accepts a lab-only query", () => {
    expect(isQueryReady({ lab: [49, 71, 51] })).toBe(true);
  });

  it("rejects a whitespace-only hex", () => {
    expect(isQueryReady({ hex: "   " })).toBe(false);
  });
});

describe("SpotMatchLoaderFn type", () => {
  it("is an async function from query → ranked matches", async () => {
    const loader: SpotMatchLoaderFn = async (query) => {
      expect(query.hex).toBe("#ff5102");
      return [
        { spot: PANTONE_185_C, deltaE: 0.4 },
        { spot: PANTONE_186_C, deltaE: 2.1 },
      ];
    };
    const out = await loader({ hex: "#ff5102" });
    expect(out).toHaveLength(2);
    expect(out[0]?.deltaE).toBe(0.4);
  });
});

describe("SmartSpotMatchPanelProps type", () => {
  it("requires loader; initialQuery + limit + onSelect optional", () => {
    const props: SmartSpotMatchPanelProps = {
      loader: async () => [],
    };
    expect(props.onSelect).toBeUndefined();
    expect(props.initialQuery).toBeUndefined();
    expect(props.limit).toBeUndefined();
  });

  it("accepts the full optional surface", () => {
    let lastSelected: SpotMatch | undefined;
    const initialQuery: SpotMatchQuery = { cmyk: [0, 91, 76, 0], limit: 8 };
    const props: SmartSpotMatchPanelProps = {
      loader: async () => [],
      initialQuery,
      limit: 8,
      onSelect: (m) => {
        lastSelected = m;
      },
    };
    const match: SpotMatch = { spot: PANTONE_185_C, deltaE: 0.4 };
    props.onSelect?.(match);
    expect(lastSelected?.spot.name).toBe("PANTONE 185 C");
    expect(props.initialQuery?.cmyk).toEqual([0, 91, 76, 0]);
  });
});
