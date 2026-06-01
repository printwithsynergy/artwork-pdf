// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { FoldEditorEdge, FoldEditorPanelProps, FoldEditorPanelValue } from "./FoldEditorPanel";

/**
 * Contract tests for FoldEditorPanel's typed public surface.
 *
 * DOM behaviour (slider drag, direction select, show-folded toggle)
 * lands when the editor adopts RTL. These tests pin the wire shape
 * so PR-3's FoldPreviewOverlay can consume the same value model and
 * hosts have a stable type contract to wire into `document.pages[i]
 * .foldConfig`.
 */

describe("FoldEditorEdge type", () => {
  it("requires id, panelA, panelB, angleDeg", () => {
    const edge: FoldEditorEdge = {
      id: "e1",
      panelA: "front",
      panelB: "top",
      angleDeg: 90,
    };
    expect(edge.angleDeg).toBe(90);
    expect(edge.direction).toBeUndefined();
  });

  it("accepts mountain / valley direction", () => {
    const mountain: FoldEditorEdge = {
      id: "e2",
      panelA: "a",
      panelB: "b",
      angleDeg: 180,
      direction: "mountain",
    };
    const valley: FoldEditorEdge = {
      id: "e3",
      panelA: "a",
      panelB: "b",
      angleDeg: -180,
      direction: "valley",
    };
    expect(mountain.direction).toBe("mountain");
    expect(valley.direction).toBe("valley");
  });
});

describe("FoldEditorPanelValue type", () => {
  it("requires edges; defaultAngleDeg is optional", () => {
    const flat: FoldEditorPanelValue = { edges: [] };
    expect(flat.edges).toEqual([]);
    expect(flat.defaultAngleDeg).toBeUndefined();
  });

  it("accepts a defaultAngleDeg for new edges", () => {
    const folded: FoldEditorPanelValue = {
      edges: [{ id: "e1", panelA: "a", panelB: "b", angleDeg: 0 }],
      defaultAngleDeg: 90,
    };
    expect(folded.defaultAngleDeg).toBe(90);
  });
});

describe("FoldEditorPanelProps type", () => {
  it("requires value (or undefined) + onChange", () => {
    const props: FoldEditorPanelProps = {
      value: undefined,
      onChange: () => {
        /* host writes back into document.pages[i].foldConfig */
      },
    };
    expect(props.value).toBeUndefined();
  });

  it("accepts the show-folded toggle pair and angle bounds", () => {
    let latestShow: boolean | undefined;
    const props: FoldEditorPanelProps = {
      value: { edges: [] },
      onChange: () => undefined,
      showFolded: true,
      onShowFoldedChange: (next) => {
        latestShow = next;
      },
      minAngleDeg: -90,
      maxAngleDeg: 90,
    };
    props.onShowFoldedChange?.(false);
    expect(latestShow).toBe(false);
    expect(props.minAngleDeg).toBe(-90);
  });
});
