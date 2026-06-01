// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { MisEstimateButtonProps, MisEstimateManifest, MisSubmitFn } from "./MisEstimateButton";

/**
 * Contract tests for MisEstimateButton's typed public surface.
 *
 * DOM behaviour (button disabled when manifest is undefined,
 * inline error rendering, success message) lands when the editor
 * adopts RTL. These tests pin the wire shape so the synergy
 * `mis.estimate` node and the editor agree on the manifest.
 */

describe("MisEstimateManifest type", () => {
  it("requires documentId + processClass", () => {
    const m: MisEstimateManifest = {
      documentId: "doc-1",
      processClass: "flexo",
    };
    expect(m.documentId).toBe("doc-1");
    expect(m.dueDate).toBeUndefined();
  });

  it("accepts the full optional surface", () => {
    const m: MisEstimateManifest = {
      documentId: "doc-2",
      processClass: "offset",
      separations: [
        { name: "PANTONE 185 C", colorSpace: "Separation" },
        { name: "Silver", colorSpace: "DeviceN" },
      ],
      materialEstimate: { substrateGsm: 250, sheetsRequired: 1500 },
      dueDate: "2026-08-15",
      extras: { po_number: "PO-42" },
    };
    expect(m.separations).toHaveLength(2);
    expect(m.extras?.po_number).toBe("PO-42");
  });
});

describe("MisSubmitFn type", () => {
  it("is an async function from manifest → { workflowId }", async () => {
    const submit: MisSubmitFn = async (manifest) => {
      expect(manifest.documentId).toBe("doc-1");
      return { workflowId: "wf-001" };
    };
    const result = await submit({ documentId: "doc-1", processClass: "digital" });
    expect(result.workflowId).toBe("wf-001");
  });
});

describe("MisEstimateButtonProps type", () => {
  it("requires manifest (or undefined) + submit; label and onSuccess are optional", () => {
    const props: MisEstimateButtonProps = {
      manifest: undefined,
      submit: async () => ({ workflowId: "noop" }),
    };
    expect(props.manifest).toBeUndefined();
    expect(props.label).toBeUndefined();
  });

  it("accepts an onSuccess callback", () => {
    let observed: string | undefined;
    const props: MisEstimateButtonProps = {
      manifest: { documentId: "doc-1", processClass: "flexo" },
      submit: async () => ({ workflowId: "wf-42" }),
      label: "Submit to MIS",
      onSuccess: (id) => {
        observed = id;
      },
    };
    props.onSuccess?.("wf-42");
    expect(observed).toBe("wf-42");
  });
});
