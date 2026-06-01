// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  ArtworkObject,
  DocumentV3,
  FoldConfig,
  PageV3,
  PanelMetadata,
  PrintContext,
  ProcessAwareRule,
  SubstrateClass,
  Variant,
  VariantMatrix,
} from "./index.js";
import { ensureV3, upgradeV2ToV3 } from "./migrate.js";

/**
 * Contract tests for Wave 2 PR-A type plumbing.
 *
 * All additions are additive on existing v3 / v2 shapes — these
 * tests pin the new wire surface so the editor (S3 / S4 / V2 / C5 /
 * P1 / P3) and the cross-repo Pydantic mirrors (lint-pdf process
 * matchers, compile-pdf soft-proof + impose-with-marks) can stay in
 * sync. Behaviour belongs in feature-specific tests; here we only
 * verify the types compile, optionality holds, and existing
 * round-trips (`upgradeV2ToV3`, `ensureV3`) preserve identity.
 */

describe("PanelMetadata + DielinePanel (S3)", () => {
  it("attaches to PageV3 as an optional panel registry", () => {
    const panels: PanelMetadata = {
      panels: [
        {
          id: "front",
          name: "Front face",
          pathData: "M0 0 L100 0 L100 100 L0 100 Z",
          bbox: { x: 0, y: 0, width: 100, height: 100 },
          role: "front",
        },
        {
          id: "top-flap",
          pathData: "M0 -20 L100 -20 L100 0 L0 0 Z",
          bbox: { x: 0, y: -20, width: 100, height: 20 },
          role: "flap",
        },
      ],
    };
    const page: PageV3 = {
      id: "p1",
      width: 200,
      height: 300,
      unit: "mm",
      bleedMm: 3,
      separations: [],
      layers: [],
      panelMetadata: panels,
    };
    expect(page.panelMetadata?.panels).toHaveLength(2);
    expect(page.panelMetadata?.panels[0]?.role).toBe("front");
  });

  it("ArtworkObject.anchorPanelId references a panel id (optional)", () => {
    const obj: ArtworkObject = {
      id: "logo-1",
      type: "image",
      x: 10,
      y: 10,
      width: 40,
      height: 20,
      anchorPanelId: "front",
    };
    expect(obj.anchorPanelId).toBe("front");

    const unanchored: ArtworkObject = {
      id: "free",
      type: "rect",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    };
    expect(unanchored.anchorPanelId).toBeUndefined();
  });
});

describe("FoldConfig + FoldEdge (S4)", () => {
  it("attaches to PageV3 as an optional fold-edge list", () => {
    const folds: FoldConfig = {
      edges: [
        { id: "edge-1", panelA: "front", panelB: "top-flap", angleDeg: 90, direction: "mountain" },
        { id: "edge-2", panelA: "front", panelB: "back", angleDeg: 180 },
      ],
      defaultAngleDeg: 0,
    };
    const page: PageV3 = {
      id: "p1",
      width: 200,
      height: 300,
      unit: "mm",
      bleedMm: 0,
      separations: [],
      layers: [],
      foldConfig: folds,
    };
    expect(page.foldConfig?.edges).toHaveLength(2);
    expect(page.foldConfig?.edges[0]?.direction).toBe("mountain");
    expect(page.foldConfig?.edges[1]?.direction).toBeUndefined();
  });
});

describe("VariantMatrix (V2)", () => {
  it("lives on DocumentV3, not PageV3", () => {
    const variants: VariantMatrix = {
      tokenKeys: ["name", "title"],
      variants: [
        { id: "v1", name: "Alice", overrides: { name: "Alice Smith", title: "CEO" } },
        { id: "v2", name: "Bob", overrides: { name: "Bob Jones", title: "CTO" } },
      ],
    };
    const doc: DocumentV3 = {
      version: "3",
      pages: [],
      variants,
    };
    expect(doc.variants?.variants).toHaveLength(2);
    expect(doc.variants?.tokenKeys).toEqual(["name", "title"]);
  });

  it("Variant.overrides keys are a subset of tokenKeys (not enforced by type, by convention)", () => {
    const v: Variant = { id: "v1", name: "test", overrides: { sku: "ABC" } };
    expect(v.overrides.sku).toBe("ABC");
  });
});

describe("PrintContext.colorProfileIccB64 (C5)", () => {
  it("rides alongside the existing colorProfile name", () => {
    const ctx: PrintContext = {
      process: "offset",
      substrate: { id: "stock-1", color: "white", opacity: 1, finish: "gloss" },
      colorProfile: "ISOcoated_v2_eci",
      colorProfileIccB64: "AAEC...",
    };
    expect(ctx.colorProfile).toBe("ISOcoated_v2_eci");
    expect(ctx.colorProfileIccB64).toBe("AAEC...");
  });

  it("is optional — absent on a minimal PrintContext", () => {
    const ctx: PrintContext = {
      process: "digital",
      substrate: { id: "s", color: "white", opacity: 1, finish: "matte" },
    };
    expect(ctx.colorProfileIccB64).toBeUndefined();
  });
});

describe("SubstrateClass + ProcessAwareRule (P1 / P3)", () => {
  it("SubstrateClass enumerates the rule-relevant buckets", () => {
    const coated: SubstrateClass = "coated";
    const uncoated: SubstrateClass = "uncoated";
    const newsprint: SubstrateClass = "newsprint";
    const synthetic: SubstrateClass = "synthetic";
    expect([coated, uncoated, newsprint, synthetic]).toHaveLength(4);
  });

  it("ProcessAwareRule extends PreflightRule with optional process / substrate matchers (array-only)", () => {
    const r: ProcessAwareRule = {
      checkName: "tac_substrate_aware",
      enabled: true,
      severity: "warn",
      clientSide: false,
      params: { maxPercent: 240 },
      process: ["flexo"],
      substrate: ["newsprint", "uncoated"],
    };
    expect(r.process).toEqual(["flexo"]);
    expect(r.substrate).toContain("newsprint");
  });

  it("empty matcher array means 'never apply'; absent means 'match all'", () => {
    const disabled: ProcessAwareRule = {
      checkName: "never",
      enabled: true,
      severity: "warn",
      clientSide: false,
      params: {},
      process: [],
    };
    expect(disabled.process).toEqual([]);
  });

  it("matchers are optional — falls back to universal PreflightRule shape", () => {
    const r: ProcessAwareRule = {
      checkName: "dpi_min",
      enabled: true,
      severity: "block",
      clientSide: true,
      params: { minDpi: 300 },
    };
    expect(r.process).toBeUndefined();
    expect(r.substrate).toBeUndefined();
  });
});

describe("Wave 2 additivity — round-trips still identity", () => {
  it("upgradeV2ToV3 still emits absent panelMetadata / foldConfig", () => {
    const v3 = upgradeV2ToV3({
      version: "2",
      width: 100,
      height: 50,
      unit: "mm",
      separations: [],
      layers: [],
    });
    const page = v3.pages[0];
    expect(page && "panelMetadata" in page).toBe(false);
    expect(page && "foldConfig" in page).toBe(false);
    expect("variants" in v3).toBe(false);
  });

  it("ensureV3 preserves Wave 2 fields on an already-v3 doc", () => {
    const doc: DocumentV3 = {
      version: "3",
      pages: [
        {
          id: "p1",
          width: 100,
          height: 50,
          unit: "mm",
          bleedMm: 0,
          separations: [],
          layers: [],
          panelMetadata: { panels: [] },
          foldConfig: { edges: [] },
        },
      ],
      variants: { variants: [], tokenKeys: [] },
    };
    const out = ensureV3(doc);
    expect(out).toBe(doc);
    expect(out.pages[0]?.panelMetadata).toBeDefined();
    expect(out.pages[0]?.foldConfig).toBeDefined();
    expect(out.variants).toBeDefined();
  });
});
