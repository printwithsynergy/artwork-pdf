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
 * Props for {@link EllipsePropertiesPanel}.
 *
 * @public
 */
export type EllipsePropertiesPanelProps = {
  /** The currently-selected ellipse-typed canvas object. */
  value: CanvasObj;
  /** Patch-style update — only the changed fields are sent. */
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
  return arr[0] !== undefined && arr[0] < 2 ? "dotted" : "dashed";
}

function dashArrayFor(preset: "solid" | "dashed" | "dotted"): number[] | undefined {
  if (preset === "solid") return undefined;
  if (preset === "dashed") return [6, 4];
  return [1, 3];
}

/**
 * Selection-aware properties panel for ellipse canvas objects.
 *
 * Same vocabulary as {@link RectPropertiesPanel} minus corner-radius
 * (N/A for an ellipse): fill, stroke (colour + width + dash),
 * opacity. Geometry stays in the bottom Properties footer.
 *
 * Arc / pie endpoints (an advanced Illustrator-style affordance) are
 * deliberately deferred — the wire model would need new fields and
 * the dieline-export side-effects are non-trivial.
 *
 * @public
 */
export function EllipsePropertiesPanel({
  value,
  onChange,
}: EllipsePropertiesPanelProps): ReactElement {
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
            onChange({ strokeDashArray: dash } as Partial<CanvasObj>);
          }}
          options={DASH_PRESETS}
          ariaLabel="Stroke dash style"
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
