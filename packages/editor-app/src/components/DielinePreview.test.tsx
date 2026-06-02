// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  DielinePreviewFoldConfig,
  DielinePreviewPanelMetadata,
  DielinePreviewProps,
} from "./DielinePreview";
import { computeDielinePreviewLayout } from "./DielinePreview";

/**
 * Contract tests for DielinePreview's typed public surface (Wave 4 S6).
 *
 * DOM behaviour (SVG rendering, hover affordance) lands when the
 * editor adopts RTL. These tests pin the wire shape so hosts that
 * want to render a small "you are working on this carton" thumbnail
 * in their own chrome have a stable contract.
 */

const flatPanel: DielinePreviewPanelMetadata = {
  panels: [
    {
      id: "p1",
      bbox: { x: 0, y: 0, width: 100, height: 50 },
      role: "front",
    },
  ],
};

const cartonPanels: DielinePreviewPanelMetadata = {
  panels: [
    { id: "front", bbox: { x: 0, y: 0, width: 100, height: 50 } },
    { id: "back", bbox: { x: 100, y: 0, width: 100, height: 50 } },
    { id: "flap", bbox: { x: 0, y: 50, width: 100, height: 20 }, role: "flap" },
  ],
};

const cartonFolds: DielinePreviewFoldConfig = {
  edges: [
    { id: "e1", panelA: "front", panelB: "back", angleDeg: 90, direction: "mountain" },
    { id: "e2", panelA: "front", panelB: "flap", angleDeg: 45, direction: "valley" },
  ],
};

describe("DielinePreviewPanelMetadata type", () => {
  it("accepts a single-panel registry (flat dieline)", () => {
    expect(flatPanel.panels).toHaveLength(1);
    expect(flatPanel.panels[0]?.role).toBe("front");
  });

  it("accepts a multi-panel registry with optional roles", () => {
    expect(cartonPanels.panels).toHaveLength(3);
    expect(cartonPanels.panels[1]?.role).toBeUndefined();
    expect(cartonPanels.panels[2]?.role).toBe("flap");
  });
});

describe("DielinePreviewProps type", () => {
  it("accepts panelMetadata + optional foldConfig + optional templateId", () => {
    const props: DielinePreviewProps = {
      panelMetadata: cartonPanels,
      foldConfig: cartonFolds,
      templateId: "carton-tuck-end",
    };
    expect(props.panelMetadata?.panels).toHaveLength(3);
    expect(props.foldConfig?.edges).toHaveLength(2);
    expect(props.templateId).toBe("carton-tuck-end");
  });

  it("accepts undefined panelMetadata (empty state)", () => {
    const props: DielinePreviewProps = {
      panelMetadata: undefined,
    };
    expect(props.panelMetadata).toBeUndefined();
  });

  it("accepts optional sizePx + activePanelId for hover affordance", () => {
    const props: DielinePreviewProps = {
      panelMetadata: cartonPanels,
      sizePx: 240,
      activePanelId: "front",
    };
    expect(props.sizePx).toBe(240);
    expect(props.activePanelId).toBe("front");
  });
});

describe("computeDielinePreviewLayout", () => {
  it("returns an empty layout when no panels are present", () => {
    const layout = computeDielinePreviewLayout({ panels: [] }, undefined, 160);
    expect(layout.panels).toEqual([]);
    expect(layout.hinges).toEqual([]);
    expect(layout.scale).toBe(1);
  });

  it("scales the longest dimension to fit the requested size", () => {
    const layout = computeDielinePreviewLayout(cartonPanels, undefined, 160);
    // Widest extent is 200 (front+back, x ∈ [0,200]); height extent
    // is 70 (panels span 0..70). The longer axis is 200, so the
    // scale should map 200 → (160 - gutter), i.e. < 1.
    expect(layout.scale).toBeLessThan(1);
    expect(layout.scale).toBeGreaterThan(0);
    expect(layout.panels).toHaveLength(3);
  });

  it("projects each panel into the SVG viewport with scaled bbox", () => {
    const layout = computeDielinePreviewLayout(cartonPanels, undefined, 160);
    const front = layout.panels.find((p) => p.id === "front");
    expect(front).toBeDefined();
    expect(front?.x).toBeGreaterThanOrEqual(0);
    expect(front?.y).toBeGreaterThanOrEqual(0);
    expect(front?.width).toBeGreaterThan(0);
    expect(front?.height).toBeGreaterThan(0);
  });

  it("emits one hinge segment per edge with mountain/valley tag", () => {
    const layout = computeDielinePreviewLayout(cartonPanels, cartonFolds, 160);
    expect(layout.hinges).toHaveLength(2);
    const mountain = layout.hinges.find((h) => h.direction === "mountain");
    const valley = layout.hinges.find((h) => h.direction === "valley");
    expect(mountain).toBeDefined();
    expect(valley).toBeDefined();
  });

  it("skips hinges referencing unknown panel ids (dangling edge defence)", () => {
    const layout = computeDielinePreviewLayout(
      cartonPanels,
      { edges: [{ id: "ghost", panelA: "front", panelB: "missing", angleDeg: 0 }] },
      160,
    );
    expect(layout.hinges).toEqual([]);
  });

  it("treats absent foldConfig as zero hinges", () => {
    const layout = computeDielinePreviewLayout(cartonPanels, undefined, 160);
    expect(layout.hinges).toEqual([]);
  });

  it("collapses to a unit scale when every panel has zero size (defensive)", () => {
    const degenerate: DielinePreviewPanelMetadata = {
      panels: [{ id: "p", bbox: { x: 0, y: 0, width: 0, height: 0 } }],
    };
    const layout = computeDielinePreviewLayout(degenerate, undefined, 160);
    expect(layout.scale).toBe(1);
    expect(layout.panels).toHaveLength(1);
  });
});
