// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  ComplianceFinding,
  ComplianceFindingsPanelProps,
  ComplianceLoaderFn,
} from "./ComplianceFindingsPanel";

/**
 * Contract tests for ComplianceFindingsPanel's typed public surface.
 *
 * DOM behaviour (loading / error / empty / list rendering, onSelect
 * click wiring) lands when the editor adopts RTL. These tests pin the
 * wire shape so lint-pdf's `/v1/preflight/process` response and the
 * editor agree on the finding shape.
 */

describe("ComplianceFinding type", () => {
  it("requires ruleId + severity + message", () => {
    const f: ComplianceFinding = {
      ruleId: "LPDF_INK_001",
      severity: "warn",
      message: "Total ink coverage 280% exceeds substrate limit (240%).",
    };
    expect(f.ruleId).toBe("LPDF_INK_001");
    expect(f.pageIndex).toBeUndefined();
  });

  it("accepts pageIndex + objectId for object-scoped findings", () => {
    const f: ComplianceFinding = {
      ruleId: "LPDF_INK_002",
      severity: "error",
      message: "Metallic ink not allowed on matte substrate.",
      pageIndex: 1,
      objectId: "obj-42",
    };
    expect(f.pageIndex).toBe(1);
    expect(f.objectId).toBe("obj-42");
  });
});

describe("ComplianceLoaderFn type", () => {
  it("is an async function from { documentB64, process, substrate } → findings", async () => {
    const loader: ComplianceLoaderFn = async ({ process, substrate }) => {
      expect(process).toBe("flexo");
      expect(substrate).toBe("newsprint");
      return [
        {
          ruleId: "LPDF_INK_001",
          severity: "warn",
          message: "TAC exceeds substrate limit.",
        },
      ];
    };
    const findings = await loader({
      documentB64: "AAEC",
      process: "flexo",
      substrate: "newsprint",
    });
    expect(findings).toHaveLength(1);
  });
});

describe("ComplianceFindingsPanelProps type", () => {
  it("requires documentB64 + process + substrate + loader", () => {
    const props: ComplianceFindingsPanelProps = {
      documentB64: undefined,
      process: undefined,
      substrate: undefined,
      loader: async () => [],
    };
    expect(props.onSelect).toBeUndefined();
  });

  it("accepts an onSelect callback for finding click highlight", () => {
    let selected: ComplianceFinding | undefined;
    const props: ComplianceFindingsPanelProps = {
      documentB64: "AAEC",
      process: "offset",
      substrate: "coated",
      loader: async () => [],
      onSelect: (f) => {
        selected = f;
      },
    };
    props.onSelect?.({
      ruleId: "X",
      severity: "info",
      message: "y",
    });
    expect(selected?.ruleId).toBe("X");
  });
});
