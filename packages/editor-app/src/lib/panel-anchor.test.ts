// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  type EditorDielinePanel,
  findPanelAt,
  getPanelById,
  isPointInPanel,
  resolveAnchorPanel,
} from "./panel-anchor";

const front: EditorDielinePanel = {
  id: "front",
  name: "Front",
  pathData: "M 0 0 L 100 0 L 100 150 L 0 150 Z",
  bbox: { x: 0, y: 0, width: 100, height: 150 },
  role: "front",
};

const topFlap: EditorDielinePanel = {
  id: "top-flap",
  pathData: "M 0 -30 L 100 -30 L 100 0 L 0 0 Z",
  bbox: { x: 0, y: -30, width: 100, height: 30 },
  role: "flap",
};

const back: EditorDielinePanel = {
  id: "back",
  pathData: "M 100 0 L 200 0 L 200 150 L 100 150 Z",
  bbox: { x: 100, y: 0, width: 100, height: 150 },
  role: "back",
};

const panels: EditorDielinePanel[] = [front, topFlap, back];

describe("isPointInPanel", () => {
  it("includes points strictly inside the bbox", () => {
    expect(isPointInPanel({ x: 50, y: 75 }, front)).toBe(true);
  });

  it("includes points on the bbox edges", () => {
    expect(isPointInPanel({ x: 0, y: 0 }, front)).toBe(true);
    expect(isPointInPanel({ x: 100, y: 150 }, front)).toBe(true);
  });

  it("excludes points outside the bbox", () => {
    expect(isPointInPanel({ x: -1, y: 75 }, front)).toBe(false);
    expect(isPointInPanel({ x: 50, y: 151 }, front)).toBe(false);
  });
});

describe("findPanelAt", () => {
  it("returns the first panel containing the point in declaration order", () => {
    expect(findPanelAt({ x: 50, y: 75 }, panels)?.id).toBe("front");
    expect(findPanelAt({ x: 50, y: -15 }, panels)?.id).toBe("top-flap");
    expect(findPanelAt({ x: 150, y: 75 }, panels)?.id).toBe("back");
  });

  it("returns undefined when the point falls outside every panel", () => {
    expect(findPanelAt({ x: 500, y: 500 }, panels)).toBeUndefined();
  });
});

describe("getPanelById", () => {
  it("returns the matching panel", () => {
    expect(getPanelById("back", panels)?.role).toBe("back");
  });

  it("returns undefined for unknown ids (stale anchor)", () => {
    expect(getPanelById("ghost", panels)).toBeUndefined();
  });
});

describe("resolveAnchorPanel", () => {
  it("prefers an explicit anchorPanelId when it resolves", () => {
    const obj = { x: 150, y: 75, anchorPanelId: "front" };
    expect(resolveAnchorPanel(obj, panels)?.id).toBe("front");
  });

  it("falls back to hit-testing the object's position when anchorPanelId is stale", () => {
    const obj = { x: 150, y: 75, anchorPanelId: "ghost" };
    expect(resolveAnchorPanel(obj, panels)?.id).toBe("back");
  });

  it("returns undefined when neither route resolves (free-floating object)", () => {
    const obj = { x: 500, y: 500 };
    expect(resolveAnchorPanel(obj, panels)).toBeUndefined();
  });
});
