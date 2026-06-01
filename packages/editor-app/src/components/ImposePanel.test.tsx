// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { ImposePanelPreset, ImposePanelProps, ImposePanelValue } from "./ImposePanel";

/**
 * Contract tests for ImposePanel's typed public surface.
 *
 * Visual / DOM behaviour (preset dropdown wiring, rows/cols
 * spinners, checkbox + radio interaction) lands when the editor
 * adopts RTL. These tests pin the wire shape so apps/service's
 * `ImposeTemplate` can stay in sync and any host driving the panel
 * directly can rely on the published API.
 */

describe("ImposePanelValue type", () => {
  it("requires the four core fields; rest are optional", () => {
    const minimal: ImposePanelValue = {
      sheetWidthPt: 612,
      sheetHeightPt: 792,
      rows: 1,
      cols: 1,
    };
    expect(minimal.gutterMm).toBeUndefined();
    expect(minimal.marginMm).toBeUndefined();
    expect(minimal.registrationMarks).toBeUndefined();
    expect(minimal.cropMarks).toBeUndefined();
    expect(minimal.pageMapping).toBeUndefined();
  });

  it("accepts the full additive shape", () => {
    const full: ImposePanelValue = {
      sheetWidthPt: 2016,
      sheetHeightPt: 2880,
      rows: 3,
      cols: 3,
      pageMapping: "repeat",
      gutterMm: 5,
      marginMm: 12,
      registrationMarks: true,
      cropMarks: true,
    };
    expect(full.pageMapping).toBe("repeat");
    expect(full.gutterMm).toBe(5);
    expect(full.registrationMarks).toBe(true);
  });
});

describe("ImposePanelPreset type", () => {
  it("captures the four fields the dropdown needs", () => {
    const preset: ImposePanelPreset = {
      id: "letter",
      label: "Letter (8.5 × 11 in)",
      widthPt: 612,
      heightPt: 792,
    };
    expect(preset.id).toBe("letter");
    expect(preset.widthPt).toBe(612);
  });
});

describe("ImposePanelProps type", () => {
  it("requires value + onChange; presets is optional", () => {
    const props: ImposePanelProps = {
      value: undefined,
      onChange: () => {},
    };
    expect(props.presets).toBeUndefined();
  });

  it("accepts a custom preset list", () => {
    const props: ImposePanelProps = {
      value: { sheetWidthPt: 1000, sheetHeightPt: 1500, rows: 2, cols: 2 },
      onChange: () => {},
      presets: [{ id: "custom", label: "Custom", widthPt: 1000, heightPt: 1500 }],
    };
    expect(props.presets).toHaveLength(1);
  });
});
