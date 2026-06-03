// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import type { ReactElement } from "react";
import type { CanvasObj } from "./EditorCanvas";
import {
  ColorInput,
  LabeledRow,
  NumberInput,
  RangeInput,
  SelectInput,
} from "./properties-controls";

/**
 * Props for {@link RectPropertiesPanel}.
 *
 * @public
 */
export type RectPropertiesPanelProps = {
  /** The currently-selected rect-typed canvas object. */
  value: CanvasObj;
  /** Patch-style update — only the changed fields are sent. The host
   *  applies the patch to `canvasObj` via {@link
   *  EditorCanvas}'s `updateSelected` helper. */
  onChange: (patch: Partial<CanvasObj>) => void;
};

const DASH_PRESETS: ReadonlyArray<{ value: "solid" | "dashed" | "dotted"; label: string }> = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
];

function dashPreset(arr?: number[]): "solid" | "dashed" | "dotted" {
  if (!arr || arr.length === 0) return "solid";
  if (arr[0] === 6 && arr[1] === 4) return "dashed";
  if (arr[0] === 1 && arr[1] === 3) return "dotted";
  // Custom patterns surface as the closest preset based on first
  // segment ratio — keeps the dropdown a stable enum.
  return arr[0] !== undefined && arr[0] < 2 ? "dotted" : "dashed";
}

function dashArrayFor(preset: "solid" | "dashed" | "dotted"): number[] | undefined {
  if (preset === "solid") return undefined;
  if (preset === "dashed") return [6, 4];
  return [1, 3];
}

/**
 * Selection-aware properties panel for rectangle canvas objects.
 *
 * Surfaces Illustrator-grade rect properties: fill (with "no fill"
 * toggle), stroke (colour + width + dash style), corner radius, and
 * opacity. Geometry (X / Y / W / H / rotation) is intentionally
 * **not** duplicated here — the slim bottom Properties footer owns
 * that vocabulary so the right rail stays focused on the per-type
 * "what makes a rect distinct" knobs.
 *
 * Controlled-mode contract: every form edit dispatches a
 * {@link Partial<CanvasObj>} patch via {@link
 * RectPropertiesPanelProps.onChange}; the panel keeps no internal
 * state.
 *
 * @public
 */
export function RectPropertiesPanel({ value, onChange }: RectPropertiesPanelProps): ReactElement {
  const cornerMax = Math.max(2, Math.floor(Math.min(value.width, value.height) / 2));
  const preset = dashPreset(value.strokeDashArray);

  return (
    <div style={{ padding: "0.4rem 0" }}>
      <LabeledRow label="Fill">
        <ColorInput
          value={value.fill}
          onChange={(fill) => onChange({ fill })}
          allowTransparent
          ariaLabel="Fill colour"
        />
      </LabeledRow>

      <LabeledRow label="Stroke">
        <ColorInput
          value={value.stroke}
          onChange={(stroke) => onChange({ stroke })}
          allowTransparent
          ariaLabel="Stroke colour"
        />
      </LabeledRow>

      <LabeledRow label="Stroke W">
        <NumberInput
          value={value.strokeWidth}
          min={0}
          step={0.5}
          ariaLabel="Stroke width"
          onChange={(strokeWidth) => onChange({ strokeWidth: Math.max(0, strokeWidth) })}
        />
      </LabeledRow>

      <LabeledRow label="Dash">
        <SelectInput
          value={preset}
          onChange={(next) => {
            const dash = dashArrayFor(next);
            // `exactOptionalPropertyTypes` rejects setting an optional
            // field to undefined; cast to allow the "clear dash"
            // path. At runtime the spread leaves the field undefined
            // which Konva treats as "solid stroke".
            onChange({ strokeDashArray: dash } as Partial<CanvasObj>);
          }}
          options={DASH_PRESETS}
          ariaLabel="Stroke dash style"
        />
      </LabeledRow>

      <LabeledRow label="Corner R">
        <RangeInput
          value={value.cornerRadius ?? 0}
          min={0}
          max={cornerMax}
          step={1}
          ariaLabel="Corner radius"
          onChange={(cornerRadius) => onChange({ cornerRadius })}
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
    </div>
  );
}
