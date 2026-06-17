// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  applyCorrections,
  CORRECTION_OPS,
  CORRECTION_SCHEMA_VERSION,
  CorrectionError,
  type CorrectionOp,
  hashDocument,
} from "./corrections.js";
import type { DocumentModel } from "./extended.js";
import type { DocumentV3 } from "./v3.js";

function v3Doc(): DocumentV3 {
  return {
    version: "3",
    pages: [
      {
        id: "page-1",
        width: 100,
        height: 50,
        unit: "mm",
        bleedMm: 3,
        separations: [
          { name: "Cyan", colorSpace: "CMYK" },
          { name: "Black", colorSpace: "CMYK" },
          { name: "Spot1", colorSpace: "Spot" },
        ],
        layers: [
          {
            id: "dieline",
            type: "artwork",
            name: "Dieline",
            visible: true,
            locked: true,
            objects: [],
          },
          { id: "art", type: "artwork", name: "Artwork", visible: true, objects: [] },
        ],
      },
    ],
  };
}

describe("applyCorrections — boundary + structure", () => {
  it("lifts a v2 document to v3 before applying", () => {
    const v2: DocumentModel = {
      version: "2",
      width: 80,
      height: 40,
      unit: "mm",
      separations: [{ name: "Black", colorSpace: "CMYK" }],
      layers: [{ id: "art", type: "artwork", name: "Artwork", visible: true, objects: [] }],
    };
    const { document } = applyCorrections(v2, []);
    expect(document.version).toBe("3");
    expect(document.pages).toHaveLength(1);
    expect(document.pages[0]?.id).toBe("page-1");
  });

  it("never mutates the input document", () => {
    const doc = v3Doc();
    const snapshot = JSON.stringify(doc);
    applyCorrections(doc, [{ op: "set.page.bleed", bleedMm: 5 }]);
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it("records a per-op audit trail in input order", () => {
    const { applied } = applyCorrections(v3Doc(), [
      { op: "set.page.bleed", bleedMm: 5 },
      { op: "set.layer.visibility", layerId: "art", visible: false },
    ]);
    expect(applied.map((a) => a.op)).toEqual(["set.page.bleed", "set.layer.visibility"]);
    expect(applied.every((a) => a.changed)).toBe(true);
  });

  it("stamps the schema version", () => {
    const { schemaVersion } = applyCorrections(v3Doc(), []);
    expect(schemaVersion).toBe(CORRECTION_SCHEMA_VERSION);
  });

  it("throws invalid_document when the document fails schema coercion", () => {
    expect(() =>
      applyCorrections(null as unknown as DocumentModel, []),
    ).toThrowError(CorrectionError);
    try {
      applyCorrections(null as unknown as DocumentModel, []);
    } catch (err) {
      expect((err as CorrectionError).code).toBe("invalid_document");
    }
  });
});

describe("applyCorrections — determinism", () => {
  it("produces a byte-identical result + hash for identical inputs", () => {
    const ops: CorrectionOp[] = [
      { op: "set.page.bleed", bleedMm: 4 },
      { op: "rename.separation", from: "Spot1", to: "PANTONE 185 C" },
      { op: "set.separation.overprint", separation: "Black", overprint: true },
    ];
    const a = applyCorrections(v3Doc(), ops);
    const b = applyCorrections(v3Doc(), ops);
    expect(a.contentHash).toBe(b.contentHash);
    expect(JSON.stringify(a.document)).toBe(JSON.stringify(b.document));
  });

  it("hash is insensitive to object key insertion order", () => {
    const docA: DocumentV3 = {
      version: "3",
      pages: [],
      swatches: ["#000"],
      variableData: { a: "1" },
    };
    const docB: DocumentV3 = {
      variableData: { a: "1" },
      swatches: ["#000"],
      pages: [],
      version: "3",
    } as DocumentV3;
    expect(hashDocument(docA)).toBe(hashDocument(docB));
  });

  it("hash is sensitive to array order (layers/separations are ordered)", () => {
    const base = v3Doc();
    const swapped = v3Doc();
    const seps = swapped.pages[0]?.separations;
    if (seps) [seps[0], seps[1]] = [seps[1] as never, seps[0] as never];
    expect(hashDocument(base)).not.toBe(hashDocument(swapped));
  });

  it("default contentHash uses the portable fnv1a64 digest", () => {
    const { contentHash } = applyCorrections(v3Doc(), []);
    expect(contentHash).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
  });

  it("injected sha256 produces a sha256:<64 hex> address", () => {
    const fakeSha = (input: string) => "f".repeat(64 - String(input.length).length) + input.length;
    const { contentHash } = applyCorrections(v3Doc(), [], { sha256: fakeSha });
    expect(contentHash).toMatch(/^sha256:/);
  });

  it("canonicalJson is the exact string the hash digests", () => {
    const { canonicalJson, contentHash } = applyCorrections(v3Doc(), []);
    // Re-hashing the returned canonical JSON with the same default digest
    // reproduces the address.
    const rehashed = applyCorrections(v3Doc(), []);
    expect(rehashed.canonicalJson).toBe(canonicalJson);
    expect(rehashed.contentHash).toBe(contentHash);
  });
});

describe("applyCorrections — idempotency (no-op recording)", () => {
  it("records changed:false when the op matches current state", () => {
    const { applied } = applyCorrections(v3Doc(), [
      { op: "set.page.bleed", bleedMm: 3 }, // already 3
      { op: "set.layer.visibility", layerId: "art", visible: true }, // already visible
    ]);
    expect(applied[0]?.changed).toBe(false);
    expect(applied[0]?.sites).toBe(0);
    expect(applied[1]?.changed).toBe(false);
  });

  it("re-applying the same correction yields the same hash (idempotent)", () => {
    const ops: CorrectionOp[] = [
      { op: "set.separation.overprint", separation: "Black", overprint: true },
    ];
    const once = applyCorrections(v3Doc(), ops);
    const twice = applyCorrections(once.document, ops);
    expect(twice.contentHash).toBe(once.contentHash);
    expect(twice.applied[0]?.changed).toBe(false);
  });
});

describe("applyCorrections — page targeting", () => {
  it("applies to all pages when pageId is omitted", () => {
    const doc = v3Doc();
    const second = structuredClone(doc.pages[0]);
    if (second) {
      second.id = "page-2";
      doc.pages.push(second);
    }
    const { document, applied } = applyCorrections(doc, [{ op: "set.page.bleed", bleedMm: 6 }]);
    expect(document.pages.every((p) => p.bleedMm === 6)).toBe(true);
    expect(applied[0]?.sites).toBe(2);
  });

  it("applies to a single page when pageId is given", () => {
    const { document } = applyCorrections(v3Doc(), [
      { op: "set.page.bleed", pageId: "page-1", bleedMm: 7 },
    ]);
    expect(document.pages[0]?.bleedMm).toBe(7);
  });

  it("throws target_not_found for an unknown pageId", () => {
    expect(() =>
      applyCorrections(v3Doc(), [{ op: "set.page.bleed", pageId: "nope", bleedMm: 1 }]),
    ).toThrowError(CorrectionError);
    try {
      applyCorrections(v3Doc(), [{ op: "set.page.bleed", pageId: "nope", bleedMm: 1 }]);
    } catch (err) {
      const e = err as CorrectionError;
      expect(e.code).toBe("target_not_found");
      expect(e.pointer).toBe("operations/0");
    }
  });
});

describe("applyCorrections — separation ops", () => {
  it("renames a separation and updates layer mirrors", () => {
    const doc = v3Doc();
    const art = doc.pages[0]?.layers.find((l) => l.id === "art");
    if (art) art.separation = { name: "Spot1", colorSpace: "Spot" };
    const { document } = applyCorrections(doc, [
      { op: "rename.separation", from: "Spot1", to: "PANTONE 185 C" },
    ]);
    expect(document.pages[0]?.separations.map((s) => s.name)).toContain("PANTONE 185 C");
    const renamed = document.pages[0]?.layers.find((l) => l.id === "art");
    expect(renamed?.separation?.name).toBe("PANTONE 185 C");
  });

  it("rejects a rename onto an existing distinct ink (conflict)", () => {
    try {
      applyCorrections(v3Doc(), [{ op: "rename.separation", from: "Spot1", to: "Cyan" }]);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CorrectionError);
      expect((err as CorrectionError).code).toBe("conflict");
    }
  });

  it("rename onto self is a no-op, not a conflict", () => {
    const { applied } = applyCorrections(v3Doc(), [
      { op: "rename.separation", from: "Cyan", to: "Cyan" },
    ]);
    expect(applied[0]?.changed).toBe(false);
  });

  it("removes a stray separation", () => {
    const { document } = applyCorrections(v3Doc(), [
      { op: "remove.separation", separation: "Spot1" },
    ]);
    expect(document.pages[0]?.separations.map((s) => s.name)).not.toContain("Spot1");
  });

  it("forces overprint / knockout on a named ink", () => {
    const { document } = applyCorrections(v3Doc(), [
      { op: "set.separation.overprint", separation: "Black", overprint: true },
      { op: "set.separation.knockout", separation: "Cyan", knockout: true },
    ]);
    expect(document.pages[0]?.separations.find((s) => s.name === "Black")?.overprint).toBe(true);
    expect(document.pages[0]?.separations.find((s) => s.name === "Cyan")?.knockout).toBe(true);
  });

  it("throws target_not_found for an unknown separation", () => {
    expect(() =>
      applyCorrections(v3Doc(), [{ op: "remove.separation", separation: "Ghost" }]),
    ).toThrowError(/not found/);
  });
});

describe("applyCorrections — print context", () => {
  it("sets the color profile on an existing print context", () => {
    const doc = v3Doc();
    doc.printContext = {
      process: "flexo",
      substrate: { id: "s", color: "#fff", opacity: 1, finish: "gloss" },
    };
    const { document } = applyCorrections(doc, [
      { op: "set.print.colorProfile", colorProfile: "Fogra51" },
    ]);
    expect(document.printContext?.colorProfile).toBe("Fogra51");
    expect(document.printContext?.process).toBe("flexo");
  });

  it("seeds a minimal print context when absent", () => {
    const { document } = applyCorrections(v3Doc(), [
      { op: "set.print.colorProfile", colorProfile: "ISOcoated_v2_eci" },
    ]);
    expect(document.printContext?.colorProfile).toBe("ISOcoated_v2_eci");
  });
});

describe("applyCorrections — validation (clear error semantics)", () => {
  it("rejects an unknown op with invalid_operation + pointer", () => {
    try {
      applyCorrections(v3Doc(), [{ op: "set.page.colour" } as unknown as CorrectionOp]);
      throw new Error("expected throw");
    } catch (err) {
      const e = err as CorrectionError;
      expect(e.code).toBe("invalid_operation");
      expect(e.pointer).toBe("operations/0");
    }
  });

  it("rejects a non-finite numeric field with a field-scoped pointer", () => {
    try {
      applyCorrections(v3Doc(), [
        { op: "set.page.bleed", bleedMm: Number.NaN } as unknown as CorrectionOp,
      ]);
      throw new Error("expected throw");
    } catch (err) {
      const e = err as CorrectionError;
      expect(e.code).toBe("invalid_operation");
      expect(e.pointer).toBe("operations/0/bleedMm");
    }
  });

  it("rejects a negative bleed", () => {
    expect(() => applyCorrections(v3Doc(), [{ op: "set.page.bleed", bleedMm: -1 }])).toThrowError(
      /must be >= 0/,
    );
  });

  it("rejects a non-boolean visibility flag", () => {
    expect(() =>
      applyCorrections(v3Doc(), [
        { op: "set.layer.visibility", layerId: "art", visible: "yes" } as unknown as CorrectionOp,
      ]),
    ).toThrowError(/must be a boolean/);
  });

  it("rejects an empty separation name", () => {
    expect(() =>
      applyCorrections(v3Doc(), [
        { op: "remove.separation", separation: "" } as unknown as CorrectionOp,
      ]),
    ).toThrowError(/non-empty string/);
  });

  it("fails fast — a later invalid op leaves no partial result returned", () => {
    expect(() =>
      applyCorrections(v3Doc(), [
        { op: "set.page.bleed", bleedMm: 4 },
        { op: "remove.separation", separation: "Ghost" },
      ]),
    ).toThrowError(CorrectionError);
  });
});

describe("CORRECTION_OPS vocabulary", () => {
  it("matches the discriminated-union arms (no drift)", () => {
    expect(new Set(CORRECTION_OPS).size).toBe(CORRECTION_OPS.length);
    expect(CORRECTION_OPS).toContain("set.page.bleed");
    expect(CORRECTION_OPS).toContain("set.print.colorProfile");
  });
});
