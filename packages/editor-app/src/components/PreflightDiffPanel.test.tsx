// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  PreflightDiffPanelProps,
  PreflightDiffResult,
  PreflightFinding,
  PreflightSnapshotInput,
} from "./PreflightDiffPanel";
import { diffPreflightFindings, resolveBaselineSnapshot } from "./PreflightDiffPanel";

/**
 * Contract tests for PreflightDiffPanel (Wave 4 P4).
 *
 * DOM behaviour (header rendering, severity dots, snapshot picker)
 * lands when the editor adopts RTL. These tests pin the wire shape
 * + the diff algorithm so hosts wiring document-model
 * `PreflightSnapshot[]` into the panel have a stable contract.
 */

const A: PreflightFinding = { ruleId: "tac_max", severity: "warn", pageIndex: 0 };
const B: PreflightFinding = { ruleId: "rgb_image_detected", severity: "error", pageIndex: 1 };
const C: PreflightFinding = { ruleId: "missing_font", severity: "error" };
const D: PreflightFinding = { ruleId: "low_image_dpi", severity: "info", pageIndex: 0 };

const SNAPSHOT_PREV: PreflightSnapshotInput = {
  id: "snap-prev",
  timestamp: "2026-06-01T10:00:00Z",
  triggeredBy: "user",
  findings: [A, B, C],
};
const SNAPSHOT_LATER: PreflightSnapshotInput = {
  id: "snap-later",
  timestamp: "2026-06-02T11:00:00Z",
  triggeredBy: "export",
  findings: [B, D],
};

describe("PreflightFinding type", () => {
  it("requires ruleId + severity; pageIndex optional", () => {
    const finding: PreflightFinding = {
      ruleId: "tac_max",
      severity: "warn",
    };
    expect(finding.pageIndex).toBeUndefined();
  });
  it("severity enumerates info / warn / error", () => {
    const info: PreflightFinding["severity"] = "info";
    const warn: PreflightFinding["severity"] = "warn";
    const error: PreflightFinding["severity"] = "error";
    expect([info, warn, error]).toHaveLength(3);
  });
});

describe("PreflightDiffPanelProps type", () => {
  it("requires currentFindings + history; baselineSnapshotId optional", () => {
    const props: PreflightDiffPanelProps = {
      currentFindings: [A],
      history: [SNAPSHOT_PREV],
    };
    expect(props.currentFindings).toHaveLength(1);
    expect(props.baselineSnapshotId).toBeUndefined();
  });
  it("accepts baselineSnapshotId + onBaselineChange", () => {
    let lastPicked: string | undefined;
    const props: PreflightDiffPanelProps = {
      currentFindings: [A],
      history: [SNAPSHOT_PREV, SNAPSHOT_LATER],
      baselineSnapshotId: "snap-prev",
      onBaselineChange: (id) => {
        lastPicked = id;
      },
    };
    props.onBaselineChange?.("snap-later");
    expect(lastPicked).toBe("snap-later");
    expect(props.baselineSnapshotId).toBe("snap-prev");
  });
});

describe("diffPreflightFindings", () => {
  it("returns empty groups when baseline + current are identical", () => {
    const diff = diffPreflightFindings([A, B], [A, B]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.persisted).toHaveLength(2);
  });

  it("classifies findings into added / removed / persisted", () => {
    const diff = diffPreflightFindings([A, B, C], [B, D]);
    expect(diff.removed.map((f) => f.ruleId).sort()).toEqual(["missing_font", "tac_max"]);
    expect(diff.added.map((f) => f.ruleId)).toEqual(["low_image_dpi"]);
    expect(diff.persisted.map((f) => f.ruleId)).toEqual(["rgb_image_detected"]);
  });

  it("treats findings with the same ruleId on different pages as distinct", () => {
    const ruleOnPage0: PreflightFinding = { ruleId: "tac_max", severity: "warn", pageIndex: 0 };
    const ruleOnPage1: PreflightFinding = { ruleId: "tac_max", severity: "warn", pageIndex: 1 };
    const diff = diffPreflightFindings([ruleOnPage0], [ruleOnPage1]);
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(diff.persisted).toEqual([]);
  });

  it("returns all current as `added` when baseline is empty", () => {
    const diff = diffPreflightFindings([], [A, B]);
    expect(diff.added).toHaveLength(2);
    expect(diff.removed).toEqual([]);
    expect(diff.persisted).toEqual([]);
  });

  it("returns all baseline as `removed` when current is empty", () => {
    const diff = diffPreflightFindings([A, B], []);
    expect(diff.removed).toHaveLength(2);
    expect(diff.added).toEqual([]);
    expect(diff.persisted).toEqual([]);
  });

  it("returns empty diff when both inputs are empty", () => {
    const diff: PreflightDiffResult = diffPreflightFindings([], []);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.persisted).toEqual([]);
  });

  it("treats severity changes on the same rule+page as a remove + add", () => {
    const warn: PreflightFinding = { ruleId: "tac_max", severity: "warn", pageIndex: 0 };
    const error: PreflightFinding = { ruleId: "tac_max", severity: "error", pageIndex: 0 };
    const diff = diffPreflightFindings([warn], [error]);
    expect(diff.removed).toHaveLength(1);
    expect(diff.added).toHaveLength(1);
    expect(diff.persisted).toEqual([]);
  });
});

describe("resolveBaselineSnapshot", () => {
  it("returns the explicit snapshot when its id matches", () => {
    const resolved = resolveBaselineSnapshot([SNAPSHOT_PREV, SNAPSHOT_LATER], "snap-prev");
    expect(resolved?.id).toBe("snap-prev");
    expect(resolved?.findings).toEqual(SNAPSHOT_PREV.findings);
  });

  it("returns the most recent snapshot when baselineSnapshotId is absent", () => {
    const resolved = resolveBaselineSnapshot([SNAPSHOT_PREV, SNAPSHOT_LATER], undefined);
    expect(resolved?.id).toBe("snap-later");
  });

  it("falls back to the most recent snapshot when baselineSnapshotId misses", () => {
    // Mirrors the case where a host trims history below the user's
    // previously-saved baseline — the panel stays useful.
    const resolved = resolveBaselineSnapshot([SNAPSHOT_PREV, SNAPSHOT_LATER], "ghost");
    expect(resolved?.id).toBe("snap-later");
  });

  it("returns undefined for empty history", () => {
    expect(resolveBaselineSnapshot([], "snap-prev")).toBeUndefined();
    expect(resolveBaselineSnapshot([], undefined)).toBeUndefined();
  });
});
