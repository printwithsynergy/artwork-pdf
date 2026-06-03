// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Wave 4 S5 — Structural export (CF2 / DXF emit).
 *
 * The dieline editor authors structural intent (cut/crease/perf/bleed
 * lines on labeled layers). Production downstream (die makers, table
 * cutters) needs that intent emitted as a structural-CAD file. S5
 * ships a pure helper that converts the editor's
 * {@link StructuralExportDieline} to a textual CF2 / DXF buffer
 * suitable for `Blob` download.
 *
 * Both emitters are pure — the host wires the actual download via
 * a `<a download>` link or `URL.createObjectURL(Blob)` flow.
 *
 * @public
 */

/**
 * One structural path emitted to the file. Mirrors the
 * `DielinePath` shape from `@printwithsynergy/dieline-parser` so the
 * editor can pass parsed dielines straight through.
 *
 * @public
 */
export type StructuralPath = {
  /** Line type maps to CF2 line-type code 1..4: cut, crease,
   *  perf, bleed. */
  type: "cut" | "crease" | "perf" | "bleed";
  /** Polyline vertices in millimetres. */
  points: ReadonlyArray<{ x: number; y: number }>;
};

/**
 * Source dieline for the structural emit.
 *
 * @public
 */
export type StructuralExportDieline = {
  /** Display name — emitted as the CF2 `J1` job comment.
   *  (DXF doesn't carry it; downstream CAD packages take the
   *  filename as the job name.) */
  name: string;
  /** Bounding box in millimetres. CF2 emits `B1 0 0 widthMm
   *  heightMm` and DXF emits a `$LIMMIN` / `$LIMMAX` pair. */
  widthMm: number;
  heightMm: number;
  paths: readonly StructuralPath[];
};

const CF2_LINE_TYPE: Record<StructuralPath["type"], number> = {
  cut: 1,
  crease: 2,
  perf: 3,
  bleed: 4,
};

/**
 * Pure emitter — produces a CF2 (Common File Format) text buffer.
 * CF2 is the de-facto interchange format for die makers. The grammar
 * here is the minimum subset every CF2 reader accepts: header (`J1`),
 * bounding box (`B1`), then one line per polyline segment with a
 * line-type code.
 *
 * Pure function.
 *
 * @public
 */
export function emitCf2(dieline: StructuralExportDieline): string {
  const lines: string[] = [
    `J1 ${dieline.name.replace(/\s+/g, "_")}`,
    `B1 0 0 ${dieline.widthMm.toFixed(3)} ${dieline.heightMm.toFixed(3)}`,
  ];
  for (const path of dieline.paths) {
    const lt = CF2_LINE_TYPE[path.type];
    for (let i = 0; i < path.points.length - 1; i++) {
      const a = path.points[i];
      const b = path.points[i + 1];
      if (a === undefined || b === undefined) continue;
      // CF2 L1 segment: L<line_type> <x1> <y1> <x2> <y2>
      lines.push(
        `L${lt} ${a.x.toFixed(3)} ${a.y.toFixed(3)} ${b.x.toFixed(3)} ${b.y.toFixed(3)}`,
      );
    }
  }
  lines.push("END");
  return `${lines.join("\n")}\n`;
}

const DXF_LAYER: Record<StructuralPath["type"], string> = {
  cut: "CUT",
  crease: "CREASE",
  perf: "PERF",
  bleed: "BLEED",
};

/**
 * Pure emitter — produces a minimal AutoCAD DXF (R12) text buffer.
 * One LINE entity per polyline segment, layered by line type so the
 * downstream CAD package can colour them. Header carries the
 * `$LIMMIN` / `$LIMMAX` extent so the file opens framed.
 *
 * Pure function.
 *
 * @public
 */
export function emitDxf(dieline: StructuralExportDieline): string {
  const out: string[] = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$LIMMIN",
    "10",
    "0.0",
    "20",
    "0.0",
    "9",
    "$LIMMAX",
    "10",
    dieline.widthMm.toFixed(3),
    "20",
    dieline.heightMm.toFixed(3),
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
  ];
  for (const path of dieline.paths) {
    const layer = DXF_LAYER[path.type];
    for (let i = 0; i < path.points.length - 1; i++) {
      const a = path.points[i];
      const b = path.points[i + 1];
      if (a === undefined || b === undefined) continue;
      out.push(
        "0",
        "LINE",
        "8",
        layer,
        "10",
        a.x.toFixed(3),
        "20",
        a.y.toFixed(3),
        "11",
        b.x.toFixed(3),
        "21",
        b.y.toFixed(3),
      );
    }
  }
  out.push("0", "ENDSEC", "0", "EOF");
  return `${out.join("\n")}\n`;
}

/**
 * Format selector accepted by {@link emitStructural}.
 *
 * @public
 */
export type StructuralExportFormat = "cf2" | "dxf";

/**
 * Pure helper — dispatches to {@link emitCf2} or {@link emitDxf}.
 *
 * @public
 */
export function emitStructural(
  dieline: StructuralExportDieline,
  format: StructuralExportFormat,
): string {
  return format === "cf2" ? emitCf2(dieline) : emitDxf(dieline);
}
