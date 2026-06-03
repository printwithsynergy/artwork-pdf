// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  AnnotationOverlayAnnotation,
  AnnotationOverlayProps,
  AreaAnnotationInput,
  PointAnnotationInput,
  TextAnnotationInput,
} from "./AnnotationOverlay";
import {
  describeAnnotation,
  isPointInsideAnnotation,
  visibleAnnotations,
} from "./AnnotationOverlay";

/**
 * Contract tests for AnnotationOverlay (Wave 4 X3).
 *
 * DOM behaviour (SVG marker rendering, hover affordance, modal popover)
 * lands when the editor adopts RTL. These tests pin the wire shape so
 * hosts wiring `PageV3.annotations` into the overlay have a stable
 * contract.
 */

const POINT: PointAnnotationInput = {
  id: "p1",
  kind: "point",
  x: 100,
  y: 50,
  createdAt: "2026-06-01T10:00:00Z",
};

const AREA: AreaAnnotationInput = {
  id: "a1",
  kind: "area",
  x: 10,
  y: 10,
  width: 50,
  height: 30,
  createdAt: "2026-06-01T11:00:00Z",
  text: "Logo too small here",
};

const TEXT: TextAnnotationInput = {
  id: "t1",
  kind: "text",
  x: 200,
  y: 300,
  text: "Approve before press",
  createdAt: "2026-06-01T12:00:00Z",
  resolved: false,
};

const ALL: readonly AnnotationOverlayAnnotation[] = [POINT, AREA, TEXT];

describe("AnnotationOverlayAnnotation discriminated union", () => {
  it("point requires id/kind/x/y/createdAt; text + author + resolved optional", () => {
    expect(POINT.kind).toBe("point");
    expect(POINT.author).toBeUndefined();
  });
  it("area requires width + height in addition to anchor", () => {
    expect(AREA.kind).toBe("area");
    expect(AREA.width).toBe(50);
    expect(AREA.height).toBe(30);
  });
  it("text requires a body string", () => {
    expect(TEXT.kind).toBe("text");
    expect(TEXT.text).toBe("Approve before press");
  });
});

describe("AnnotationOverlayProps type", () => {
  it("requires annotations + page dimensions; onSelect / showResolved optional", () => {
    const props: AnnotationOverlayProps = {
      annotations: ALL,
      pageWidthPx: 800,
      pageHeightPx: 600,
    };
    expect(props.annotations).toHaveLength(3);
    expect(props.onSelect).toBeUndefined();
    expect(props.showResolved).toBeUndefined();
  });
  it("accepts onSelect + showResolved + activeAnnotationId", () => {
    let lastSelected: AnnotationOverlayAnnotation | undefined;
    const props: AnnotationOverlayProps = {
      annotations: ALL,
      pageWidthPx: 800,
      pageHeightPx: 600,
      onSelect: (a) => {
        lastSelected = a;
      },
      showResolved: true,
      activeAnnotationId: "p1",
    };
    props.onSelect?.(POINT);
    expect(lastSelected?.id).toBe("p1");
    expect(props.showResolved).toBe(true);
    expect(props.activeAnnotationId).toBe("p1");
  });
});

describe("visibleAnnotations", () => {
  const resolvedText: TextAnnotationInput = {
    ...TEXT,
    id: "t-resolved",
    resolved: true,
  };
  const annotations = [POINT, AREA, TEXT, resolvedText];

  it("hides resolved annotations by default", () => {
    const visible = visibleAnnotations(annotations, false);
    expect(visible).toHaveLength(3);
    expect(visible.every((a) => a.id !== "t-resolved")).toBe(true);
  });
  it("shows resolved annotations when showResolved is true", () => {
    const visible = visibleAnnotations(annotations, true);
    expect(visible).toHaveLength(4);
  });
  it("preserves input order in both modes", () => {
    const ordered = visibleAnnotations(annotations, true);
    expect(ordered.map((a) => a.id)).toEqual(["p1", "a1", "t1", "t-resolved"]);
  });
});

describe("describeAnnotation", () => {
  it("describes an open point without body", () => {
    expect(describeAnnotation(POINT)).toBe("Open point annotation");
  });
  it("includes a truncated body when present", () => {
    expect(describeAnnotation(AREA)).toBe("Open area annotation: Logo too small here");
  });
  it("uses Resolved as the status prefix when applicable", () => {
    const resolved: TextAnnotationInput = { ...TEXT, resolved: true };
    expect(describeAnnotation(resolved)).toBe("Resolved text annotation: Approve before press");
  });
  it("truncates long bodies to 60 chars with an ellipsis", () => {
    const longText: TextAnnotationInput = {
      ...TEXT,
      text: "a".repeat(200),
    };
    const label = describeAnnotation(longText);
    expect(label.startsWith("Open text annotation: ")).toBe(true);
    expect(label.endsWith("…")).toBe(true);
    // 60 a's + ellipsis
    expect(label.length).toBeLessThan(100);
  });
});

describe("isPointInsideAnnotation", () => {
  it("treats a point as inside iff cx/cy is within HIT_RADIUS_PX", () => {
    // The default hit radius is small (8px). Anchor of POINT is at
    // (100, 50). Within radius → inside; far away → outside.
    expect(isPointInsideAnnotation(POINT, 100, 50)).toBe(true);
    expect(isPointInsideAnnotation(POINT, 104, 53)).toBe(true);
    expect(isPointInsideAnnotation(POINT, 200, 200)).toBe(false);
  });
  it("treats an area as inside iff x/y lies in the bounding rect", () => {
    // AREA spans (10,10) → (60,40).
    expect(isPointInsideAnnotation(AREA, 10, 10)).toBe(true);
    expect(isPointInsideAnnotation(AREA, 50, 25)).toBe(true);
    expect(isPointInsideAnnotation(AREA, 60, 40)).toBe(true);
    expect(isPointInsideAnnotation(AREA, 9, 25)).toBe(false);
    expect(isPointInsideAnnotation(AREA, 100, 100)).toBe(false);
  });
  it("treats a text annotation like a point (anchor-only hit radius)", () => {
    expect(isPointInsideAnnotation(TEXT, 200, 300)).toBe(true);
    expect(isPointInsideAnnotation(TEXT, 220, 320)).toBe(false);
  });
});
