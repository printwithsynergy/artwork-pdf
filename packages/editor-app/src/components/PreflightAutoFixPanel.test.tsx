// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  PreflightAutoFixPanelProps,
  PreflightFixLoaderFn,
  PreflightFixSet,
  PreflightFixSuggestion,
} from "./PreflightAutoFixPanel";
import { findingKey, indexFixSetsByFinding } from "./PreflightAutoFixPanel";
import type { PreflightFinding } from "./PreflightDiffPanel";

/**
 * Contract tests for PreflightAutoFixPanel (Wave 4 AI3).
 *
 * DOM behaviour (loading state, error rendering, apply-button click)
 * lands when the editor adopts RTL. These tests pin the wire shape
 * so a host wiring an AI / rules-engine `preflight.fix` adapter (or
 * the synergy `preflight.fix` workflow node) has a stable contract,
 * plus the two pure helpers downstream renderers can reuse.
 */

const F_LOW_TAC: PreflightFinding = {
  ruleId: "tac_coated_max",
  severity: "error",
  pageIndex: 0,
};
const F_FONT: PreflightFinding = {
  ruleId: "font_not_embedded",
  severity: "warn",
};

describe("findingKey", () => {
  it("includes ruleId + severity + pageIndex", () => {
    expect(findingKey(F_LOW_TAC)).toBe("tac_coated_max|error|0");
  });

  it("uses '-' for absent pageIndex so document-level findings still hash", () => {
    expect(findingKey(F_FONT)).toBe("font_not_embedded|warn|-");
  });

  it("disambiguates severity changes — error vs warn produces different keys", () => {
    expect(findingKey({ ruleId: "x", severity: "error" })).not.toBe(
      findingKey({ ruleId: "x", severity: "warn" }),
    );
  });
});

describe("indexFixSetsByFinding", () => {
  it("returns an empty map for an empty input", () => {
    expect(indexFixSetsByFinding([]).size).toBe(0);
  });

  it("maps findingKey → suggestions, last-writer-wins on duplicate keys", () => {
    const s1: PreflightFixSuggestion = { id: "a", summary: "First" };
    const s2: PreflightFixSuggestion = { id: "b", summary: "Second" };
    const sets: PreflightFixSet[] = [
      { findingKey: "k1", suggestions: [s1] },
      { findingKey: "k1", suggestions: [s2] },
      { findingKey: "k2", suggestions: [] },
    ];
    const idx = indexFixSetsByFinding(sets);
    expect(idx.size).toBe(2);
    expect(idx.get("k1")?.[0]?.id).toBe("b");
    expect(idx.get("k2")).toHaveLength(0);
  });
});

describe("PreflightFixLoaderFn type", () => {
  it("is an async function from findings → fix sets", async () => {
    const loader: PreflightFixLoaderFn = async (findings) => {
      return findings.map((f) => ({
        findingKey: findingKey(f),
        suggestions: [{ id: `fix-${f.ruleId}`, summary: `Fix ${f.ruleId}` }],
      }));
    };
    const out = await loader([F_LOW_TAC]);
    expect(out).toHaveLength(1);
    expect(out[0]?.suggestions[0]?.summary).toBe("Fix tac_coated_max");
  });
});

describe("PreflightAutoFixPanelProps type", () => {
  it("requires findings + loader; onApply + activeFindingKey optional", () => {
    const props: PreflightAutoFixPanelProps = {
      findings: [F_LOW_TAC],
      loader: async () => [],
    };
    expect(props.onApply).toBeUndefined();
    expect(props.activeFindingKey).toBeUndefined();
  });

  it("accepts onApply + activeFindingKey", () => {
    let lastSuggestionId: string | undefined;
    let lastFindingKey: string | undefined;
    const props: PreflightAutoFixPanelProps = {
      findings: [F_LOW_TAC, F_FONT],
      loader: async () => [],
      onApply: (s, f) => {
        lastSuggestionId = s.id;
        lastFindingKey = findingKey(f);
      },
      activeFindingKey: findingKey(F_LOW_TAC),
    };
    const suggestion: PreflightFixSuggestion = {
      id: "fix-1",
      summary: "Try B=100 K=100",
      description: "Reduces TAC from 320% to 200%.",
      applyHint: { kind: "swap-fill", from: "#000", to: { c: 0, m: 0, y: 0, k: 100, b: 100 } },
    };
    props.onApply?.(suggestion, F_LOW_TAC);
    expect(lastSuggestionId).toBe("fix-1");
    expect(lastFindingKey).toBe(findingKey(F_LOW_TAC));
    expect(props.activeFindingKey).toBe(findingKey(F_LOW_TAC));
  });
});

describe("PreflightFixSuggestion type", () => {
  it("requires id + summary; description + applyHint optional", () => {
    const minimal: PreflightFixSuggestion = { id: "a", summary: "Do thing" };
    expect(minimal.description).toBeUndefined();
    expect(minimal.applyHint).toBeUndefined();
  });

  it("treats applyHint as an opaque bag", () => {
    const s: PreflightFixSuggestion = {
      id: "b",
      summary: "Apply",
      applyHint: { anything: 42, nested: { ok: true } },
    };
    expect(s.applyHint?.anything).toBe(42);
  });
});
