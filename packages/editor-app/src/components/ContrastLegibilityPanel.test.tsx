// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  CONTRAST_LEGIBILITY_SEVERITY_ORDER,
  type ContrastLegibilityFilter,
  type ContrastLegibilityFinding,
  type ContrastLegibilityLoaderFn,
  type ContrastLegibilityPanelProps,
  filterContrastLegibilityFindings,
  groupContrastLegibilityFindingsBySeverity,
} from "./ContrastLegibilityPanel";

const FINDINGS: ContrastLegibilityFinding[] = [
  {
    id: "e1",
    category: "contrast",
    severity: "error",
    summary: "Black on dark kraft fails",
    deltaE: 4.2,
  },
  { id: "w1", category: "text-size", severity: "warn", summary: "Reverse text below 6pt" },
  {
    id: "i1",
    category: "neutral-density",
    severity: "info",
    summary: "Density borderline",
    deltaE: 2.8,
  },
  { id: "w2", category: "reverse-on-image", severity: "warn", summary: "Reverse on busy image" },
];

describe("CONTRAST_LEGIBILITY_SEVERITY_ORDER", () => {
  it("puts error before warn before info", () => {
    expect(CONTRAST_LEGIBILITY_SEVERITY_ORDER).toEqual(["error", "warn", "info"]);
  });
});

describe("filterContrastLegibilityFindings", () => {
  it("returns all findings when filter is empty", () => {
    expect(filterContrastLegibilityFindings(FINDINGS, {})).toHaveLength(4);
  });

  it("filters by severity", () => {
    const out = filterContrastLegibilityFindings(FINDINGS, { severity: "warn" });
    expect(out).toHaveLength(2);
    expect(out.every((f) => f.severity === "warn")).toBe(true);
  });

  it("filters by category", () => {
    const out = filterContrastLegibilityFindings(FINDINGS, { category: "contrast" });
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("e1");
  });

  it("filters by severity + category together", () => {
    const filter: ContrastLegibilityFilter = { severity: "warn", category: "text-size" };
    const out = filterContrastLegibilityFindings(FINDINGS, filter);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("w1");
  });

  it("preserves input order", () => {
    const out = filterContrastLegibilityFindings(FINDINGS, { severity: "warn" });
    expect(out.map((f) => f.id)).toEqual(["w1", "w2"]);
  });
});

describe("groupContrastLegibilityFindingsBySeverity", () => {
  it("always returns a stable three-bucket shape", () => {
    const groups = groupContrastLegibilityFindingsBySeverity([]);
    expect(groups.map((g) => g.severity)).toEqual(["error", "warn", "info"]);
    expect(groups.every((g) => g.findings.length === 0)).toBe(true);
  });

  it("buckets findings by severity in canonical order", () => {
    const groups = groupContrastLegibilityFindingsBySeverity(FINDINGS);
    expect(groups[0]?.findings).toHaveLength(1);
    expect(groups[1]?.findings).toHaveLength(2);
    expect(groups[2]?.findings).toHaveLength(1);
  });
});

describe("ContrastLegibilityLoaderFn type", () => {
  it("resolves to readonly findings", async () => {
    const loader: ContrastLegibilityLoaderFn = async () => FINDINGS;
    expect(await loader()).toHaveLength(4);
  });
});

describe("ContrastLegibilityPanelProps type", () => {
  it("requires only the loader", () => {
    const props: ContrastLegibilityPanelProps = { loader: async () => [] };
    expect(props.filterSeverity).toBeUndefined();
    expect(props.filterCategory).toBeUndefined();
    expect(props.onSelect).toBeUndefined();
  });

  it("accepts filter + select callback", () => {
    let picked: ContrastLegibilityFinding | null = null;
    const props: ContrastLegibilityPanelProps = {
      loader: async () => FINDINGS,
      filterSeverity: "error",
      filterCategory: "contrast",
      onSelect: (f) => {
        picked = f;
      },
    };
    expect(props.filterSeverity).toBe("error");
    props.onSelect?.(FINDINGS[0] as ContrastLegibilityFinding);
    expect(picked).toEqual(FINDINGS[0]);
  });
});
