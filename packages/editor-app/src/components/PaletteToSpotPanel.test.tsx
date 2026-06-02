// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  PaletteColor,
  PaletteCoverageSummary,
  PaletteToSpotPanelProps,
  PaletteToSpotRow,
  SpotCommitFn,
} from "./PaletteToSpotPanel";
import { summarizePaletteCoverage } from "./PaletteToSpotPanel";
import type { SpotMatch, SpotMatchLoaderFn } from "./SmartSpotMatchPanel";

/**
 * Contract tests for PaletteToSpotPanel (Wave 1 AI4).
 *
 * DOM behaviour (match button click, commit dispatch) lands when the
 * editor adopts RTL. These tests pin the pure helper + types so hosts
 * wiring the adapter have a stable contract.
 */

const BRAND_BLUE: PaletteColor = {
  id: "c-1",
  hex: "#0066cc",
  name: "Brand Blue",
  usageCount: 12,
};

const ACCENT_ORANGE: PaletteColor = {
  id: "c-2",
  hex: "#fc5102",
  name: "Accent Orange",
  usageCount: 4,
};

const PMS_185: SpotMatch = {
  spot: { name: "PANTONE 185 C", library: "PANTONE+ Solid Coated" },
  deltaE: 1.8,
};

const PMS_021: SpotMatch = {
  spot: { name: "PANTONE Orange 021 C", library: "PANTONE+ Solid Coated" },
  deltaE: 3.4,
};

describe("PaletteColor type", () => {
  it("requires id + hex; name + usageCount optional", () => {
    const minimal: PaletteColor = { id: "x", hex: "#000000" };
    expect(minimal.name).toBeUndefined();
    expect(minimal.usageCount).toBeUndefined();
    expect(BRAND_BLUE.name).toBe("Brand Blue");
    expect(BRAND_BLUE.usageCount).toBe(12);
  });
});

describe("PaletteToSpotPanelProps type", () => {
  it("requires colors + matchLoader; onCommit + errorMessage optional", () => {
    const loader: SpotMatchLoaderFn = async () => [];
    const props: PaletteToSpotPanelProps = {
      colors: [BRAND_BLUE],
      matchLoader: loader,
    };
    expect(props.colors).toHaveLength(1);
    expect(props.matchLoader).toBe(loader);
    expect(props.onCommit).toBeUndefined();
    expect(props.errorMessage).toBeUndefined();
  });

  it("accepts onCommit + errorMessage", async () => {
    let committed = false;
    const onCommit: SpotCommitFn = async () => {
      committed = true;
    };
    const props: PaletteToSpotPanelProps = {
      colors: [BRAND_BLUE],
      matchLoader: async () => [PMS_185],
      onCommit,
      errorMessage: (err) => `Custom: ${String(err)}`,
    };
    expect(props.onCommit).toBe(onCommit);
    await props.onCommit?.(BRAND_BLUE, PMS_185);
    expect(committed).toBe(true);
    expect(props.errorMessage?.(new Error("nope"))).toBe("Custom: Error: nope");
  });
});

describe("PaletteToSpotRow type", () => {
  it("status discriminates lifecycle: idle | loading | matched | error", () => {
    const idle: PaletteToSpotRow = { color: BRAND_BLUE, status: "idle" };
    const loading: PaletteToSpotRow = { color: BRAND_BLUE, status: "loading" };
    const matched: PaletteToSpotRow = {
      color: BRAND_BLUE,
      status: "matched",
      bestMatch: PMS_185,
      alternates: [PMS_185],
    };
    const error: PaletteToSpotRow = {
      color: BRAND_BLUE,
      status: "error",
      errorMessage: "Network down",
    };
    expect(idle.status).toBe("idle");
    expect(loading.status).toBe("loading");
    expect(matched.bestMatch?.deltaE).toBe(1.8);
    expect(error.errorMessage).toBe("Network down");
  });
});

describe("summarizePaletteCoverage", () => {
  it("returns zero coverage for an empty list", () => {
    const summary: PaletteCoverageSummary = summarizePaletteCoverage([]);
    expect(summary).toEqual({
      totalColors: 0,
      matched: 0,
      unmatched: 0,
      averageDeltaE: null,
      worstDeltaE: null,
    });
  });

  it("counts unmatched rows when no matches landed", () => {
    const rows: PaletteToSpotRow[] = [
      { color: BRAND_BLUE, status: "idle" },
      { color: ACCENT_ORANGE, status: "loading" },
    ];
    const summary = summarizePaletteCoverage(rows);
    expect(summary.totalColors).toBe(2);
    expect(summary.matched).toBe(0);
    expect(summary.unmatched).toBe(2);
    expect(summary.averageDeltaE).toBeNull();
    expect(summary.worstDeltaE).toBeNull();
  });

  it("averages ΔE and tracks the worst across matched rows", () => {
    const rows: PaletteToSpotRow[] = [
      { color: BRAND_BLUE, status: "matched", bestMatch: PMS_185, alternates: [PMS_185] },
      { color: ACCENT_ORANGE, status: "matched", bestMatch: PMS_021, alternates: [PMS_021] },
    ];
    const summary = summarizePaletteCoverage(rows);
    expect(summary.totalColors).toBe(2);
    expect(summary.matched).toBe(2);
    expect(summary.unmatched).toBe(0);
    expect(summary.averageDeltaE).toBeCloseTo((1.8 + 3.4) / 2, 5);
    expect(summary.worstDeltaE).toBe(3.4);
  });

  it("ignores rows with status='matched' but no bestMatch (defensive)", () => {
    const rows: PaletteToSpotRow[] = [
      // Pathological — status says matched but no bestMatch threaded through
      { color: BRAND_BLUE, status: "matched" },
      { color: ACCENT_ORANGE, status: "matched", bestMatch: PMS_021, alternates: [PMS_021] },
    ];
    const summary = summarizePaletteCoverage(rows);
    expect(summary.matched).toBe(1);
    expect(summary.averageDeltaE).toBe(3.4);
  });

  it("ignores error rows in the matched count", () => {
    const rows: PaletteToSpotRow[] = [
      { color: BRAND_BLUE, status: "error", errorMessage: "Down" },
      { color: ACCENT_ORANGE, status: "matched", bestMatch: PMS_021, alternates: [PMS_021] },
    ];
    const summary = summarizePaletteCoverage(rows);
    expect(summary.totalColors).toBe(2);
    expect(summary.matched).toBe(1);
    expect(summary.unmatched).toBe(1);
  });
});
