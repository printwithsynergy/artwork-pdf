// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  type BrailleCell,
  type BrailleComposeResult,
  type BraillePanelProps,
  type BrailleSpec,
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

  it("falls back to MARBURG_MEDIUM.charSpacingMm when given 0 or negative spacing", () => {
    // Direct callers (server pre-compute, custom hosts) might pass
    // garbage; the panel form already clamps but the helper must
    // guard for non-panel callers too.
    const zero = composeBraille({ text: "ab", charSpacingMm: 0 });
    const negative = composeBraille({ text: "ab", charSpacingMm: -1 });
    expect(zero.cells.map((c) => c.xMm)).toEqual([0, MARBURG_MEDIUM.charSpacingMm]);
    expect(negative.cells.map((c) => c.xMm)).toEqual([0, MARBURG_MEDIUM.charSpacingMm]);
  });
});

describe("composeBraille punctuation (UEB / EBAE patterns)", () => {
  // Each row is [character, expected 6-dot pattern, semantic description].
  // Patterns are sourced from the Braille Authority's UEB Rules and
  // match older EBAE for these symbols.
  const cases: Array<[string, [boolean, boolean, boolean, boolean, boolean, boolean], string]> = [
    [".", [false, true, false, false, true, true], "period (dots 2-5-6)"],
    [",", [false, true, false, false, false, false], "comma (dot 2)"],
    [";", [false, true, true, false, false, false], "semicolon (dots 2-3)"],
    [":", [false, true, false, false, true, false], "colon (dots 2-5)"],
    ["!", [false, true, true, false, true, false], "exclamation (dots 2-3-5)"],
    ["?", [true, false, false, true, true, true], "question (dots 1-4-5-6)"],
    ["'", [false, false, true, false, false, false], "apostrophe (dot 3)"],
    ["-", [false, false, true, false, false, true], "hyphen (dots 3-6)"],
  ];

  it.each(cases)("encodes %s as %s", (ch, dots, _label) => {
    const result = composeBraille({ text: ch });
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]?.dots).toEqual(dots);
    expect(result.unsupportedChars).not.toContain(ch);
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

  it("BraillePanelProps accepts uncontrolled onCompose mode", () => {
    const minimal: BraillePanelProps = {
      onCompose: (_r: BrailleComposeResult) => {},
    };
    expect(minimal.initialText).toBeUndefined();
    expect(minimal.initialCharSpacingMm).toBeUndefined();
  });

  it("BraillePanelProps accepts controlled value + onChange mode", () => {
    const sink: { last: BrailleSpec | null } = { last: null };
    const props: BraillePanelProps = {
      value: { text: "abc", charSpacingMm: MARBURG_MEDIUM.charSpacingMm },
      onChange: (next) => {
        sink.last = next;
      },
    };
    expect(props.value?.text).toBe("abc");
    props.onChange?.({ text: "xyz", charSpacingMm: 7 });
    expect(sink.last?.text).toBe("xyz");
    expect(sink.last?.charSpacingMm).toBe(7);
  });

  it("BrailleSpec carries text + charSpacingMm", () => {
    const s: BrailleSpec = { text: "abc", charSpacingMm: 5 };
    expect(s.text).toBe("abc");
    expect(s.charSpacingMm).toBe(5);
  });
});
