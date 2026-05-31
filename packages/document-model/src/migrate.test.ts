// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { DocumentModel } from "./extended.js";
import { ensureV3, isV3, upgradeV2ToV3 } from "./migrate.js";
import type { DocumentV3 } from "./v3.js";

function minimalV2(): DocumentModel {
  return {
    version: "2",
    width: 100,
    height: 50,
    unit: "mm",
    separations: [
      { name: "Cyan", colorSpace: "CMYK" },
      { name: "Magenta", colorSpace: "CMYK" },
    ],
    layers: [
      {
        id: "artwork-1",
        type: "artwork",
        name: "Artwork",
        visible: true,
        objects: [],
      },
    ],
  };
}

describe("upgradeV2ToV3", () => {
  it("wraps a v2 doc into a single v3 page preserving dimensions/unit", () => {
    const v2 = minimalV2();
    const v3 = upgradeV2ToV3(v2);
    expect(v3.version).toBe("3");
    expect(v3.pages).toHaveLength(1);
    expect(v3.pages[0]).toMatchObject({
      width: 100,
      height: 50,
      unit: "mm",
      separations: v2.separations,
      layers: v2.layers,
    });
  });

  it("carries doc-level fields through to v3", () => {
    const v2: DocumentModel = {
      ...minimalV2(),
      swatches: ["#000", "#FFF"],
      variableData: { sku: "ABC-123" },
    };
    const v3 = upgradeV2ToV3(v2);
    expect(v3.swatches).toEqual(["#000", "#FFF"]);
    expect(v3.variableData).toEqual({ sku: "ABC-123" });
  });

  it("attaches per-page fields when present on v2", () => {
    const v2: DocumentModel = {
      ...minimalV2(),
      dielineTemplateId: "tmpl-pouch-100x50",
      flexoDistortion: { distortionFactorX: 1.02, distortionFactorY: 0.99 },
    };
    const [page] = upgradeV2ToV3(v2).pages;
    expect(page?.dielineTemplateId).toBe("tmpl-pouch-100x50");
    expect(page?.flexoDistortion).toEqual({
      distortionFactorX: 1.02,
      distortionFactorY: 0.99,
    });
  });

  it("omits absent optional fields rather than emitting undefined", () => {
    const v3 = upgradeV2ToV3(minimalV2());
    const [page] = v3.pages;
    expect("swatches" in v3).toBe(false);
    expect("variableData" in v3).toBe(false);
    expect(page && "dielineTemplateId" in page).toBe(false);
    expect(page && "flexoDistortion" in page).toBe(false);
  });

  it("defaults bleedMm to 0 when v2 doesn't carry an explicit bleed", () => {
    const [page] = upgradeV2ToV3(minimalV2()).pages;
    expect(page?.bleedMm).toBe(0);
  });

  it("is deterministic — same input produces deep-equal output", () => {
    const v2 = minimalV2();
    expect(upgradeV2ToV3(v2)).toEqual(upgradeV2ToV3(v2));
  });

  it("is structurally independent — mutating v3 collections does not leak into v2", () => {
    const v2: DocumentModel = {
      ...minimalV2(),
      swatches: ["#000", "#FFF"],
      graphicStyles: [],
      variableData: { sku: "ABC-123" },
    };
    const v2SeparationsBefore = [...v2.separations];
    const v2LayersBefore = [...v2.layers];
    const v2SwatchesBefore = [...(v2.swatches ?? [])];
    const v2VariableDataBefore = { ...(v2.variableData ?? {}) };

    const v3 = upgradeV2ToV3(v2);
    v3.pages[0]?.separations.push({ name: "Spot1", colorSpace: "Spot" });
    v3.pages[0]?.layers.push({
      id: "leak",
      type: "artwork",
      name: "leak",
      visible: true,
      objects: [],
    });
    v3.swatches?.push("#FF0000");
    if (v3.variableData) v3.variableData.batch = "leak";

    expect(v2.separations).toEqual(v2SeparationsBefore);
    expect(v2.layers).toEqual(v2LayersBefore);
    expect(v2.swatches).toEqual(v2SwatchesBefore);
    expect(v2.variableData).toEqual(v2VariableDataBefore);
  });
});

describe("isV3 / ensureV3", () => {
  it("isV3 discriminates by version tag", () => {
    expect(isV3(minimalV2())).toBe(false);
    const v3: DocumentV3 = { version: "3", pages: [] };
    expect(isV3(v3)).toBe(true);
  });

  it("ensureV3 passes v3 through unchanged and upgrades v2", () => {
    const v3: DocumentV3 = { version: "3", pages: [] };
    expect(ensureV3(v3)).toBe(v3);

    const upgraded = ensureV3(minimalV2());
    expect(upgraded.version).toBe("3");
    expect(upgraded.pages[0]?.width).toBe(100);
  });
});
