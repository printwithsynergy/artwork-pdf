// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { AnnotationOverlayAnnotation } from "./AnnotationOverlay";
import type {
  AnnotationStatusFilter,
  AnnotationsSidebarFilter,
  AnnotationsSidebarProps,
} from "./AnnotationsSidebar";
import { filterAnnotationsForSidebar, sortAnnotationsByDate } from "./AnnotationsSidebar";

/**
 * Contract tests for AnnotationsSidebar (Wave 4 X1).
 *
 * DOM behaviour (status dropdown, author search, button click
 * routing) lands when the editor adopts RTL. These tests pin the wire
 * shape so hosts wiring an annotation store have a stable contract,
 * plus the two pure helpers downstream renderers can reuse.
 */

const OPEN_POINT: AnnotationOverlayAnnotation = {
  id: "p-1",
  kind: "point",
  x: 100,
  y: 200,
  author: "Quincy",
  createdAt: "2026-06-01T10:00:00.000Z",
  text: "Logo position",
};
const RESOLVED_AREA: AnnotationOverlayAnnotation = {
  id: "a-1",
  kind: "area",
  x: 50,
  y: 75,
  width: 120,
  height: 80,
  author: "Mira",
  createdAt: "2026-05-30T08:15:00.000Z",
  text: "Bleed-zone clip",
  resolved: true,
};
const OPEN_TEXT: AnnotationOverlayAnnotation = {
  id: "t-1",
  kind: "text",
  x: 200,
  y: 250,
  author: "Quincy",
  createdAt: "2026-06-02T12:30:00.000Z",
  text: "Headline weight",
};
const ANONYMOUS: AnnotationOverlayAnnotation = {
  id: "p-2",
  kind: "point",
  x: 300,
  y: 400,
  createdAt: "2026-06-01T18:00:00.000Z",
  text: "Anchor offset",
};

const ALL = [OPEN_POINT, RESOLVED_AREA, OPEN_TEXT, ANONYMOUS] as const;

describe("AnnotationStatusFilter type", () => {
  it("enumerates the three canonical filters", () => {
    const open: AnnotationStatusFilter = "open";
    const resolved: AnnotationStatusFilter = "resolved";
    const all: AnnotationStatusFilter = "all";
    expect([open, resolved, all]).toHaveLength(3);
  });
});

describe("filterAnnotationsForSidebar", () => {
  it("returns all annotations for an empty filter (treated as 'all')", () => {
    expect(filterAnnotationsForSidebar(ALL, {})).toHaveLength(4);
  });

  it("keeps only unresolved when status='open'", () => {
    const out = filterAnnotationsForSidebar(ALL, { status: "open" });
    expect(out.map((a) => a.id)).toEqual(["p-1", "t-1", "p-2"]);
  });

  it("keeps only resolved when status='resolved'", () => {
    const out = filterAnnotationsForSidebar(ALL, { status: "resolved" });
    expect(out.map((a) => a.id)).toEqual(["a-1"]);
  });

  it("filters by case-insensitive author substring", () => {
    expect(filterAnnotationsForSidebar(ALL, { author: "qu" })).toHaveLength(2);
    expect(filterAnnotationsForSidebar(ALL, { author: "MIRA" })).toHaveLength(1);
  });

  it("drops anonymous annotations from author searches", () => {
    const out = filterAnnotationsForSidebar(ALL, { author: "quincy" });
    expect(out.map((a) => a.id)).toEqual(["p-1", "t-1"]);
  });

  it("ignores whitespace-only author queries", () => {
    expect(filterAnnotationsForSidebar(ALL, { author: "   " })).toHaveLength(4);
  });

  it("combines status + author (AND)", () => {
    const out = filterAnnotationsForSidebar(ALL, { status: "open", author: "quincy" });
    expect(out.map((a) => a.id)).toEqual(["p-1", "t-1"]);
  });
});

describe("sortAnnotationsByDate", () => {
  it("sorts newest first by default", () => {
    const out = sortAnnotationsByDate(ALL);
    expect(out.map((a) => a.id)).toEqual(["t-1", "p-2", "p-1", "a-1"]);
  });

  it("sorts ascending when direction='asc'", () => {
    const out = sortAnnotationsByDate(ALL, "asc");
    expect(out.map((a) => a.id)).toEqual(["a-1", "p-1", "p-2", "t-1"]);
  });

  it("returns a new array (does not mutate input)", () => {
    const input = [...ALL];
    const snapshot = input.map((a) => a.id);
    sortAnnotationsByDate(input);
    expect(input.map((a) => a.id)).toEqual(snapshot);
  });

  it("returns an empty array for empty input", () => {
    expect(sortAnnotationsByDate([])).toEqual([]);
  });
});

describe("AnnotationsSidebarFilter type", () => {
  it("requires neither status nor author", () => {
    const f: AnnotationsSidebarFilter = {};
    expect(f.status).toBeUndefined();
    expect(f.author).toBeUndefined();
  });
});

describe("AnnotationsSidebarProps type", () => {
  it("requires annotations; everything else optional", () => {
    const props: AnnotationsSidebarProps = {
      annotations: ALL,
    };
    expect(props.onSelect).toBeUndefined();
    expect(props.onToggleResolved).toBeUndefined();
    expect(props.onDelete).toBeUndefined();
    expect(props.defaultStatus).toBeUndefined();
    expect(props.activeAnnotationId).toBeUndefined();
  });

  it("accepts the full optional surface", () => {
    let selectedId: string | undefined;
    let resolvedToggledId: string | undefined;
    let deletedId: string | undefined;
    const props: AnnotationsSidebarProps = {
      annotations: ALL,
      activeAnnotationId: "p-1",
      defaultStatus: "all",
      onSelect: (a) => {
        selectedId = a.id;
      },
      onToggleResolved: (a) => {
        resolvedToggledId = a.id;
      },
      onDelete: (a) => {
        deletedId = a.id;
      },
    };
    props.onSelect?.(OPEN_POINT);
    props.onToggleResolved?.(RESOLVED_AREA);
    props.onDelete?.(OPEN_TEXT);
    expect(selectedId).toBe("p-1");
    expect(resolvedToggledId).toBe("a-1");
    expect(deletedId).toBe("t-1");
  });
});
