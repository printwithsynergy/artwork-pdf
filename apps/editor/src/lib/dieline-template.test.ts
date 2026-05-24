// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { getDefaultTemplate, getTemplateById, templateToInitialState } from "./dieline-template";

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
});
