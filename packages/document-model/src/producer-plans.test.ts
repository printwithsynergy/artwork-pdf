// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { ImposeTemplate, JobSubmitRequest, MarksPlan, PageV3, TrapPolicy } from "./index.js";
import { ensureV3, upgradeV2ToV3 } from "./migrate.js";

describe("producer-plan types", () => {
  it("MarksPlan accepts any subset of corner-mark flags", () => {
    const empty: MarksPlan = {};
    const full: MarksPlan = { registration: true, trim: true, bleed: true, colorBars: true };
    const partial: MarksPlan = { trim: true };
    expect(empty).toBeDefined();
    expect(full.registration).toBe(true);
    expect(partial.bleed).toBeUndefined();
  });

  it("TrapPolicy requires widthMm; mode is optional", () => {
    const minimal: TrapPolicy = { widthMm: 0.1 };
    const full: TrapPolicy = { widthMm: 0.2, mode: "spread" };
    expect(minimal.mode).toBeUndefined();
    expect(full.mode).toBe("spread");
  });

  it("ImposeTemplate carries sheet + grid + pageMapping", () => {
    const tpl: ImposeTemplate = {
      sheetWidth: 1684,
      sheetHeight: 2384,
      rows: 3,
      cols: 3,
      pageMapping: "repeat",
    };
    expect(tpl.cols).toBe(3);
    expect(tpl.pageMapping).toBe("repeat");
  });
});

describe("JobSubmitRequest — producer-field additions", () => {
  function baseReq(): JobSubmitRequest {
    return {
      document: {
        version: "2",
        width: 100,
        height: 50,
        unit: "mm",
        separations: [],
        layers: [],
      },
      output: { format: "pdf-x4" },
    };
  }

  it("accepts a request with no producer fields (backward-compat)", () => {
    const req = baseReq();
    expect(req.marksTemplate).toBeUndefined();
    expect(req.trapPolicy).toBeUndefined();
    expect(req.imposeTemplate).toBeUndefined();
    expect(req.separationsOverride).toBeUndefined();
  });

  it("accepts a request with all producer fields populated", () => {
    const req: JobSubmitRequest = {
      ...baseReq(),
      marksTemplate: { trim: true, bleed: true },
      trapPolicy: { widthMm: 0.1, mode: "auto" },
      imposeTemplate: { sheetWidth: 1684, sheetHeight: 2384, rows: 2, cols: 2 },
      separationsOverride: [
        { name: "PANTONE 185 C", colorSpace: "Spot", pantone: "PANTONE 185 C" },
      ],
    };
    expect(req.marksTemplate?.trim).toBe(true);
    expect(req.trapPolicy?.widthMm).toBe(0.1);
    expect(req.imposeTemplate?.cols).toBe(2);
    expect(req.separationsOverride?.[0]?.pantone).toBe("PANTONE 185 C");
  });
});

describe("PageV3.trapConfig", () => {
  it("is optional — absent on v3 pages produced by upgradeV2ToV3", () => {
    const v3 = upgradeV2ToV3({
      version: "2",
      width: 100,
      height: 50,
      unit: "mm",
      separations: [],
      layers: [],
    });
    expect(v3.pages[0] && "trapConfig" in v3.pages[0]).toBe(false);
  });

  it("survives ensureV3 idempotency on a v3 doc that already carries it", () => {
    const page: PageV3 = {
      id: "p1",
      width: 100,
      height: 50,
      unit: "mm",
      bleedMm: 3,
      separations: [],
      layers: [],
      trapConfig: { widthMm: 0.15, mode: "choke" },
    };
    const v3 = { version: "3" as const, pages: [page] };
    const out = ensureV3(v3);
    // Identity passthrough — same reference, trapConfig preserved.
    expect(out).toBe(v3);
    expect(out.pages[0]?.trapConfig).toEqual({ widthMm: 0.15, mode: "choke" });
  });
});
