// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import type { ReactElement } from "react";
import type { CanvasObj } from "./EditorCanvas";
import {
  ColorInput,
  LabeledRow,
  NumberInput,
  PROPERTY_PANEL_STYLES,
  RangeInput,
  SelectInput,
  ToggleGroup,
} from "./properties-controls";

/**
 * Props for {@link TextPropertiesPanel}.
 *
 * @public
 */
export type TextPropertiesPanelProps = {
  /** The currently-selected text-typed canvas object. */
  value: CanvasObj;
  /** Patch-style update — only the changed fields are sent. */
  onChange: (patch: Partial<CanvasObj>) => void;
  /** Optional callback to open the inline text-edit overlay (focuses
   *  a textarea over the Konva node). Wired by the host to
   *  EditorCanvas's `onTextDblClick` helper so the panel can host an
   *  "Edit text" button without re-implementing the overlay. */
  onEditText?: () => void;
};

const FONT_FAMILIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "Helvetica", label: "Helvetica" },
  { value: "Arial", label: "Arial" },
  { value: "Times", label: "Times" },
  { value: "Courier", label: "Courier" },
];

const ALIGN_OPTIONS: ReadonlyArray<{
  value: "left" | "center" | "right" | "justify";
  label: string;
}> = [
  { value: "left", label: "L" },
  { value: "center", label: "C" },
  { value: "right", label: "R" },
  { value: "justify", label: "J" },
];

const VALIGN_OPTIONS: ReadonlyArray<{ value: "top" | "middle" | "bottom"; label: string }> = [
  { value: "top", label: "T" },
  { value: "middle", label: "M" },
  { value: "bottom", label: "B" },
];

const DECORATION_OPTIONS: ReadonlyArray<{
  value: "none" | "underline" | "line-through";
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "underline", label: "U" },
  { value: "line-through", label: "S" },
];

/**
 * Selection-aware properties panel for text canvas objects.
 *
 * Illustrator-grade character + paragraph controls: font family,
 * size, weight (regular / bold) + italic toggle, text decoration,
 * horizontal + vertical alignment, letter-spacing, line-height, fill
 * colour, opacity, and an "Edit text" affordance that delegates to
 * the host's inline-edit overlay.
 *
 * @public
 */
export function TextPropertiesPanel({
  value,
  onChange,
  onEditText,
}: TextPropertiesPanelProps): ReactElement {
  const family = value.fontFamily ?? "Helvetica";
  const weight = value.fontWeight ?? "normal";
  const italic = value.fontStyle === "italic";
  const align = value.textAlign ?? "left";
  const valign = value.verticalAlign ?? "top";
  const decoration = value.textDecoration ?? "none";

  return (
    <div style={{ padding: "0.4rem 0" }}>
      <LabeledRow label="Font">
        <SelectInput
          value={family}
          onChange={(fontFamily) => onChange({ fontFamily })}
          options={FONT_FAMILIES}
          ariaLabel="Font family"
        />
      </LabeledRow>

      <LabeledRow label="Size">
        <NumberInput
          value={value.fontSize ?? 16}
          min={4}
          step={1}
          ariaLabel="Font size"
          onChange={(fontSize) => onChange({ fontSize: Math.max(4, fontSize) })}
        />
      </LabeledRow>

      <LabeledRow label="Style">
        <ToggleGroup
          value={weight === "bold" ? "bold" : "normal"}
          onChange={(next) => onChange({ fontWeight: next })}
          options={[
            { value: "normal", label: "Regular" },
            { value: "bold", label: "Bold" },
          ]}
          ariaLabel="Font weight"
        />
        <button
          type="button"
          onClick={() => onChange({ fontStyle: italic ? "normal" : "italic" })}
          aria-pressed={italic}
          aria-label="Italic"
          style={{
            background: italic ? "rgba(252,81,2,0.18)" : "transparent",
            border: `1px solid ${PROPERTY_PANEL_STYLES.BORDER}`,
            color: italic ? PROPERTY_PANEL_STYLES.BRAND : PROPERTY_PANEL_STYLES.TEXT,
            borderRadius: 3,
            padding: "0.25rem 0.55rem",
            fontStyle: "italic",
            fontSize: "0.78rem",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          I
        </button>
      </LabeledRow>

      <LabeledRow label="Decoration">
        <ToggleGroup
          value={decoration}
          onChange={(next) => onChange({ textDecoration: next })}
          options={DECORATION_OPTIONS}
          ariaLabel="Text decoration"
        />
      </LabeledRow>

      <LabeledRow label="Align">
        <ToggleGroup
          value={align}
          onChange={(next) => onChange({ textAlign: next })}
          options={ALIGN_OPTIONS}
          ariaLabel="Horizontal alignment"
        />
      </LabeledRow>

      <LabeledRow label="V-Align">
        <ToggleGroup
          value={valign}
          onChange={(next) => onChange({ verticalAlign: next })}
          options={VALIGN_OPTIONS}
          ariaLabel="Vertical alignment"
        />
      </LabeledRow>

      <LabeledRow label="Tracking">
        <NumberInput
          value={value.letterSpacing ?? 0}
          step={0.1}
          ariaLabel="Letter spacing"
          onChange={(letterSpacing) => onChange({ letterSpacing })}
        />
      </LabeledRow>

      <LabeledRow label="Leading">
        <NumberInput
          value={value.lineHeight ?? 1}
          min={0.5}
          step={0.05}
          ariaLabel="Line height multiplier"
          onChange={(lineHeight) => onChange({ lineHeight: Math.max(0.5, lineHeight) })}
        />
      </LabeledRow>

      <LabeledRow label="Colour">
        <ColorInput
          value={value.fill}
          onChange={(fill) => onChange({ fill })}
          ariaLabel="Text colour"
        />
      </LabeledRow>

      <LabeledRow label="Opacity">
        <RangeInput
          value={value.opacity}
          min={0}
          max={1}
          step={0.05}
          showPct
          ariaLabel="Opacity"
          onChange={(opacity) => onChange({ opacity })}
        />
      </LabeledRow>

      {onEditText ? (
        <div style={{ padding: "0.4rem 0.65rem 0.2rem" }}>
          <button
            type="button"
            onClick={onEditText}
            style={{
              width: "100%",
              background: "transparent",
              border: `1px solid ${PROPERTY_PANEL_STYLES.BORDER}`,
              color: PROPERTY_PANEL_STYLES.BRAND,
              borderRadius: 3,
              padding: "0.35rem 0.5rem",
              fontSize: "0.75rem",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Edit text…
          </button>
        </div>
      ) : null}
    </div>
  );
}
