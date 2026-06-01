// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  VariantMatrixPanelProps,
  VariantMatrixPanelValue,
  VariantMatrixPanelVariant,
} from "./VariantMatrixPanel";

/**
 * Contract tests for VariantMatrixPanel's typed public surface.
 *
 * Pins the wire shape so apps/service's render handler and the
 * Wave 3 V1 merge pipeline can rely on the published API. DOM
 * interactions (add/remove variant, add token key, override edit)
 * land when the editor adopts RTL.
 */

describe("VariantMatrixPanelValue type", () => {
  it("requires tokenKeys + variants", () => {
    const empty: VariantMatrixPanelValue = { tokenKeys: [], variants: [] };
    expect(empty.tokenKeys).toEqual([]);
    expect(empty.variants).toEqual([]);
  });

  it("accepts a full matrix shape", () => {
    const full: VariantMatrixPanelValue = {
      tokenKeys: ["name", "title"],
      variants: [
        { id: "v1", name: "Alice", overrides: { name: "Alice Smith", title: "CEO" } },
        { id: "v2", name: "Bob", overrides: { name: "Bob Jones" } },
      ],
    };
    expect(full.variants).toHaveLength(2);
    expect(full.variants[1]?.overrides.title).toBeUndefined();
  });
});

describe("VariantMatrixPanelVariant type", () => {
  it("overrides keys are author-defined (no token enforcement at the type level)", () => {
    const v: VariantMatrixPanelVariant = {
      id: "v1",
      name: "Test",
      overrides: { sku: "ABC-123", coupon: "WELCOME10" },
    };
    expect(v.overrides.sku).toBe("ABC-123");
  });
});

describe("VariantMatrixPanelProps type", () => {
  it("requires value + onChange; initialTokenKeys is optional", () => {
    const props: VariantMatrixPanelProps = {
      value: undefined,
      onChange: () => {},
    };
    expect(props.initialTokenKeys).toBeUndefined();
  });

  it("accepts an initialTokenKeys hint when value is undefined", () => {
    const props: VariantMatrixPanelProps = {
      value: undefined,
      onChange: () => {},
      initialTokenKeys: ["name", "title", "sku"] as const,
    };
    expect(props.initialTokenKeys).toHaveLength(3);
  });

  it("accepts a fully populated value", () => {
    const props: VariantMatrixPanelProps = {
      value: {
        tokenKeys: ["name"],
        variants: [{ id: "v1", name: "Alice", overrides: { name: "Alice S." } }],
      },
      onChange: () => {},
    };
    expect(props.value?.variants[0]?.overrides.name).toBe("Alice S.");
  });
});
