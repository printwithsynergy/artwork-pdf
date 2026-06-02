// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  Annotation,
  AreaAnnotation,
  BrandAssetRef,
  DocumentV3,
  PageV3,
  PointAnnotation,
  PreflightSnapshot,
  TextAnnotation,
  Variant,
  VariantMatrix,
} from "./index.js";
import { upgradeV2ToV3 } from "./migrate.js";

/**
 * Contract tests for Wave 4 PR-A type plumbing.
 *
 * All additions are additive on existing v3 shapes — these tests
 * pin the new wire surface so Wave 4 features (X3 annotations, B1/B2
 * brand assets, P4 preflight diff, V3 versioned variants) can wire
 * UI against a stable contract. Behaviour belongs in feature-specific
 * tests; here we only verify the types compile, optionality holds,
 * and existing round-trips (`upgradeV2ToV3`) preserve identity.
 */

describe("Annotation (X3)", () => {
  it("attaches to PageV3 as an optional list", () => {
    const annotations: Annotation[] = [
      {
        id: "ann-1",
        kind: "point",
        x: 50,
        y: 50,
        author: "designer@example.com",
        createdAt: "2026-06-02T12:00:00Z",
      },
      {
        id: "ann-2",
        kind: "area",
        x: 10,
        y: 10,
        width: 40,
        height: 30,
        text: "Logo should be larger here",
        author: "reviewer@example.com",
        createdAt: "2026-06-02T13:00:00Z",
        resolved: false,
      },
      {
        id: "ann-3",
        kind: "text",
        x: 100,
        y: 200,
        text: "Approve before press",
        createdAt: "2026-06-02T14:00:00Z",
      },
    ];
    const page: PageV3 = {
      id: "p1",
      width: 200,
      height: 300,
      unit: "mm",
      bleedMm: 3,
      separations: [],
      layers: [],
      annotations,
    };
    expect(page.annotations).toHaveLength(3);
    expect(page.annotations?.[0]?.kind).toBe("point");
    expect(page.annotations?.[1]?.kind).toBe("area");
    expect(page.annotations?.[1]?.resolved).toBe(false);
  });

  it("annotations are optional — absent on a minimal page", () => {
    const page: PageV3 = {
      id: "p1",
      width: 100,
      height: 100,
      unit: "mm",
      bleedMm: 0,
      separations: [],
      layers: [],
    };
    expect(page.annotations).toBeUndefined();
  });

  it("discriminated union — point has no width/height, area requires both, text requires body", () => {
    // Point: just an anchor, optional note. No width/height allowed.
    const point: PointAnnotation = {
      id: "p",
      kind: "point",
      x: 0,
      y: 0,
      createdAt: "2026-06-02T00:00:00Z",
    };
    expect(point.text).toBeUndefined();
    expect(point.author).toBeUndefined();
    expect(point.resolved).toBeUndefined();
    // @ts-expect-error — width is not a field on PointAnnotation
    point.width;

    // Area: required width + height. Text optional.
    const area: AreaAnnotation = {
      id: "a",
      kind: "area",
      x: 0,
      y: 0,
      width: 10,
      height: 20,
      createdAt: "2026-06-02T00:00:00Z",
    };
    expect(area.width).toBe(10);
    expect(area.height).toBe(20);

    // Text: required text body.
    const text: TextAnnotation = {
      id: "t",
      kind: "text",
      x: 0,
      y: 0,
      text: "Approve before press",
      createdAt: "2026-06-02T00:00:00Z",
    };
    expect(text.text).toBe("Approve before press");
    // @ts-expect-error — width is not a field on TextAnnotation
    text.width;

    // The union itself narrows on `kind`. Use an array typed as the
    // wider union so TS doesn't pre-narrow on assignment.
    const all: Annotation[] = [point, area, text];
    for (const a of all) {
      if (a.kind === "area") {
        expect(a.width).toBeGreaterThanOrEqual(0);
      } else if (a.kind === "text") {
        expect(a.text.length).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("BrandAssetRef (B1)", () => {
  it("rides on DocumentV3 as an optional registry", () => {
    const brandAssets: BrandAssetRef[] = [
      {
        id: "logo-primary",
        hash: "a".repeat(64),
        name: "Acme Primary Logo",
        kind: "logo",
        mimeType: "image/svg+xml",
        sourceUrl: "https://cdn.acme.com/logo.svg",
      },
      {
        id: "swatch-brand-blue",
        hash: "b".repeat(64),
        name: "Brand Blue",
        kind: "swatch",
      },
    ];
    const doc: DocumentV3 = {
      version: "3",
      pages: [],
      brandAssets,
    };
    expect(doc.brandAssets).toHaveLength(2);
    expect(doc.brandAssets?.[0]?.kind).toBe("logo");
    expect(doc.brandAssets?.[1]?.sourceUrl).toBeUndefined();
  });

  it("kind enumerates the brand-consistency buckets", () => {
    const logo: BrandAssetRef["kind"] = "logo";
    const swatch: BrandAssetRef["kind"] = "swatch";
    const typography: BrandAssetRef["kind"] = "typography";
    const graphicStyle: BrandAssetRef["kind"] = "graphic-style";
    const other: BrandAssetRef["kind"] = "other";
    expect([logo, swatch, typography, graphicStyle, other]).toHaveLength(5);
  });
});

describe("PreflightSnapshot (P4)", () => {
  it("rides on DocumentV3 as an optional history list", () => {
    const snapshots: PreflightSnapshot[] = [
      {
        id: "snap-1",
        timestamp: "2026-06-01T10:00:00Z",
        triggeredBy: "user",
        findings: [
          { ruleId: "tac_max", severity: "warn", pageIndex: 0 },
          { ruleId: "rgb_image_detected", severity: "error", pageIndex: 1 },
        ],
      },
      {
        id: "snap-2",
        timestamp: "2026-06-02T11:00:00Z",
        triggeredBy: "export",
        findings: [],
      },
    ];
    const doc: DocumentV3 = {
      version: "3",
      pages: [],
      preflightHistory: snapshots,
    };
    expect(doc.preflightHistory).toHaveLength(2);
    expect(doc.preflightHistory?.[0]?.triggeredBy).toBe("user");
    expect(doc.preflightHistory?.[1]?.findings).toEqual([]);
  });

  it("triggeredBy enumerates the snapshot trigger sources", () => {
    const user: PreflightSnapshot["triggeredBy"] = "user";
    const auto: PreflightSnapshot["triggeredBy"] = "auto";
    const exportT: PreflightSnapshot["triggeredBy"] = "export";
    expect([user, auto, exportT]).toHaveLength(3);
  });

  it("pageIndex is optional — absent for document-scoped findings", () => {
    const docScoped: PreflightSnapshot["findings"][number] = {
      ruleId: "missing_font",
      severity: "error",
    };
    expect(docScoped.pageIndex).toBeUndefined();
  });
});

describe("VariantMatrix.version (V3)", () => {
  it("attaches as an optional matrix-level version stamp", () => {
    const matrix: VariantMatrix = {
      tokenKeys: ["name"],
      variants: [{ id: "v1", name: "first", overrides: { name: "Ada" } }],
      version: "1.2.0",
    };
    expect(matrix.version).toBe("1.2.0");
  });

  it("absent on Wave 2-shaped matrices — preserves backward compat", () => {
    const matrix: VariantMatrix = {
      tokenKeys: ["a"],
      variants: [],
    };
    expect(matrix.version).toBeUndefined();
  });
});

describe("Wave 4 additivity — round-trips preserve identity", () => {
  it("upgradeV2ToV3 still emits a page without annotations", () => {
    const v3 = upgradeV2ToV3({
      version: "2",
      width: 100,
      height: 50,
      unit: "mm",
      separations: [],
      layers: [],
    });
    const page = v3.pages[0];
    expect(page && "annotations" in page).toBe(false);
    expect("brandAssets" in v3).toBe(false);
    expect("preflightHistory" in v3).toBe(false);
  });

  it("a fully-populated Wave 4 DocumentV3 still narrows on version 3", () => {
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
          annotations: [
            { id: "a1", kind: "point", x: 10, y: 10, createdAt: "2026-06-02T00:00:00Z" },
          ],
        },
      ],
      variants: { tokenKeys: [], variants: [], version: "1.0.0" },
      brandAssets: [{ id: "b1", hash: "0".repeat(64), name: "Logo", kind: "logo" }],
      preflightHistory: [
        { id: "h1", timestamp: "2026-06-02T00:00:00Z", triggeredBy: "auto", findings: [] },
      ],
    };
    expect(doc.version).toBe("3");
    expect(doc.pages[0]?.annotations).toHaveLength(1);
    expect(doc.variants?.version).toBe("1.0.0");
    expect(doc.brandAssets).toHaveLength(1);
    expect(doc.preflightHistory).toHaveLength(1);
  });
});

describe("Variant (Wave 2 shape) still compiles unchanged", () => {
  it("does not require a per-variant version field", () => {
    const v: Variant = { id: "v1", name: "Ada", overrides: { name: "Ada Lovelace" } };
    expect(v.id).toBe("v1");
  });
});
