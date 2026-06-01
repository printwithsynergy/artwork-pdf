// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DocumentModel, DocumentV3 } from "@artworkpdf/document-model";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { composeDocument } from "./compose.js";
import { toPoints } from "./units.js";

const A6_MM = { w: 105, h: 148 };

function v2(overrides: Partial<DocumentModel> = {}): DocumentModel {
  return {
    version: "2",
    width: A6_MM.w,
    height: A6_MM.h,
    unit: "mm",
    separations: [
      { name: "Cyan", colorSpace: "CMYK" },
      { name: "Magenta", colorSpace: "CMYK" },
      { name: "Yellow", colorSpace: "CMYK" },
      { name: "Black", colorSpace: "CMYK" },
    ],
    layers: [],
    ...overrides,
  };
}

describe("composeDocument", () => {
  it("returns a Uint8Array whose bytes begin with the PDF magic header", async () => {
    const bytes = await composeDocument(v2());
    expect(bytes).toBeInstanceOf(Uint8Array);
    const header = String.fromCharCode(...bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
  });

  it("lifts a v2 document into a single PDF page with mm→pt geometry", async () => {
    const bytes = await composeDocument(v2());
    const reread = await PDFDocument.load(bytes);
    expect(reread.getPageCount()).toBe(1);

    const page = reread.getPage(0);
    const expectedW = toPoints(A6_MM.w, "mm");
    const expectedH = toPoints(A6_MM.h, "mm");
    expect(page.getWidth()).toBeCloseTo(expectedW, 4);
    expect(page.getHeight()).toBeCloseTo(expectedH, 4);
  });

  it("emits one PDF page per PageV3 with per-page geometry", async () => {
    const doc: DocumentV3 = {
      version: "3",
      pages: [
        {
          id: "p1",
          width: 210,
          height: 297,
          unit: "mm",
          bleedMm: 0,
          separations: [],
          layers: [],
        },
        {
          id: "p2",
          width: 8.5,
          height: 11,
          unit: "in",
          bleedMm: 0,
          separations: [],
          layers: [],
        },
      ],
    };

    const reread = await PDFDocument.load(await composeDocument(doc));
    expect(reread.getPageCount()).toBe(2);

    const [p1, p2] = reread.getPages();
    expect(p1?.getWidth()).toBeCloseTo(toPoints(210, "mm"), 4);
    expect(p1?.getHeight()).toBeCloseTo(toPoints(297, "mm"), 4);
    expect(p2?.getWidth()).toBeCloseTo(toPoints(8.5, "in"), 4);
    expect(p2?.getHeight()).toBeCloseTo(toPoints(11, "in"), 4);
  });

  it("is deterministic with respect to v2 input across calls", async () => {
    const doc = v2();
    const a = await PDFDocument.load(await composeDocument(doc));
    const b = await PDFDocument.load(await composeDocument(doc));
    expect(a.getPageCount()).toBe(b.getPageCount());
    expect(a.getPage(0).getWidth()).toBe(b.getPage(0).getWidth());
    expect(a.getPage(0).getHeight()).toBe(b.getPage(0).getHeight());
  });
});

describe("toPoints", () => {
  it("maps each unit to PDF points correctly", () => {
    expect(toPoints(72, "pt")).toBe(72);
    expect(toPoints(1, "in")).toBe(72);
    expect(toPoints(25.4, "mm")).toBeCloseTo(72, 6);
    expect(toPoints(96, "px")).toBe(72);
  });
});
