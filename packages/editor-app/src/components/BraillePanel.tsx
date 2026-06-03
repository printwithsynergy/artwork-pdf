// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 3 P5 — Braille layout editor.
 *
 * Pharmaceutical packaging in the EU is required to carry Braille
 * matching the product name (Directive 2001/83/EC Article 56a) per
 * the Marburg Medium dot-geometry standard (EN 15823). This panel
 * lets the user type the source text, configure the dot geometry,
 * and emit an ordered list of {@link BrailleCell}s the host renders
 * as a vector layer.
 *
 * The transliterator covers Grade 1 English uncontracted Braille
 * (letters A–Z, digits 0–9 with the AI 3456 prefix, common
 * punctuation). Multi-language contracted Braille (Grade 2 English,
 * German, French) is out of scope — hosts that need it wire their
 * own translator (e.g. liblouis via a worker) and feed the resulting
 * Unicode Braille string into {@link composeBraille} directly.
 *
 * @public
 */
import { useState } from "react";
import { primaryButtonStyle } from "../lib/panel-button-styles";

/**
 * Marburg Medium dot-geometry defaults (EN 15823). Re-exported so
 * server-side renderers can use the same constants for compliance
 * checks. Values are in millimetres.
 *
 * @public
 */
export const MARBURG_MEDIUM = {
  dotHeightMm: 0.2,
  dotBaseDiameterMm: 1.44,
  dotSpacingMm: 2.5,
  cellWidthMm: 6.0,
  charSpacingMm: 5.0,
  lineSpacingMm: 10.0,
} as const;

/**
 * One Braille cell — six (or eight) dot booleans plus its x/y
 * position in millimetres (relative to the panel's origin). Hosts
 * render each dot as a vector ellipse / dome at the configured
 * height + base diameter.
 *
 * Dot indices follow the canonical numbering:
 * ```
 * 1 4
 * 2 5
 * 3 6
 * ```
 *
 * @public
 */
export type BrailleCell = {
  char: string;
  xMm: number;
  yMm: number;
  dots: readonly [boolean, boolean, boolean, boolean, boolean, boolean];
};

/**
 * Result returned by {@link composeBraille}. `cells` is the placed
 * cell list; `unicode` is the equivalent Unicode Braille string
 * (U+28xx codepoints), useful for accessibility tools that already
 * speak Braille; `unsupportedChars` lists any source characters the
 * transliterator dropped so the host can warn the user.
 *
 * @public
 */
export type BrailleComposeResult = {
  cells: BrailleCell[];
  unicode: string;
  unsupportedChars: string[];
};

const LETTER_DOTS: Record<string, [boolean, boolean, boolean, boolean, boolean, boolean]> = {
  a: [true, false, false, false, false, false],
  b: [true, true, false, false, false, false],
  c: [true, false, false, true, false, false],
  d: [true, false, false, true, true, false],
  e: [true, false, false, false, true, false],
  f: [true, true, false, true, false, false],
  g: [true, true, false, true, true, false],
  h: [true, true, false, false, true, false],
  i: [false, true, false, true, false, false],
  j: [false, true, false, true, true, false],
  k: [true, false, true, false, false, false],
  l: [true, true, true, false, false, false],
  m: [true, false, true, true, false, false],
  n: [true, false, true, true, true, false],
  o: [true, false, true, false, true, false],
  p: [true, true, true, true, false, false],
  q: [true, true, true, true, true, false],
  r: [true, true, true, false, true, false],
  s: [false, true, true, true, false, false],
  t: [false, true, true, true, true, false],
  u: [true, false, true, false, false, true],
  v: [true, true, true, false, false, true],
  w: [false, true, false, true, true, true],
  x: [true, false, true, true, false, true],
  y: [true, false, true, true, true, true],
  z: [true, false, true, false, true, true],
};

// "Number indicator" prefix (dots 3-4-5-6). When the transliterator
// emits a digit, it inserts this cell first; digits 0-9 share their
// dot pattern with letters a-j (per the standard A=1, B=2 ... J=0).
const NUMBER_PREFIX: [boolean, boolean, boolean, boolean, boolean, boolean] = [
  false,
  false,
  true,
  true,
  true,
  true,
];

const DIGIT_TO_LETTER: Record<string, string> = {
  "1": "a",
  "2": "b",
  "3": "c",
  "4": "d",
  "5": "e",
  "6": "f",
  "7": "g",
  "8": "h",
  "9": "i",
  "0": "j",
};

const PUNCT_DOTS: Record<string, [boolean, boolean, boolean, boolean, boolean, boolean]> = {
  // Dot indices in the tuple are 1, 2, 3, 4, 5, 6 (left col top→bottom,
  // right col top→bottom). Patterns follow Unified English Braille
  // (UEB) and English Braille American Edition (EBAE), which agree on
  // these punctuation symbols.
  " ": [false, false, false, false, false, false],
  ".": [false, true, false, false, true, true], // dots 2-5-6
  ",": [false, true, false, false, false, false], // dot 2
  ";": [false, true, true, false, false, false], // dots 2-3
  ":": [false, true, false, false, true, false], // dots 2-5
  "!": [false, true, true, false, true, false], // dots 2-3-5
  "?": [true, false, false, true, true, true], // dots 1-4-5-6
  "'": [false, false, true, false, false, false], // dot 3
  "-": [false, false, true, false, false, true], // dots 3-6
};

function dotsToUnicode(
  dots: readonly [boolean, boolean, boolean, boolean, boolean, boolean],
): string {
  // Unicode Braille pattern codepoint = U+2800 + bitmask where bit 0
  // is dot 1, bit 1 is dot 2, …, bit 5 is dot 6.
  let bits = 0;
  for (let i = 0; i < 6; i++) {
    if (dots[i]) bits |= 1 << i;
  }
  return String.fromCodePoint(0x2800 + bits);
}

/**
 * Transliterate a Grade 1 English string into placed Braille cells.
 * The function only covers letters, digits, and a small set of
 * common punctuation; unsupported characters are dropped and
 * surfaced via `unsupportedChars` so the host can warn the user.
 *
 * Cells are laid out left-to-right at `charSpacingMm` intervals on
 * a single line, all at `y = 0`. Multi-line layout is the host's
 * responsibility (it can chunk the input on `\n` and translate each
 * line separately).
 *
 * Pure function — exported so RSC / Astro-frontmatter callers can
 * pre-compute placement.
 *
 * @public
 */
export function composeBraille(input: {
  text: string;
  charSpacingMm?: number;
}): BrailleComposeResult {
  // Clamp the spacing for direct callers (RSC, host code) the same
  // way the panel does. Zero / negative values produce overlapping
  // or reverse-ordered cells, which is never what a host wants.
  const charSpacing =
    input.charSpacingMm !== undefined && input.charSpacingMm > 0
      ? input.charSpacingMm
      : MARBURG_MEDIUM.charSpacingMm;
  const cells: BrailleCell[] = [];
  const unsupportedChars: string[] = [];
  let cursorMm = 0;

  for (const ch of input.text) {
    const lower = ch.toLowerCase();
    const letterDots = LETTER_DOTS[lower];
    if (letterDots) {
      cells.push({
        char: ch,
        xMm: cursorMm,
        yMm: 0,
        dots: letterDots,
      });
      cursorMm += charSpacing;
      continue;
    }
    const asLetter = DIGIT_TO_LETTER[ch];
    if (asLetter !== undefined) {
      const digitDots = LETTER_DOTS[asLetter];
      if (digitDots) {
        // Emit the number-indicator cell before each digit. A
        // run-aware encoding would only prefix the first digit;
        // per-digit is the conservative form and the standard
        // accepts it.
        cells.push({
          char: "#",
          xMm: cursorMm,
          yMm: 0,
          dots: NUMBER_PREFIX,
        });
        cursorMm += charSpacing;
        cells.push({
          char: ch,
          xMm: cursorMm,
          yMm: 0,
          dots: digitDots,
        });
        cursorMm += charSpacing;
        continue;
      }
    }
    const punctDots = PUNCT_DOTS[ch];
    if (punctDots) {
      cells.push({
        char: ch,
        xMm: cursorMm,
        yMm: 0,
        dots: punctDots,
      });
      cursorMm += charSpacing;
      continue;
    }
    unsupportedChars.push(ch);
  }

  const unicode = cells.map((cell) => dotsToUnicode(cell.dots)).join("");
  return { cells, unicode, unsupportedChars };
}

/**
 * @public
 */
/**
 * Controlled-mode value shape — just the form's two inputs.
 *
 * @public
 */
export type BrailleSpec = {
  text: string;
  charSpacingMm: number;
};

export type BraillePanelProps = {
  /** Uncontrolled-mode compose callback — fires when the user clicks
   *  **Compose** with the placed cells + Unicode + unsupported-char
   *  report. The host renders the cells as vector ellipses on the
   *  canvas. Required in uncontrolled mode; ignored (and the button
   *  hidden) when `value` + `onChange` are supplied. */
  onCompose?: (result: BrailleComposeResult) => void;
  /** Initial text seeded into the form (uncontrolled mode).
   *  Defaults to the empty string. Ignored when `value` is supplied. */
  initialText?: string;
  /** Initial character-spacing override (uncontrolled mode);
   *  defaults to the Marburg Medium constant. */
  initialCharSpacingMm?: number;
  /**
   * Controlled-mode value. When supplied alongside `onChange`, the
   * panel doesn't keep internal state — every edit flows up via
   * `onChange` and the panel re-renders from `value`. Used by the
   * editor's Braille tool to wire the panel as a properties editor
   * for the selected canvas object.
   *
   * In controlled mode the **Compose** button is hidden.
   */
  value?: BrailleSpec;
  /** Controlled-mode change handler. See {@link BraillePanelProps.value}. */
  onChange?: (next: BrailleSpec) => void;
};

/**
 * Braille layout panel. The user types the source text, optionally
 * tweaks character spacing for non-standard substrates, and clicks
 * **Compose**; the host receives the placed cells.
 *
 * The panel does not render the Braille itself — preview is the
 * host's responsibility because the dot geometry (ellipse vs.
 * spherical dome) and the production process (foil-emboss vs. ink
 * + spot-UV) drive how it should be visualised.
 *
 * Operates in two modes:
 *
 * - **Uncontrolled** (legacy): supply `onCompose`. Panel keeps its
 *   own text + spacing state.
 * - **Controlled** (new): supply `value` + `onChange`. Panel has no
 *   internal state, no Compose button — used by the editor's Braille
 *   tool as a properties editor for the selected canvas object.
 *
 * @public
 */
export function BraillePanel({
  onCompose,
  initialText = "",
  initialCharSpacingMm = MARBURG_MEDIUM.charSpacingMm,
  value,
  onChange,
}: BraillePanelProps) {
  const controlled = value !== undefined && onChange !== undefined;
  const [internalText, setInternalText] = useState(initialText);
  const [internalCharSpacingMm, setInternalCharSpacingMm] = useState(initialCharSpacingMm);
  const text = controlled ? value.text : internalText;
  const charSpacingMm = controlled ? value.charSpacingMm : internalCharSpacingMm;
  const setText = (next: string) => {
    if (controlled) onChange({ ...value, text: next });
    else setInternalText(next);
  };
  const setCharSpacingMm = (next: number) => {
    if (controlled) onChange({ ...value, charSpacingMm: next });
    else setInternalCharSpacingMm(next);
  };

  const [lastResult, setLastResult] = useState<BrailleComposeResult | null>(null);

  function handleCompose() {
    const result = composeBraille({ text, charSpacingMm });
    setLastResult(result);
    onCompose?.(result);
  }

  return (
    <div data-testid="braille-panel" style={{ padding: "0.5rem", maxWidth: "24em" }}>
      <h3 style={{ margin: "0 0 0.5rem 0" }}>Braille (Marburg Medium)</h3>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Source text
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Braille source text"
          style={{ marginLeft: "0.5rem", width: "16em" }}
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Character spacing (mm)
        <input
          type="number"
          min="0"
          step="0.1"
          value={charSpacingMm}
          onChange={(e) => {
            const v = Number(e.target.value);
            setCharSpacingMm(Number.isNaN(v) || v <= 0 ? MARBURG_MEDIUM.charSpacingMm : v);
          }}
          aria-label="Character spacing in millimetres"
          style={{ marginLeft: "0.5rem", width: "5em" }}
        />
      </label>
      {!controlled && (
        <button type="button" onClick={handleCompose} style={primaryButtonStyle()}>
          Compose
        </button>
      )}
      {lastResult && (
        <div style={{ marginTop: "0.5rem" }}>
          <div style={{ fontFamily: "monospace", fontSize: "1.4em" }}>{lastResult.unicode}</div>
          {lastResult.unsupportedChars.length > 0 && (
            <div role="alert" style={{ marginTop: "0.25rem", color: "#a00", fontSize: "0.8em" }}>
              Skipped characters: {lastResult.unsupportedChars.join(" ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
