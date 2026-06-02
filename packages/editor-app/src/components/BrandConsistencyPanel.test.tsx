// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  BrandConsistencyFinding,
  BrandConsistencyLoaderFn,
  BrandConsistencyPanelProps,
  BrandConsistencySeverity,
} from "./BrandConsistencyPanel";
import {
  BRAND_CONSISTENCY_SEVERITY_ORDER,
  filterBrandConsistencyFindings,
  groupBrandConsistencyFindingsBySeverity,
} from "./BrandConsistencyPanel";

/**
 * Contract tests for BrandConsistencyPanel (Wave 4 B2).
 *
 * DOM behaviour (loading / error / row click) lands when the editor
 * adopts RTL. These tests pin the wire shape so hosts wiring a
 * loader into the panel have a stable contract.
 */

const LOGO_TOO_SMALL: BrandConsistencyFinding = {
  id: "f-1",
  brandAssetId: "logo-primary",
  assetKind: "logo",
  severity: "error",
  summary: "Logo placed below minimum size",
  description: "Primary logo is 8mm wide; brand kit requires ≥12mm.",
  objectId: "obj-a",
};

const SWATCH_DRIFT: BrandConsistencyFinding = {
  id: "f-2",
  brandAssetId: "swatch-brand-blue",
  assetKind: "swatch",
  severity: "warn",
  summary: "Fill color outside brand swatch tolerance",
};

const TYPE_INFO: BrandConsistencyFinding = {
  id: "f-3",
  brandAssetId: "type-headline",
  assetKind: "typography",
  severity: "info",
  summary: "Typography pairing matches secondary brand kit",
};

const ALL_FINDINGS: readonly BrandConsistencyFinding[] = [LOGO_TOO_SMALL, SWATCH_DRIFT, TYPE_INFO];

describe("BrandConsistencyFinding type", () => {
  it("requires id, brandAssetId, assetKind, severity, summary", () => {
    expect(LOGO_TOO_SMALL.id).toBe("f-1");
    expect(LOGO_TOO_SMALL.brandAssetId).toBe("logo-primary");
    expect(LOGO_TOO_SMALL.assetKind).toBe("logo");
    expect(LOGO_TOO_SMALL.severity).toBe("error");
    expect(LOGO_TOO_SMALL.summary).toBe("Logo placed below minimum size");
  });

  it("treats description + objectId as optional", () => {
    expect(SWATCH_DRIFT.description).toBeUndefined();
    expect(SWATCH_DRIFT.objectId).toBeUndefined();
    expect(LOGO_TOO_SMALL.description).toBeDefined();
    expect(LOGO_TOO_SMALL.objectId).toBe("obj-a");
  });

  it("enumerates the three severity tiers", () => {
    const error: BrandConsistencySeverity = "error";
    const warn: BrandConsistencySeverity = "warn";
    const info: BrandConsistencySeverity = "info";
    expect([error, warn, info]).toHaveLength(3);
  });
});

describe("BRAND_CONSISTENCY_SEVERITY_ORDER", () => {
  it("surfaces errors first, then warnings, then info", () => {
    expect(BRAND_CONSISTENCY_SEVERITY_ORDER).toEqual(["error", "warn", "info"]);
  });
});

describe("BrandConsistencyPanelProps type", () => {
  it("requires loader; everything else optional", () => {
    const loader: BrandConsistencyLoaderFn = async () => [];
    const props: BrandConsistencyPanelProps = { loader };
    expect(props.loader).toBe(loader);
    expect(props.filterSeverity).toBeUndefined();
    expect(props.filterAssetKind).toBeUndefined();
    expect(props.activeFindingId).toBeUndefined();
    expect(props.onSelect).toBeUndefined();
  });

  it("accepts filters + activeFindingId + onSelect", () => {
    let lastSelected: BrandConsistencyFinding | undefined;
    const props: BrandConsistencyPanelProps = {
      loader: async () => ALL_FINDINGS,
      filterSeverity: "error",
      filterAssetKind: "logo",
      activeFindingId: "f-1",
      onSelect: (f) => {
        lastSelected = f;
      },
    };
    props.onSelect?.(LOGO_TOO_SMALL);
    expect(lastSelected?.id).toBe("f-1");
    expect(props.filterSeverity).toBe("error");
    expect(props.filterAssetKind).toBe("logo");
    expect(props.activeFindingId).toBe("f-1");
  });
});

describe("filterBrandConsistencyFindings", () => {
  it("returns the whole list when no filters are set", () => {
    expect(filterBrandConsistencyFindings(ALL_FINDINGS, {})).toHaveLength(3);
  });

  it("filters by severity exactly", () => {
    const filtered = filterBrandConsistencyFindings(ALL_FINDINGS, { severity: "error" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("f-1");
  });

  it("filters by asset kind exactly", () => {
    const filtered = filterBrandConsistencyFindings(ALL_FINDINGS, { assetKind: "swatch" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("f-2");
  });

  it("combines severity + assetKind (AND)", () => {
    const filtered = filterBrandConsistencyFindings(ALL_FINDINGS, {
      severity: "error",
      assetKind: "logo",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("f-1");
  });

  it("returns empty when no finding matches", () => {
    const filtered = filterBrandConsistencyFindings(ALL_FINDINGS, {
      severity: "error",
      assetKind: "typography",
    });
    expect(filtered).toEqual([]);
  });

  it("preserves input order", () => {
    const filtered = filterBrandConsistencyFindings(ALL_FINDINGS, {});
    expect(filtered.map((f) => f.id)).toEqual(["f-1", "f-2", "f-3"]);
  });
});

describe("groupBrandConsistencyFindingsBySeverity", () => {
  it("groups findings by severity in canonical order", () => {
    const groups = groupBrandConsistencyFindingsBySeverity(ALL_FINDINGS);
    expect(groups.map((g) => g.severity)).toEqual(["error", "warn", "info"]);
    expect(groups[0]?.findings).toHaveLength(1);
    expect(groups[1]?.findings).toHaveLength(1);
    expect(groups[2]?.findings).toHaveLength(1);
    expect(groups[0]?.findings[0]?.id).toBe("f-1");
    expect(groups[1]?.findings[0]?.id).toBe("f-2");
    expect(groups[2]?.findings[0]?.id).toBe("f-3");
  });

  it("returns three buckets even for an empty input (stable shape)", () => {
    const groups = groupBrandConsistencyFindingsBySeverity([]);
    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.findings.length === 0)).toBe(true);
  });

  it("preserves intra-bucket input order when multiple findings share a severity", () => {
    const extra: BrandConsistencyFinding = {
      id: "f-4",
      brandAssetId: "logo-secondary",
      assetKind: "logo",
      severity: "error",
      summary: "Secondary logo missing required clearspace",
    };
    const groups = groupBrandConsistencyFindingsBySeverity([LOGO_TOO_SMALL, extra]);
    const errorBucket = groups.find((g) => g.severity === "error");
    expect(errorBucket?.findings.map((f) => f.id)).toEqual(["f-1", "f-4"]);
  });
});
