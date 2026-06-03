// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  ApprovedMasterDiffChange,
  ApprovedMasterDiffLoaderFn,
  ApprovedMasterDiffPanelProps,
  AutoLayoutFn,
  AutoLayoutOperation,
  AutoLayoutPanelProps,
  AutoLayoutRequest,
  CopyGenerationFn,
  CopyGenerationPanelProps,
  CopyGenerationRequest,
  CopyGenerationResult,
  DamAsset,
  DamAssetsLoaderFn,
  DamAssetsPanelProps,
  DesignHandoffImportFn,
  DesignHandoffPanelProps,
  DesignHandoffSource,
  EcommerceConnectorPanelProps,
  EcommerceLoaderFn,
  EcommerceProduct,
  ImageGenerationFn,
  ImageGenerationPanelProps,
  ImageGenerationRequest,
  ImageGenerationResult,
  LocalizationExpansion,
  LocalizationPanelProps,
  LocalizationVariant,
  OcrRebuildFn,
  OcrRebuildObject,
  OcrRebuildPanelProps,
  OcrRebuildRequest,
  PimConnectorPanelProps,
  PimField,
  PimLoaderFn,
} from "./wave4-extras";

/**
 * Contract tests for the wave4-extras bundle (Wave 4 long-tail).
 * One describe block per feature pins the adapter / props shape so
 * downstream consumers have a stable contract.
 */

// ── B2 DAM hookup ────────────────────────────────────────────

describe("DamAsset type", () => {
  it("accepts every kind variant", () => {
    const kinds: DamAsset["kind"][] = ["image", "logo", "font", "swatch", "other"];
    for (const kind of kinds) {
      const asset: DamAsset = { id: "a", name: "Asset", kind };
      expect(asset.kind).toBe(kind);
    }
  });

  it("makes url + rights optional", () => {
    const a: DamAsset = { id: "x", name: "X", kind: "image" };
    expect(a.url).toBeUndefined();
    expect(a.rights).toBeUndefined();
  });
});

describe("DamAssetsLoaderFn type", () => {
  it("accepts an optional query and resolves to readonly assets", async () => {
    const loader: DamAssetsLoaderFn = async (q) => [{ id: "a", name: q ?? "all", kind: "image" }];
    const out = await loader("logos");
    expect(out[0]?.name).toBe("logos");
  });
});

describe("DamAssetsPanelProps type", () => {
  it("requires loader; onSelect optional", () => {
    const props: DamAssetsPanelProps = { loader: async () => [] };
    expect(props.onSelect).toBeUndefined();
  });
});

// ── X3 Approved-master diff ──────────────────────────────────

describe("ApprovedMasterDiffChange type", () => {
  it("discriminates kind: text | color | moved | added | removed", () => {
    const kinds: ApprovedMasterDiffChange["kind"][] = [
      "text",
      "color",
      "moved",
      "added",
      "removed",
    ];
    for (const kind of kinds) {
      const c: ApprovedMasterDiffChange = { id: "c", kind, summary: "x" };
      expect(c.kind).toBe(kind);
    }
  });
});

describe("ApprovedMasterDiffLoaderFn type", () => {
  it("resolves to readonly changes", async () => {
    const loader: ApprovedMasterDiffLoaderFn = async () => [
      { id: "c1", kind: "text", summary: "Brand line changed" },
    ];
    const out = await loader();
    expect(out).toHaveLength(1);
  });
});

describe("ApprovedMasterDiffPanelProps type", () => {
  it("requires loader; onSelect optional", () => {
    const props: ApprovedMasterDiffPanelProps = { loader: async () => [] };
    expect(props.onSelect).toBeUndefined();
  });
});

// ── AI1 Copy generation ──────────────────────────────────────

describe("CopyGenerationRequest type", () => {
  it("requires prompt + maxChars; voice optional", () => {
    const req: CopyGenerationRequest = { prompt: "tagline", maxChars: 120 };
    expect(req.voice).toBeUndefined();
    const req2: CopyGenerationRequest = { prompt: "x", maxChars: 60, voice: "playful" };
    expect(req2.voice).toBe("playful");
  });
});

describe("CopyGenerationResult type", () => {
  it("carries text + readonly warnings", () => {
    const r: CopyGenerationResult = { text: "Smile.", warnings: ["claim:health"] };
    expect(r.warnings).toEqual(["claim:health"]);
  });
});

describe("CopyGenerationFn type", () => {
  it("maps request → result", async () => {
    const fn: CopyGenerationFn = async (req) => ({
      text: req.prompt.toUpperCase(),
      warnings: [],
    });
    const r = await fn({ prompt: "go", maxChars: 5 });
    expect(r.text).toBe("GO");
  });
});

describe("CopyGenerationPanelProps type", () => {
  it("requires generator only", () => {
    const props: CopyGenerationPanelProps = { generator: async () => ({ text: "", warnings: [] }) };
    expect(props.initialPrompt).toBeUndefined();
    expect(props.maxChars).toBeUndefined();
  });
});

// ── AI2 Image generation ─────────────────────────────────────

describe("ImageGenerationRequest type", () => {
  it("requires prompt + dims + dpi; cmykProfile optional", () => {
    const req: ImageGenerationRequest = { prompt: "logo", widthMm: 50, heightMm: 50, dpi: 300 };
    expect(req.cmykProfile).toBeUndefined();
    const req2: ImageGenerationRequest = {
      prompt: "x",
      widthMm: 10,
      heightMm: 10,
      dpi: 300,
      cmykProfile: "ISOcoated_v2_eci",
    };
    expect(req2.cmykProfile).toBe("ISOcoated_v2_eci");
  });
});

describe("ImageGenerationResult type", () => {
  it("carries url + pixel dims + provenance", () => {
    const r: ImageGenerationResult = {
      url: "data:image/png;base64,...",
      widthPx: 600,
      heightPx: 600,
      provenance: "ai-generated",
    };
    expect(r.provenance).toBe("ai-generated");
  });
});

describe("ImageGenerationFn type", () => {
  it("resolves a result", async () => {
    const fn: ImageGenerationFn = async (req) => ({
      url: "data:image/png;base64,",
      widthPx: req.widthMm * 12,
      heightPx: req.heightMm * 12,
      provenance: "stub",
    });
    const r = await fn({ prompt: "x", widthMm: 10, heightMm: 10, dpi: 300 });
    expect(r.widthPx).toBe(120);
  });
});

describe("ImageGenerationPanelProps type", () => {
  it("requires generator only", () => {
    const props: ImageGenerationPanelProps = {
      generator: async () => ({ url: "", widthPx: 0, heightPx: 0, provenance: "" }),
    };
    expect(props.defaultWidthMm).toBeUndefined();
  });
});

// ── AI3 Auto-layout ──────────────────────────────────────────

describe("AutoLayoutRequest type", () => {
  it("carries object ids + bleed / anchor flags", () => {
    const req: AutoLayoutRequest = {
      objectIds: ["a", "b"],
      respectBleed: true,
      respectPanelAnchors: false,
    };
    expect(req.respectPanelAnchors).toBe(false);
  });
});

describe("AutoLayoutOperation type", () => {
  it("makes every mutation field optional", () => {
    const op: AutoLayoutOperation = { objectId: "a" };
    expect(op.dx).toBeUndefined();
    expect(op.dy).toBeUndefined();
    expect(op.scale).toBeUndefined();
  });
});

describe("AutoLayoutFn type", () => {
  it("resolves to readonly operations", async () => {
    const fn: AutoLayoutFn = async (req) => req.objectIds.map((id) => ({ objectId: id, dx: 1 }));
    const ops = await fn({ objectIds: ["a", "b"], respectBleed: true, respectPanelAnchors: true });
    expect(ops).toHaveLength(2);
  });
});

describe("AutoLayoutPanelProps type", () => {
  it("requires solver + objectIds", () => {
    const props: AutoLayoutPanelProps = {
      solver: async () => [],
      objectIds: ["a"],
    };
    expect(props.objectIds).toEqual(["a"]);
  });
});

// ── AI5 OCR rebuild ──────────────────────────────────────────

describe("OcrRebuildRequest type", () => {
  it("requires imageB64; language optional", () => {
    const req: OcrRebuildRequest = { imageB64: "..." };
    expect(req.language).toBeUndefined();
  });
});

describe("OcrRebuildObject type", () => {
  it("discriminates every reconstructable kind", () => {
    const kinds: OcrRebuildObject["kind"][] = ["text", "logo", "barcode-placeholder", "panel-rect"];
    for (const kind of kinds) {
      const o: OcrRebuildObject = { id: "o", kind, x: 0, y: 0, widthMm: 10, heightMm: 10 };
      expect(o.kind).toBe(kind);
    }
  });
});

describe("OcrRebuildFn type", () => {
  it("resolves to readonly objects", async () => {
    const fn: OcrRebuildFn = async () => [
      { id: "t", kind: "text", x: 0, y: 0, widthMm: 50, heightMm: 10, text: "BRAND" },
    ];
    expect((await fn({ imageB64: "x" }))[0]?.text).toBe("BRAND");
  });
});

describe("OcrRebuildPanelProps type", () => {
  it("requires ocr only", () => {
    const props: OcrRebuildPanelProps = { ocr: async () => [] };
    expect(props.onObjects).toBeUndefined();
  });
});

// ── V3 Localization ──────────────────────────────────────────

describe("LocalizationVariant type", () => {
  it("maps a BCP-47 tag to per-object texts", () => {
    const v: LocalizationVariant = {
      language: "fr-CA",
      texts: { title: "Bonjour", body: "Salut" },
    };
    expect(Object.keys(v.texts)).toEqual(["title", "body"]);
  });
});

describe("LocalizationExpansion type", () => {
  it("carries ratio for the (language, object) pair", () => {
    const e: LocalizationExpansion = { language: "de", objectId: "title", ratio: 1.35 };
    expect(e.ratio).toBe(1.35);
  });
});

describe("LocalizationPanelProps type", () => {
  it("requires variants; expansions + onSelectVariant optional", () => {
    const props: LocalizationPanelProps = { variants: [] };
    expect(props.expansions).toBeUndefined();
    expect(props.onSelectVariant).toBeUndefined();
  });
});

// ── I1 Design handoff ────────────────────────────────────────

describe("DesignHandoffSource type", () => {
  it("includes the four canonical sources", () => {
    const sources: DesignHandoffSource[] = ["figma", "illustrator", "indesign", "other"];
    expect(sources).toHaveLength(4);
  });
});

describe("DesignHandoffImportFn type", () => {
  it("maps source + fileRef → object count", async () => {
    const fn: DesignHandoffImportFn = async ({ source }) => ({
      objectsImported: source === "figma" ? 5 : 0,
    });
    expect((await fn({ source: "figma", fileRef: "url" })).objectsImported).toBe(5);
  });
});

describe("DesignHandoffPanelProps type", () => {
  it("requires importer only", () => {
    const props: DesignHandoffPanelProps = { importer: async () => ({ objectsImported: 0 }) };
    expect(props.onImported).toBeUndefined();
  });
});

// ── I2 Ecommerce ─────────────────────────────────────────────

describe("EcommerceProduct type", () => {
  it("requires id + title + attrs; gtin / imageUrl optional", () => {
    const p: EcommerceProduct = { id: "1", title: "Tea", attrs: { net: "100g" } };
    expect(p.gtin).toBeUndefined();
    expect(p.attrs.net).toBe("100g");
  });
});

describe("EcommerceLoaderFn type", () => {
  it("resolves to readonly products", async () => {
    const loader: EcommerceLoaderFn = async () => [
      { id: "1", title: "Tea", gtin: "012345678905", attrs: {} },
    ];
    expect((await loader())[0]?.gtin).toBe("012345678905");
  });
});

describe("EcommerceConnectorPanelProps type", () => {
  it("requires loader; onSelect optional", () => {
    const props: EcommerceConnectorPanelProps = { loader: async () => [] };
    expect(props.onSelect).toBeUndefined();
  });
});

// ── I3 PIM connector ─────────────────────────────────────────

describe("PimField type", () => {
  it("carries id + label + value", () => {
    const f: PimField = { id: "weight", label: "Net weight", value: "100g" };
    expect(f.label).toBe("Net weight");
  });
});

describe("PimLoaderFn type", () => {
  it("resolves to readonly fields", async () => {
    const loader: PimLoaderFn = async () => [{ id: "a", label: "A", value: "1" }];
    expect(await loader()).toHaveLength(1);
  });
});

describe("PimConnectorPanelProps type", () => {
  it("requires loader; onBind optional", () => {
    const props: PimConnectorPanelProps = { loader: async () => [] };
    expect(props.onBind).toBeUndefined();
  });
});
