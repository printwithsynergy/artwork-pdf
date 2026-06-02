// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  ProcessRule,
  ProcessRulesLoaderFn,
  ProcessRulesPanelProps,
} from "./ProcessRulesPanel";
import { groupRulesByProcess } from "./ProcessRulesPanel";

/**
 * Contract tests for ProcessRulesPanel (Wave 4 P2).
 *
 * DOM behaviour (loading state, error rendering, click-to-select)
 * lands when the editor adopts RTL. These tests pin the wire shape
 * so hosts wiring a P2 endpoint (typically lint-pdf's
 * `/v1/preflight/process` filtered to process-physics rules) have a
 * stable contract.
 */

describe("ProcessRule type", () => {
  it("requires ruleId, severity, message, and process; pageIndex + objectId optional", () => {
    const flexoFinding: ProcessRule = {
      ruleId: "flexo_white_knockout_missing",
      severity: "warn",
      message: "White underbase missing on small text below 6 pt",
      process: "flexo",
    };
    expect(flexoFinding.pageIndex).toBeUndefined();
    expect(flexoFinding.objectId).toBeUndefined();

    const gravureFinding: ProcessRule = {
      ruleId: "gravure_max_line_freq",
      severity: "error",
      message: "Line frequency exceeds gravure cylinder limit (150 lpi)",
      process: "gravure",
      pageIndex: 1,
      objectId: "obj-12",
    };
    expect(gravureFinding.process).toBe("gravure");
    expect(gravureFinding.pageIndex).toBe(1);
  });

  it("severity enumerates info / warn / error", () => {
    const info: ProcessRule["severity"] = "info";
    const warn: ProcessRule["severity"] = "warn";
    const error: ProcessRule["severity"] = "error";
    expect([info, warn, error]).toHaveLength(3);
  });
});

describe("ProcessRulesLoaderFn type", () => {
  it("returns a readonly ProcessRule[] promise", async () => {
    const loader: ProcessRulesLoaderFn = async (input) => {
      expect(input.process).toBe("screen");
      return [
        {
          ruleId: "screen_halftone_limit",
          severity: "warn",
          message: "Halftone screen ruling exceeds the screen-print substrate limit",
          process: input.process,
        },
      ];
    };
    const out = await loader({ documentB64: "JVBERi0xLjQ=", process: "screen" });
    expect(out).toHaveLength(1);
    expect(out[0]?.process).toBe("screen");
  });
});

describe("ProcessRulesPanelProps type", () => {
  it("accepts documentB64 + process + loader; onSelect + groupByProcess optional", () => {
    const props: ProcessRulesPanelProps = {
      documentB64: "JVBERi0xLjQ=",
      process: "flexo",
      loader: async () => [],
    };
    expect(props.onSelect).toBeUndefined();
    expect(props.groupByProcess).toBeUndefined();
  });

  it("accepts undefined documentB64 + process (pre-export empty state)", () => {
    const props: ProcessRulesPanelProps = {
      documentB64: undefined,
      process: undefined,
      loader: async () => [],
    };
    expect(props.documentB64).toBeUndefined();
    expect(props.process).toBeUndefined();
  });

  it("accepts groupByProcess + onSelect", () => {
    let lastSelected: ProcessRule | undefined;
    const props: ProcessRulesPanelProps = {
      documentB64: "JVBERi0xLjQ=",
      process: "gravure",
      loader: async () => [],
      onSelect: (f) => {
        lastSelected = f;
      },
      groupByProcess: true,
    };
    props.onSelect?.({
      ruleId: "x",
      severity: "info",
      message: "y",
      process: "gravure",
    });
    expect(lastSelected?.ruleId).toBe("x");
    expect(props.groupByProcess).toBe(true);
  });
});

describe("groupRulesByProcess", () => {
  const rules: readonly ProcessRule[] = [
    { ruleId: "a", severity: "warn", message: "1", process: "flexo" },
    { ruleId: "b", severity: "error", message: "2", process: "flexo" },
    { ruleId: "c", severity: "info", message: "3", process: "gravure" },
    { ruleId: "d", severity: "warn", message: "4", process: "screen" },
  ];

  it("groups findings by process key in first-occurrence order", () => {
    const groups = groupRulesByProcess(rules);
    expect(groups.map((g) => g.process)).toEqual(["flexo", "gravure", "screen"]);
    expect(groups[0]?.rules).toHaveLength(2);
    expect(groups[1]?.rules).toHaveLength(1);
  });

  it("returns an empty array for empty input", () => {
    expect(groupRulesByProcess([])).toEqual([]);
  });

  it("preserves rule order within a group", () => {
    const groups = groupRulesByProcess(rules);
    const flexo = groups.find((g) => g.process === "flexo");
    expect(flexo?.rules.map((r) => r.ruleId)).toEqual(["a", "b"]);
  });
});
