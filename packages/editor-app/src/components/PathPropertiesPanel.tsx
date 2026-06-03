// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import type { ReactElement } from "react";
import type { CanvasObj } from "./EditorCanvas";
import { LabeledRow, PROPERTY_PANEL_STYLES, RangeInput } from "./properties-controls";

/**
 * Props for {@link PathPropertiesPanel}.
 *
 * @public
 */
export type PathPropertiesPanelProps = {
  /** The currently-selected path-typed canvas object. */
  value: CanvasObj;
  /** Patch-style update — only the changed fields are sent. The
   *  path panel restricts edits to opacity; stroke colour is
   *  semantic (cut / crease / perf / bleed) on imported dieline
   *  paths and is surfaced read-only. */
  onChange: (patch: Partial<CanvasObj>) => void;
};

/**
 * Selection-aware properties panel for path canvas objects.
 *
 * Dieline paths carry production semantics in their stroke colour
 * (cut / crease / perf / bleed per `DIELINE_PATH_STROKES`); editing
 * the colour would destroy that contract, so the panel surfaces it
 * read-only along with the stroke width. The only safe live edit is
 * opacity (and only because the dieline overlay is rendered atop the
 * artwork — fading it lets users see what's underneath).
 *
 * Locked-state and the live lock indicator come from
 * {@link CanvasObj.locked}; locked paths can't be selected from the
 * canvas anyway, but the indicator surfaces the state when a path
 * is selected programmatically (Layers panel click).
 *
 * @public
 */
export function PathPropertiesPanel({ value, onChange }: PathPropertiesPanelProps): ReactElement {
  return (
    <div style={{ padding: "0.4rem 0" }}>
      <LabeledRow label="Stroke">
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            color: PROPERTY_PANEL_STYLES.MUTED,
            fontSize: "0.72rem",
          }}
        >
          <span
            aria-label="Stroke colour (read-only)"
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              border: `1px solid ${PROPERTY_PANEL_STYLES.BORDER}`,
              background: value.stroke,
              display: "inline-block",
            }}
          />
          <code style={{ fontFamily: "ui-monospace, monospace" }}>{value.stroke}</code>
          <span style={{ marginLeft: "0.4rem" }}>(structural)</span>
        </div>
      </LabeledRow>

      <LabeledRow label="Stroke W">
        <code
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.78rem",
            color: PROPERTY_PANEL_STYLES.MUTED,
          }}
        >
          {value.strokeWidth.toFixed(2)} pt
        </code>
      </LabeledRow>

      <LabeledRow label="Locked">
        <span
          style={{
            fontSize: "0.72rem",
            color: value.locked ? PROPERTY_PANEL_STYLES.BRAND : PROPERTY_PANEL_STYLES.MUTED,
          }}
        >
          {value.locked ? "Yes — geometry frozen" : "No"}
        </span>
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

      <div
        style={{
          padding: "0.4rem 0.65rem",
          fontSize: "0.7rem",
          lineHeight: 1.4,
          color: PROPERTY_PANEL_STYLES.MUTED,
        }}
      >
        Dieline paths encode structural intent — cut, crease, perforation, or bleed — through their
        stroke colour. Edit upstream (re-import the CF2/DDES/ARD source) rather than re-colouring
        here.
      </div>
    </div>
  );
}
