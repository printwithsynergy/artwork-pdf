// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  VariantMatrixDiffResult,
  VariantMatrixSnapshot,
  VariantMatrixVersionPanelProps,
} from "./VariantMatrixVersionPanel";
import { diffVariantMatrices, resolveSnapshot } from "./VariantMatrixVersionPanel";

/**
 * Contract tests for VariantMatrixVersionPanel (Wave 4 V3).
 *
 * Tests pin the wire shape of versioned variant matrices and the
 * diff algorithm. DOM behaviour (version dropdowns, diff rendering)
 * lands when the editor adopts RTL.
 */

const V1_0_0: VariantMatrixSnapshot = {
  version: "1.0.0",
  matrix: {
    tokenKeys: ["name", "address"],
    variants: [
      { id: "ada", name: "Ada Lovelace", overrides: { name: "Ada", address: "London" } },
      { id: "alan", name: "Alan Turing", overrides: { name: "Alan", address: "Cambridge" } },
    ],
  },
};

const V1_1_0: VariantMatrixSnapshot = {
  version: "1.1.0",
  matrix: {
    tokenKeys: ["name", "address"],
    variants: [
      // ada unchanged
      { id: "ada", name: "Ada Lovelace", overrides: { name: "Ada", address: "London" } },
      // alan's address changed
      { id: "alan", name: "Alan Turing", overrides: { name: "Alan", address: "Bletchley" } },
      // grace added
      { id: "grace", name: "Grace Hopper", overrides: { name: "Grace", address: "Arlington" } },
    ],
  },
};

const V1_2_0: VariantMatrixSnapshot = {
  version: "1.2.0",
  matrix: {
    tokenKeys: ["name", "address", "email"], // new token key
    variants: [
      // ada's name now has email
      {
        id: "ada",
        name: "Ada Lovelace",
        overrides: { name: "Ada", address: "London", email: "ada@example.com" },
      },
      // alan removed
      // grace retained without email
      { id: "grace", name: "Grace Hopper", overrides: { name: "Grace", address: "Arlington" } },
    ],
  },
};

const HISTORY: readonly VariantMatrixSnapshot[] = [V1_0_0, V1_1_0, V1_2_0];

describe("VariantMatrixSnapshot type", () => {
  it("requires version + matrix", () => {
    expect(V1_0_0.version).toBe("1.0.0");
    expect(V1_0_0.matrix.variants).toHaveLength(2);
  });
});

describe("VariantMatrixVersionPanelProps type", () => {
  it("accepts history + optional baseline/current version selectors", () => {
    let lastBaseline: string | undefined;
    const props: VariantMatrixVersionPanelProps = {
      history: HISTORY,
      baselineVersion: "1.0.0",
      currentVersion: "1.2.0",
      onBaselineChange: (v) => {
        lastBaseline = v;
      },
    };
    props.onBaselineChange?.("1.1.0");
    expect(lastBaseline).toBe("1.1.0");
    expect(props.currentVersion).toBe("1.2.0");
  });
});

describe("diffVariantMatrices", () => {
  it("returns empty groups when matrices are identical", () => {
    const diff = diffVariantMatrices(V1_0_0.matrix, V1_0_0.matrix);
    expect(diff.addedVariants).toEqual([]);
    expect(diff.removedVariants).toEqual([]);
    expect(diff.modifiedVariants).toEqual([]);
    expect(diff.addedTokenKeys).toEqual([]);
    expect(diff.removedTokenKeys).toEqual([]);
  });

  it("detects added and removed variants by id", () => {
    const diff = diffVariantMatrices(V1_0_0.matrix, V1_1_0.matrix);
    expect(diff.addedVariants.map((v) => v.id)).toEqual(["grace"]);
    expect(diff.removedVariants).toEqual([]);
    expect(diff.modifiedVariants.map((v) => v.id)).toEqual(["alan"]);
  });

  it("detects modified variants whose overrides differ", () => {
    const diff = diffVariantMatrices(V1_0_0.matrix, V1_1_0.matrix);
    const alanDiff = diff.modifiedVariants.find((v) => v.id === "alan");
    expect(alanDiff).toBeDefined();
    expect([...(alanDiff?.changedTokens ?? [])].sort()).toEqual(["address"]);
  });

  it("detects added + removed token keys", () => {
    const diff = diffVariantMatrices(V1_1_0.matrix, V1_2_0.matrix);
    expect(diff.addedTokenKeys).toEqual(["email"]);
    expect(diff.removedTokenKeys).toEqual([]);
    expect(diff.removedVariants.map((v) => v.id)).toEqual(["alan"]);
  });

  it("treats a variant rename as a modification (id key stays stable)", () => {
    const renamed = {
      tokenKeys: V1_0_0.matrix.tokenKeys,
      variants: [
        { ...V1_0_0.matrix.variants[0], name: "Renamed Ada" },
        V1_0_0.matrix.variants[1],
      ] as VariantMatrixSnapshot["matrix"]["variants"],
    };
    const diff = diffVariantMatrices(V1_0_0.matrix, renamed);
    const adaDiff = diff.modifiedVariants.find((v) => v.id === "ada");
    expect(adaDiff).toBeDefined();
    expect(adaDiff?.changedTokens).toEqual([]);
    expect(adaDiff?.nameChanged).toBe(true);
  });

  it("returns an empty diff for empty matrices", () => {
    const empty: VariantMatrixDiffResult = diffVariantMatrices(
      { tokenKeys: [], variants: [] },
      { tokenKeys: [], variants: [] },
    );
    expect(empty.addedVariants).toEqual([]);
    expect(empty.removedVariants).toEqual([]);
    expect(empty.modifiedVariants).toEqual([]);
  });
});

describe("resolveSnapshot", () => {
  it("returns the explicit version when found", () => {
    expect(resolveSnapshot(HISTORY, "1.1.0")?.version).toBe("1.1.0");
  });
  it("returns the latest snapshot when version is undefined", () => {
    expect(resolveSnapshot(HISTORY, undefined)?.version).toBe("1.2.0");
  });
  it("falls back to the latest snapshot when the version misses", () => {
    expect(resolveSnapshot(HISTORY, "9.9.9")?.version).toBe("1.2.0");
  });
  it("returns undefined when history is empty", () => {
    expect(resolveSnapshot([], "1.0.0")).toBeUndefined();
    expect(resolveSnapshot([], undefined)).toBeUndefined();
  });
});
