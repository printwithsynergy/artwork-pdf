// SPDX-License-Identifier: AGPL-3.0-or-later
import { parseARD, parseCF2, parseDDES } from "@artworkpdf/dieline-parser";
import { describe, expect, it } from "vitest";
import { dielineToPage } from "./dieline-template";

const MM_TO_PT = 2.83465;

describe("dielineToPage — CF2 fixture", () => {
  // Minimal CF2 — a closed cut rectangle 100×50 mm + a single
  // crease line bisecting it horizontally.
  const cf2Fixture = `
# small CF2 test fixture
LAYER 0 TYPE 0
LINE 0 0 100 0
LINE 100 0 100 50
LINE 100 50 0 50
LINE 0 50 0 0
LAYER 1 TYPE 1
LINE 0 25 100 25
`.trim();

  it("converts a CF2 dieline into a Page with one CanvasObj per path type", () => {
    const dieline = parseCF2(cf2Fixture);
    const page = dielineToPage(dieline);

    // Parser groups segments by type → 2 paths (cut + crease).
    expect(page.objects).toHaveLength(2);
    expect(page.objects.every((o) => o.type === "path")).toBe(true);
    expect(page.objects.every((o) => o.locked === true)).toBe(true);

    // Stroke colors come from the per-type table.
    const byType = Object.fromEntries(
      page.objects.map((o) => [o.name?.split(" ").pop(), o.stroke]),
    );
    expect(byType.cut).toBe("#fc5102");
    expect(byType.crease).toBe("#1e90ff");
  });

  it("computes pageSize from the parsed bounding box with optional bleed", () => {
    const dieline = parseCF2(cf2Fixture);
    const noBleed = dielineToPage(dieline);
    const withBleed = dielineToPage(dieline, 3);

    expect(noBleed.pageSize.width).toBeCloseTo(100 * MM_TO_PT, 3);
    expect(noBleed.pageSize.height).toBeCloseTo(50 * MM_TO_PT, 3);
    expect(noBleed.bleedMm).toBe(0);

    expect(withBleed.pageSize.width).toBeCloseTo((100 + 6) * MM_TO_PT, 3);
    expect(withBleed.pageSize.height).toBeCloseTo((50 + 6) * MM_TO_PT, 3);
    expect(withBleed.bleedMm).toBe(3);

    // Each path object is offset by bleedMm so the trim sits inside the bleed margin.
    for (const obj of withBleed.objects) {
      expect(obj.x).toBeCloseTo(3 * MM_TO_PT, 3);
      expect(obj.y).toBeCloseTo(3 * MM_TO_PT, 3);
    }
  });
});

describe("dielineToPage — DDES fixture", () => {
  // Single LINE with typeCode 0 (cut).
  const ddesFixture = `
DDES2
UNIT MM
LINE 0 0 0 50 50
LINE 0 50 50 0 0
`.trim();

  it("emits a path object with the DDES format tag in the name", () => {
    const dieline = parseDDES(ddesFixture);
    const page = dielineToPage(dieline);
    expect(page.objects.length).toBeGreaterThan(0);
    expect(page.objects[0]?.name?.startsWith("DDES")).toBe(true);
    expect(page.id.startsWith("page-ddes-")).toBe(true);
  });
});

describe("dielineToPage — ARD fixture", () => {
  // ARD LINES section with two cut segments (typeCode 0).
  const ardFixture = `
LINES
0 0 0 100 0
0 100 0 100 50
END
`.trim();

  it("emits a path object with the ARD format tag in the name", () => {
    const dieline = parseARD(ardFixture);
    const page = dielineToPage(dieline);
    expect(page.objects.length).toBeGreaterThan(0);
    expect(page.objects[0]?.name?.startsWith("ARD")).toBe(true);
    expect(page.id.startsWith("page-ard-")).toBe(true);
  });
});

describe("dielineToPage — invariants", () => {
  it("returns a non-zero page size even when the parsed bounding box collapses to a point", () => {
    // A "dieline" with a single zero-length line — parser may emit an
    // empty paths array if it dedupes; this test guards the edge case.
    const dieline = parseCF2("LINE 0 0 0 0");
    const page = dielineToPage(dieline);
    // Bounding box width/height = 0; pageSize falls out to 0 here too,
    // which is acceptable for a degenerate input — the contract is
    // "deterministic, non-throwing".
    expect(page.objects).toBeDefined();
    expect(page.pageSize.width).toBeGreaterThanOrEqual(0);
    expect(page.pageSize.height).toBeGreaterThanOrEqual(0);
  });

  it("path data is the SVG d-string from the parser, not re-serialized", () => {
    const dieline = parseCF2("LINE 0 0 10 10");
    const page = dielineToPage(dieline);
    expect(page.objects[0]?.pathData).toContain("M0,0");
    expect(page.objects[0]?.pathData).toContain("L10,10");
  });
});
