// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  type FoldGeometryConfig,
  type FoldGeometryPanelMetadata,
  buildFoldScene,
} from "./fold-geometry";

/**
 * Unit tests for the S4 fold-geometry helper (Wave 2 PR-3).
 *
 * `buildFoldScene` is the pure-math foundation the
 * `FoldPreviewOverlay` component drives. Pinning it here means PR-4
 * can refactor angle-application without breaking the scaffold's
 * scene contract.
 */

const TWO_PANEL_DIELINE: FoldGeometryPanelMetadata = {
  panels: [
    {
      id: "front",
      pathData: "M0 0 L100 0 L100 50 L0 50 Z",
      bbox: { x: 0, y: 0, width: 100, height: 50 },
      role: "front",
    },
    {
      id: "top-flap",
      pathData: "M0 -20 L100 -20 L100 0 L0 0 Z",
      bbox: { x: 0, y: -20, width: 100, height: 20 },
      role: "flap",
    },
  ],
};

const TOP_FOLD: FoldGeometryConfig = {
  edges: [
    { id: "edge-top", panelA: "front", panelB: "top-flap", angleDeg: 90, direction: "mountain" },
  ],
};

describe("buildFoldScene — panels", () => {
  it("emits one quad per panel with corners wound ccw from +Z", () => {
    const spec = buildFoldScene(TWO_PANEL_DIELINE);
    expect(spec.panels).toHaveLength(2);
    const front = spec.panels.find((p) => p.panelId === "front");
    expect(front).toBeDefined();
    // Page-coord Y flips so the 3D scene matches canvas orientation:
    // panel at y=0..50 maps to Y=0..-50.
    expect(front?.corners).toEqual([
      [0, 0, 0],
      [100, 0, 0],
      [100, -50, 0],
      [0, -50, 0],
    ]);
  });

  it("returns an empty spec when no panels are present", () => {
    const spec = buildFoldScene({ panels: [] });
    expect(spec.panels).toEqual([]);
    expect(spec.hinges).toEqual([]);
    expect(spec.bounds).toEqual({ min: [0, 0, 0], max: [0, 0, 0] });
  });

  it("computes an AABB across every panel corner", () => {
    const spec = buildFoldScene(TWO_PANEL_DIELINE);
    // Front: x 0..100, y 0..-50. Top-flap: x 0..100, y 20..0.
    expect(spec.bounds.min).toEqual([0, -50, 0]);
    expect(spec.bounds.max).toEqual([100, 20, 0]);
  });
});

describe("buildFoldScene — hinges", () => {
  it("derives the shared edge between two abutting panels", () => {
    const spec = buildFoldScene(TWO_PANEL_DIELINE, TOP_FOLD);
    expect(spec.hinges).toHaveLength(1);
    const [hinge] = spec.hinges;
    expect(hinge?.edgeId).toBe("edge-top");
    expect(hinge?.direction).toBe("mountain");
    // Top-flap's bottom edge is at y=0 in 2D → Y=0 in 3D. The seam
    // runs across the panel width.
    expect(hinge?.from).toEqual([0, 0, 0]);
    expect(hinge?.to).toEqual([100, 0, 0]);
  });

  it("defaults to mountain when the fold edge omits direction", () => {
    const spec = buildFoldScene(TWO_PANEL_DIELINE, {
      edges: [{ id: "no-dir", panelA: "front", panelB: "top-flap", angleDeg: 45 }],
    });
    expect(spec.hinges[0]?.direction).toBe("mountain");
  });

  it("skips fold edges that reference unknown panel ids", () => {
    const spec = buildFoldScene(TWO_PANEL_DIELINE, {
      edges: [{ id: "dangling", panelA: "ghost", panelB: "front", angleDeg: 90 }],
    });
    expect(spec.hinges).toEqual([]);
  });

  it("skips fold edges between non-adjacent panels", () => {
    const detached: FoldGeometryPanelMetadata = {
      panels: [
        { id: "a", pathData: "", bbox: { x: 0, y: 0, width: 10, height: 10 } },
        { id: "b", pathData: "", bbox: { x: 100, y: 100, width: 10, height: 10 } },
      ],
    };
    const spec = buildFoldScene(detached, {
      edges: [{ id: "phantom", panelA: "a", panelB: "b", angleDeg: 90 }],
    });
    expect(spec.hinges).toEqual([]);
  });
});

describe("buildFoldScene — additivity", () => {
  it("works with foldConfig absent (panels-only scene)", () => {
    const spec = buildFoldScene(TWO_PANEL_DIELINE);
    expect(spec.hinges).toEqual([]);
    expect(spec.panels).toHaveLength(2);
  });
});
