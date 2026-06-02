// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  type MergeRow,
  type MergeValidationResult,
  extractMergeTokens,
  mergeAllRows,
  mergeRow,
  validateMergeManifest,
} from "./merge-tokens";

describe("extractMergeTokens", () => {
  it("returns tokens in first-occurrence order, deduplicated", () => {
    expect(extractMergeTokens("Hi {{firstName}} {{lastName}}, {{firstName}}!")).toEqual([
      "firstName",
      "lastName",
    ]);
  });

  it("tolerates whitespace inside the delimiters", () => {
    expect(extractMergeTokens("{{  first  }} and {{last}}")).toEqual(["first", "last"]);
  });

  it("returns an empty list when there are no tokens", () => {
    expect(extractMergeTokens("plain old text")).toEqual([]);
  });

  it("ignores malformed delimiters", () => {
    expect(extractMergeTokens("{{ 123name }} {{}} {single} {{wrong-shape}}")).toEqual([]);
  });
});

describe("mergeRow", () => {
  it("replaces every token with its row value", () => {
    const result = mergeRow("Hi {{firstName}}", { firstName: "Ada" });
    expect(result.merged).toBe("Hi Ada");
    expect(result.missingTokens).toEqual([]);
  });

  it("replaces tokens with empty strings and surfaces them as missing when the row lacks the column", () => {
    const result = mergeRow("Hi {{firstName}} {{lastName}}", { firstName: "Ada" });
    expect(result.merged).toBe("Hi Ada ");
    expect(result.missingTokens).toEqual(["lastName"]);
  });

  it("deduplicates missing tokens", () => {
    const result = mergeRow("{{x}} {{x}}", {});
    expect(result.missingTokens).toEqual(["x"]);
  });

  it("treats Object.prototype members as missing, not as inherited values", () => {
    // Guards against a class of bugs where `row[name]` resolves to
    // inherited prototype methods (e.g. `toString`, `constructor`)
    // and corrupts the merged output.
    const result = mergeRow("Hi {{toString}}!", {});
    expect(result.merged).toBe("Hi !");
    expect(result.missingTokens).toEqual(["toString"]);
  });

  it("still resolves prototype-shadowing names from own properties", () => {
    const result = mergeRow("Hi {{toString}}!", { toString: "Ada" });
    expect(result.merged).toBe("Hi Ada!");
    expect(result.missingTokens).toEqual([]);
  });
});

describe("validateMergeManifest", () => {
  it("returns empty arrays when template and row line up", () => {
    const result: MergeValidationResult = validateMergeManifest("Hi {{name}}", { name: "Ada" });
    expect(result).toEqual({ missingTokens: [], unusedColumns: [] });
  });

  it("reports tokens the row is missing", () => {
    const result = validateMergeManifest("{{a}} {{b}}", { a: "1" } as MergeRow);
    expect(result.missingTokens).toEqual(["b"]);
    expect(result.unusedColumns).toEqual([]);
  });

  it("reports columns the template doesn't reference", () => {
    const result = validateMergeManifest("{{a}}", { a: "1", typoColumn: "x" });
    expect(result.missingTokens).toEqual([]);
    expect(result.unusedColumns).toEqual(["typoColumn"]);
  });
});

describe("mergeAllRows", () => {
  it("merges every row in order", () => {
    const rows: MergeRow[] = [{ name: "Ada" }, { name: "Grace" }];
    const result = mergeAllRows("Hello {{name}}", rows);
    expect(result.map((r) => r.merged)).toEqual(["Hello Ada", "Hello Grace"]);
  });
});
