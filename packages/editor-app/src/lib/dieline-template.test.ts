// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  TEMPLATE_SETS,
  getDefaultTemplate,
  getTemplateById,
  getTemplateSetById,
  templateSetToPages,
  templateToInitialState,
  templateToPage,
  templatesToPages,
} from "./dieline-template";

describe("dieline-template", () => {
  it("getDefaultTemplate returns the entry flagged isDefault", () => {
    const t = getDefaultTemplate();
    expect(t.isDefault).toBe(true);
    expect(t.id).toBe("standup-pouch-4x6");
  });

  it("getTemplateById returns undefined for unknown ids so the demo page can fall back", () => {
    expect(getTemplateById("does-not-exist")).toBeUndefined();
    expect(getTemplateById(undefined)).toBeUndefined();
    expect(getTemplateById("")).toBeUndefined();
  });

  it("templateToInitialState produces the correct mm→pt geometry for the default pouch", () => {
    // Stand-Up Pouch 4×6 — 101.6 × 152.4 mm trim, 3 mm bleed.
    // Page = (101.6 + 6) × (152.4 + 6) mm × 2.83465 pt/mm ≈ 305 × 449 pt.
    // Trim rect at (3,3) mm with size 101.6 × 152.4 mm ≈ (8.5, 8.5) pt size 288 × 432 pt.
    const t = getDefaultTemplate();
    const { objects, pageSize } = templateToInitialState(t);

    expect(pageSize.width).toBeCloseTo(305, 0);
    expect(pageSize.height).toBeCloseTo(449, 0);

    expect(objects).toHaveLength(1);
    const rect = objects[0];
    if (!rect) throw new Error("expected one dieline rect");
    expect(rect.id).toBe("dieline-standup-pouch-4x6");
    expect(rect.type).toBe("rect");
    expect(rect.x).toBeCloseTo(8.5, 0);
    expect(rect.y).toBeCloseTo(8.5, 0);
    expect(rect.width).toBeCloseTo(288, 0);
    expect(rect.height).toBeCloseTo(432, 0);
  });

  it("templateToInitialState honors a bleedMm override", () => {
    // Override with 0.125 in = 3.175 mm → pageSize changes by 0.35 mm
    // each side, the trim rect shifts to the new offset.
    const t = getDefaultTemplate();
    const { objects, pageSize } = templateToInitialState(t, 3.175);
    expect(pageSize.width).toBeCloseTo((101.6 + 6.35) * 2.83465, 1);
    expect(pageSize.height).toBeCloseTo((152.4 + 6.35) * 2.83465, 1);
    const rect = objects[0];
    if (!rect) throw new Error("expected one dieline rect");
    expect(rect.x).toBeCloseTo(3.175 * 2.83465, 1);
    expect(rect.y).toBeCloseTo(3.175 * 2.83465, 1);
  });

  it("templateToPage produces a Page with id + templateId + optional name", () => {
    const t = getDefaultTemplate();
    const page = templateToPage(t, 3.175, "Front");
    expect(page.templateId).toBe("standup-pouch-4x6");
    expect(page.bleedMm).toBe(3.175);
    expect(page.name).toBe("Front");
    expect(page.objects).toHaveLength(1);
    expect(page.objects[0]?.id).toBe("dieline-standup-pouch-4x6");
    expect(page.id).toMatch(/^page-standup-pouch-4x6-/);
  });

  it("templatesToPages preserves order and per-entry names", () => {
    const a = getDefaultTemplate();
    const b = getTemplateById("flat-pouch-3x5");
    if (!b) throw new Error("missing flat-pouch-3x5 fixture");
    const pages = templatesToPages(
      [
        { template: a, name: "Front" },
        { template: b, name: "Insert" },
      ],
      3.175,
    );
    expect(pages.map((p) => p.templateId)).toEqual(["standup-pouch-4x6", "flat-pouch-3x5"]);
    expect(pages.map((p) => p.name)).toEqual(["Front", "Insert"]);
  });

  it("templateSetToPages expands a bundled set into pages", () => {
    const set = getTemplateSetById("carton-6x4x2-set");
    if (!set) throw new Error("missing carton-6x4x2-set fixture");
    const pages = templateSetToPages(set, 3.175);
    expect(pages).toHaveLength(2);
    expect(pages.map((p) => p.templateId)).toEqual(["carton-6x4x2", "carton-6x4x2"]);
    expect(pages.map((p) => p.name)).toEqual(["Front", "Back"]);
  });

  it("getTemplateSetById falls back to undefined for unknown ids", () => {
    expect(getTemplateSetById("does-not-exist")).toBeUndefined();
    expect(getTemplateSetById(undefined)).toBeUndefined();
  });

  it("bundled TEMPLATE_SETS exist and all reference valid template ids", () => {
    expect(TEMPLATE_SETS.length).toBeGreaterThan(0);
    for (const set of TEMPLATE_SETS) {
      for (const entry of set.pages) {
        const t = getTemplateById(entry.templateId);
        expect(t, `unknown templateId in set ${set.id}: ${entry.templateId}`).toBeDefined();
      }
    }
  });
});
