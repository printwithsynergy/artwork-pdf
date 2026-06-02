// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  MarkLibraryEntry,
  MarkLibraryLoaderFn,
  MarkLibraryPanelProps,
} from "./MarkLibraryPanel";
import { filterMarks, groupMarksByCategory } from "./MarkLibraryPanel";

/**
 * Contract tests for MarkLibraryPanel (Wave 4 M1).
 *
 * DOM behaviour (loading state, error rendering, click-to-select)
 * lands when the editor adopts RTL. These tests pin the wire shape
 * so hosts wiring a marks-library endpoint (typically compile-pdf's
 * extended marks producer) have a stable contract.
 */

const CROP_TL: MarkLibraryEntry = {
  id: "crop-tl",
  name: "Crop mark — top-left",
  category: "crop",
  thumbnailDataUrl: "data:image/png;base64,iVBORw0KGgo=",
};

const REG_4C: MarkLibraryEntry = {
  id: "registration-4c",
  name: "4-color registration cross",
  category: "registration",
  description: "Standard CMYK registration cross for press alignment",
};

const COLOR_BAR_ISO: MarkLibraryEntry = {
  id: "color-bar-iso",
  name: "ISO 12647 color bar",
  category: "color-bar",
};

const SLUG: MarkLibraryEntry = {
  id: "job-info",
  name: "Job info slug",
  category: "slug",
};

const ALL: readonly MarkLibraryEntry[] = [CROP_TL, REG_4C, COLOR_BAR_ISO, SLUG];

describe("MarkLibraryEntry type", () => {
  it("requires id, name, category; thumbnailDataUrl + description optional", () => {
    expect(CROP_TL.thumbnailDataUrl).toBeDefined();
    expect(CROP_TL.description).toBeUndefined();
    expect(REG_4C.thumbnailDataUrl).toBeUndefined();
    expect(REG_4C.description).toBeDefined();
  });

  it("category enumerates the canonical buckets", () => {
    const crop: MarkLibraryEntry["category"] = "crop";
    const reg: MarkLibraryEntry["category"] = "registration";
    const color: MarkLibraryEntry["category"] = "color-bar";
    const slug: MarkLibraryEntry["category"] = "slug";
    const other: MarkLibraryEntry["category"] = "other";
    expect([crop, reg, color, slug, other]).toHaveLength(5);
  });
});

describe("MarkLibraryLoaderFn type", () => {
  it("returns a readonly MarkLibraryEntry[] promise", async () => {
    const loader: MarkLibraryLoaderFn = async () => ALL;
    const out = await loader();
    expect(out).toHaveLength(4);
    expect(out[0]?.id).toBe("crop-tl");
  });
});

describe("MarkLibraryPanelProps type", () => {
  it("requires loader; onSelect + filterCategory + activeMarkId optional", () => {
    const props: MarkLibraryPanelProps = {
      loader: async () => ALL,
    };
    expect(props.onSelect).toBeUndefined();
    expect(props.filterCategory).toBeUndefined();
    expect(props.activeMarkId).toBeUndefined();
  });

  it("accepts onSelect + filterCategory + activeMarkId", () => {
    let lastSelected: MarkLibraryEntry | undefined;
    const props: MarkLibraryPanelProps = {
      loader: async () => ALL,
      onSelect: (m) => {
        lastSelected = m;
      },
      filterCategory: "crop",
      activeMarkId: "crop-tl",
    };
    props.onSelect?.(CROP_TL);
    expect(lastSelected?.id).toBe("crop-tl");
    expect(props.filterCategory).toBe("crop");
  });
});

describe("groupMarksByCategory", () => {
  it("groups marks in canonical category order with stable five-bucket shape", () => {
    const groups = groupMarksByCategory(ALL);
    expect(groups.map((g) => g.category)).toEqual([
      "crop",
      "registration",
      "color-bar",
      "slug",
      "other",
    ]);
    expect(groups[0]?.marks).toHaveLength(1);
    expect(groups[1]?.marks).toHaveLength(1);
    expect(groups[2]?.marks).toHaveLength(1);
    expect(groups[3]?.marks).toHaveLength(1);
    expect(groups[4]?.marks).toHaveLength(0);
  });

  it("returns five buckets even for empty input", () => {
    const groups = groupMarksByCategory([]);
    expect(groups).toHaveLength(5);
    expect(groups.every((g) => g.marks.length === 0)).toBe(true);
  });

  it("preserves entry order within a category bucket", () => {
    const a: MarkLibraryEntry = { id: "a", name: "Crop A", category: "crop" };
    const b: MarkLibraryEntry = { id: "b", name: "Crop B", category: "crop" };
    const groups = groupMarksByCategory([a, b]);
    expect(groups[0]?.marks.map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("filterMarks", () => {
  it("filters by category exactly", () => {
    expect(filterMarks(ALL, { category: "crop" })).toHaveLength(1);
  });
  it("filters by case-insensitive substring on name", () => {
    const r = filterMarks(ALL, { query: "registration" });
    expect(r.map((m) => m.id)).toEqual(["registration-4c"]);
  });
  it("combines category + query (AND)", () => {
    expect(filterMarks(ALL, { category: "crop", query: "top-left" })).toHaveLength(1);
    expect(filterMarks(ALL, { category: "crop", query: "registration" })).toEqual([]);
  });
  it("returns all entries for an empty filter", () => {
    expect(filterMarks(ALL, {})).toHaveLength(4);
  });
  it("ignores whitespace-only queries", () => {
    expect(filterMarks(ALL, { query: "   " })).toHaveLength(4);
  });
});
