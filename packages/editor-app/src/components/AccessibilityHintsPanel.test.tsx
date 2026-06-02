// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  AccessibilityCategory,
  AccessibilityFinding,
  AccessibilityHintsLoaderFn,
  AccessibilityHintsPanelProps,
  AccessibilitySeverity,
} from "./AccessibilityHintsPanel";
import {
  ACCESSIBILITY_SEVERITY_ORDER,
  filterAccessibilityFindings,
  groupAccessibilityFindingsBySeverity,
} from "./AccessibilityHintsPanel";

/**
 * Contract tests for AccessibilityHintsPanel (Wave 4 AI5).
 *
 * DOM behaviour (loading / error / row click) lands when the editor
 * adopts RTL. These tests pin the wire shape so hosts wiring a loader
 * into the panel have a stable contract.
 */

const LOW_CONTRAST: AccessibilityFinding = {
  id: "f-1",
  category: "contrast",
  severity: "error",
  summary: "Body text contrast 3.2:1 — below WCAG AA minimum",
  recommendation: "Increase fill darkness or pick a lighter background.",
  objectId: "obj-a",
};

const MISSING_ALT: AccessibilityFinding = {
  id: "f-2",
  category: "alt-text",
  severity: "warn",
  summary: "Logo image is missing alt text",
};

const COLOR_ONLY: AccessibilityFinding = {
  id: "f-3",
  category: "color-only",
  severity: "info",
  summary: "Chart legend distinguishes series by color only",
  recommendation: "Add an icon or pattern overlay for color-blind users.",
};

const ALL_FINDINGS: readonly AccessibilityFinding[] = [LOW_CONTRAST, MISSING_ALT, COLOR_ONLY];

describe("AccessibilityFinding type", () => {
  it("requires id, category, severity, summary", () => {
    expect(LOW_CONTRAST.id).toBe("f-1");
    expect(LOW_CONTRAST.category).toBe("contrast");
    expect(LOW_CONTRAST.severity).toBe("error");
    expect(LOW_CONTRAST.summary).toBe("Body text contrast 3.2:1 — below WCAG AA minimum");
  });

  it("treats recommendation + objectId as optional", () => {
    expect(MISSING_ALT.recommendation).toBeUndefined();
    expect(MISSING_ALT.objectId).toBeUndefined();
    expect(LOW_CONTRAST.recommendation).toBeDefined();
    expect(LOW_CONTRAST.objectId).toBe("obj-a");
  });

  it("enumerates the three severity tiers", () => {
    const error: AccessibilitySeverity = "error";
    const warn: AccessibilitySeverity = "warn";
    const info: AccessibilitySeverity = "info";
    expect([error, warn, info]).toHaveLength(3);
  });

  it("enumerates the six category buckets", () => {
    const cats: AccessibilityCategory[] = [
      "contrast",
      "alt-text",
      "text-size",
      "color-only",
      "structure",
      "other",
    ];
    expect(cats).toHaveLength(6);
  });
});

describe("ACCESSIBILITY_SEVERITY_ORDER", () => {
  it("surfaces errors first, then warnings, then info", () => {
    expect(ACCESSIBILITY_SEVERITY_ORDER).toEqual(["error", "warn", "info"]);
  });
});

describe("AccessibilityHintsPanelProps type", () => {
  it("requires loader; everything else optional", () => {
    const loader: AccessibilityHintsLoaderFn = async () => [];
    const props: AccessibilityHintsPanelProps = { loader };
    expect(props.loader).toBe(loader);
    expect(props.filterSeverity).toBeUndefined();
    expect(props.filterCategory).toBeUndefined();
    expect(props.activeFindingId).toBeUndefined();
    expect(props.onSelect).toBeUndefined();
  });

  it("accepts filters + activeFindingId + onSelect", () => {
    let lastSelected: AccessibilityFinding | undefined;
    const props: AccessibilityHintsPanelProps = {
      loader: async () => ALL_FINDINGS,
      filterSeverity: "error",
      filterCategory: "contrast",
      activeFindingId: "f-1",
      onSelect: (f) => {
        lastSelected = f;
      },
    };
    props.onSelect?.(LOW_CONTRAST);
    expect(lastSelected?.id).toBe("f-1");
    expect(props.filterSeverity).toBe("error");
    expect(props.filterCategory).toBe("contrast");
    expect(props.activeFindingId).toBe("f-1");
  });
});

describe("filterAccessibilityFindings", () => {
  it("returns the whole list when no filters are set", () => {
    expect(filterAccessibilityFindings(ALL_FINDINGS, {})).toHaveLength(3);
  });

  it("filters by severity exactly", () => {
    const filtered = filterAccessibilityFindings(ALL_FINDINGS, { severity: "error" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("f-1");
  });

  it("filters by category exactly", () => {
    const filtered = filterAccessibilityFindings(ALL_FINDINGS, { category: "alt-text" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("f-2");
  });

  it("combines severity + category (AND)", () => {
    const filtered = filterAccessibilityFindings(ALL_FINDINGS, {
      severity: "error",
      category: "contrast",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("f-1");
  });

  it("returns empty when no finding matches", () => {
    const filtered = filterAccessibilityFindings(ALL_FINDINGS, {
      severity: "error",
      category: "alt-text",
    });
    expect(filtered).toEqual([]);
  });

  it("preserves input order", () => {
    const filtered = filterAccessibilityFindings(ALL_FINDINGS, {});
    expect(filtered.map((f) => f.id)).toEqual(["f-1", "f-2", "f-3"]);
  });
});

describe("groupAccessibilityFindingsBySeverity", () => {
  it("groups findings by severity in canonical order", () => {
    const groups = groupAccessibilityFindingsBySeverity(ALL_FINDINGS);
    expect(groups.map((g) => g.severity)).toEqual(["error", "warn", "info"]);
    expect(groups[0]?.findings).toHaveLength(1);
    expect(groups[1]?.findings).toHaveLength(1);
    expect(groups[2]?.findings).toHaveLength(1);
    expect(groups[0]?.findings[0]?.id).toBe("f-1");
    expect(groups[1]?.findings[0]?.id).toBe("f-2");
    expect(groups[2]?.findings[0]?.id).toBe("f-3");
  });

  it("returns three buckets even for an empty input (stable shape)", () => {
    const groups = groupAccessibilityFindingsBySeverity([]);
    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.findings.length === 0)).toBe(true);
  });

  it("preserves intra-bucket input order when multiple findings share a severity", () => {
    const extra: AccessibilityFinding = {
      id: "f-4",
      category: "text-size",
      severity: "error",
      summary: "Small caption text below 7pt minimum",
    };
    const groups = groupAccessibilityFindingsBySeverity([LOW_CONTRAST, extra]);
    const errorBucket = groups.find((g) => g.severity === "error");
    expect(errorBucket?.findings.map((f) => f.id)).toEqual(["f-1", "f-4"]);
  });
});
