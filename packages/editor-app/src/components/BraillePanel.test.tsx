// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  type BrailleCell,
  type BrailleComposeResult,
  type BraillePanelProps,
  MARBURG_MEDIUM,
  composeBraille,
} from "./BraillePanel";

describe("MARBURG_MEDIUM constants", () => {
  it("matches EN 15823 dot-geometry defaults", () => {
    expect(MARBURG_MEDIUM.dotHeightMm).toBe(0.2);
    expect(MARBURG_MEDIUM.dotBaseDiameterMm).toBe(1.44);
    expect(MARBURG_MEDIUM.dotSpacingMm).toBe(2.5);
    expect(MARBURG_MEDIUM.cellWidthMm).toBe(6.0);
    expect(MARBURG_MEDIUM.charSpacingMm).toBe(5.0);
    expect(MARBURG_MEDIUM.lineSpacingMm).toBe(10.0);
  });
});

describe("composeBraille letters", () => {
  it("emits the canonical A dot pattern (dot 1)", () => {
    const result = composeBraille({ text: "a" });
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]?.dots).toEqual([true, false, false, false, false, false]);
  });

  it("lowercases input before lookup", () => {
    const upper = composeBraille({ text: "A" });
    const lower = composeBraille({ text: "a" });
    expect(upper.cells[0]?.dots).toEqual(lower.cells[0]?.dots);
  });

  it("encodes Z with dots 1, 3, 5, 6", () => {
    const result = composeBraille({ text: "z" });
    // The dot order in the array is [d1, d2, d3, d4, d5, d6].
    expect(result.cells[0]?.dots).toEqual([true, false, true, false, true, true]);
  });

  it("places cells at charSpacingMm intervals on the x axis", () => {
    const result = composeBraille({ text: "abc" });
    expect(result.cells.map((c) => c.xMm)).toEqual([0, 5, 10]);
    expect(result.cells.every((c) => c.yMm === 0)).toBe(true);
  });

  it("honours a custom charSpacingMm", () => {
    const result = composeBraille({ text: "ab", charSpacingMm: 3 });
    expect(result.cells.map((c) => c.xMm)).toEqual([0, 3]);
  });
});

describe("composeBraille digits", () => {
  it("prefixes each digit with the number indicator (dots 3-4-5-6)", () => {
    const result = composeBraille({ text: "1" });
    expect(result.cells).toHaveLength(2);
    // First cell: number indicator
    expect(result.cells[0]?.dots).toEqual([false, false, true, true, true, true]);
    expect(result.cells[0]?.char).toBe("#");
    // Second cell: A (dot 1) — digit 1 reuses the A pattern.
    expect(result.cells[1]?.dots).toEqual([true, false, false, false, false, false]);
    expect(result.cells[1]?.char).toBe("1");
  });

  it("maps 0 → J pattern", () => {
    const result = composeBraille({ text: "0" });
    expect(result.cells[1]?.dots).toEqual([false, true, false, true, true, false]);
  });
});

describe("composeBraille unicode output", () => {
  it("emits U+2801 for A (only dot 1)", () => {
    const result = composeBraille({ text: "a" });
    expect(result.unicode).toBe("⠁");
  });

  it("composes the full word HELLO into the expected Unicode string", () => {
    const result = composeBraille({ text: "hello" });
    expect(result.unicode).toBe("⠓⠑⠇⠇⠕");
  });
});

describe("composeBraille unsupported characters", () => {
  it("drops emoji and surfaces them via unsupportedChars", () => {
    const result = composeBraille({ text: "a\u{1F600}b" });
    expect(result.cells.map((c) => c.char)).toEqual(["a", "b"]);
    expect(result.unsupportedChars).toContain("\u{1F600}");
  });

  it("accepts space as a real empty cell", () => {
    const result = composeBraille({ text: "a b" });
    expect(result.cells).toHaveLength(3);
    expect(result.cells[1]?.dots).toEqual([false, false, false, false, false, false]);
  });
});

describe("public type contracts", () => {
  it("BrailleCell carries char + position + 6 dot booleans", () => {
    const cell: BrailleCell = {
      char: "a",
      xMm: 0,
      yMm: 0,
      dots: [true, false, false, false, false, false],
    };
    expect(cell.dots).toHaveLength(6);
  });

  it("BrailleComposeResult carries cells + unicode + unsupportedChars", () => {
    const result: BrailleComposeResult = { cells: [], unicode: "", unsupportedChars: [] };
    expect(result.unicode).toBe("");
  });

  it("BraillePanelProps requires onCompose; optional initialText and initialCharSpacingMm", () => {
    const minimal: BraillePanelProps = {
      onCompose: (_r: BrailleComposeResult) => {},
    };
    expect(minimal.initialText).toBeUndefined();
    expect(minimal.initialCharSpacingMm).toBeUndefined();
  });
});
