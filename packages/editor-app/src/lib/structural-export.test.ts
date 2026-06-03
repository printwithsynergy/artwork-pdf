// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  emitCf2,
  emitDxf,
  emitStructural,
  type StructuralExportDieline,
} from "./structural-export";

const SAMPLE: StructuralExportDieline = {
  name: "Carton 12oz",
  widthMm: 100,
  heightMm: 50,
  paths: [
    {
      type: "cut",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
        { x: 0, y: 0 },
      ],
    },
    {
      type: "crease",
      points: [
        { x: 30, y: 0 },
        { x: 30, y: 50 },
      ],
    },
  ],
};

describe("emitCf2", () => {
  it("emits a J1 header with sanitized job name", () => {
    const out = emitCf2(SAMPLE);
    expect(out).toMatch(/^J1 Carton_12oz\n/);
  });

  it("emits a B1 bounding box matching dieline dims", () => {
    expect(emitCf2(SAMPLE)).toMatch(/B1 0 0 100\.000 50\.000/);
  });

  it("emits one L<linetype> segment per polyline edge", () => {
    const out = emitCf2(SAMPLE);
    const cutLines = out.split("\n").filter((l) => l.startsWith("L1 "));
    expect(cutLines).toHaveLength(4); // 5-point closed quad → 4 edges
    const creaseLines = out.split("\n").filter((l) => l.startsWith("L2 "));
    expect(creaseLines).toHaveLength(1);
  });

  it("ends with END", () => {
    expect(emitCf2(SAMPLE).trimEnd().split("\n").at(-1)).toBe("END");
  });
});

describe("emitDxf", () => {
  it("frames the file with $LIMMIN / $LIMMAX matching dims", () => {
    const out = emitDxf(SAMPLE);
    expect(out).toContain("$LIMMIN");
    expect(out).toContain("$LIMMAX");
    expect(out).toMatch(/\$LIMMAX[\s\S]*100\.000/);
    expect(out).toMatch(/\$LIMMAX[\s\S]*50\.000/);
  });

  it("emits one LINE entity per polyline edge on the right layer", () => {
    const out = emitDxf(SAMPLE);
    const cutCount = (out.match(/^LINE$/gm) ?? []).length;
    expect(cutCount).toBe(5); // 4 cut + 1 crease
    expect(out).toContain("CUT");
    expect(out).toContain("CREASE");
  });

  it("closes with EOF", () => {
    expect(emitDxf(SAMPLE).trimEnd().split("\n").at(-1)).toBe("EOF");
  });
});

describe("emitStructural dispatcher", () => {
  it("returns CF2 when format=cf2", () => {
    expect(emitStructural(SAMPLE, "cf2")).toMatch(/^J1 /);
  });

  it("returns DXF when format=dxf", () => {
    expect(emitStructural(SAMPLE, "dxf")).toMatch(/^0\nSECTION/);
  });
});
