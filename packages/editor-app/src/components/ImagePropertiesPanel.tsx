// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import type { ReactElement } from "react";
import type { CanvasObj } from "./EditorCanvas";
import { LabeledRow, PROPERTY_PANEL_STYLES, RangeInput, SelectInput } from "./properties-controls";

/**
 * Props for {@link ImagePropertiesPanel}.
 *
 * @public
 */
export type ImagePropertiesPanelProps = {
  /** The currently-selected image-typed canvas object. */
  value: CanvasObj;
  /** Patch-style update — only the changed fields are sent. */
  onChange: (patch: Partial<CanvasObj>) => void;
  /** Optional callback to open the host's image-replace flow (opens
   *  the editor's hidden `<input type="file">`). Wired by
   *  EditorCanvas so the panel can host a "Replace…" button without
   *  re-creating the file-picker plumbing. */
  onReplace?: () => void;
};

const FIT_OPTIONS: ReadonlyArray<{
  value: "fill" | "contain" | "cover" | "none";
  label: string;
}> = [
  { value: "fill", label: "Fill" },
  { value: "contain", label: "Contain" },
  { value: "cover", label: "Cover" },
  { value: "none", label: "None" },
];

/**
 * Selection-aware properties panel for image canvas objects.
 *
 * Surfaces the image-specific knobs Illustrator's Properties panel
 * exposes: object-fit (CSS-style fit modes), opacity, and a
 * "Replace…" affordance for swapping the underlying bitmap. Geometry
 * stays in the bottom Properties footer.
 *
 * @public
 */
export function ImagePropertiesPanel({
  value,
  onChange,
  onReplace,
}: ImagePropertiesPanelProps): ReactElement {
  const fit = value.imageFit ?? "fill";

  return (
    <div style={{ padding: "0.4rem 0" }}>
      <LabeledRow label="Fit">
        <SelectInput
          value={fit}
          onChange={(imageFit) => onChange({ imageFit })}
          options={FIT_OPTIONS}
          ariaLabel="Object fit mode"
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

      {value.src ? (
        <div
          style={{
            padding: "0.4rem 0.65rem 0.2rem",
            color: PROPERTY_PANEL_STYLES.MUTED,
            fontSize: "0.7rem",
          }}
        >
          <span style={{ display: "block", marginBottom: "0.25rem" }}>Source</span>
          <code
            style={{
              display: "block",
              padding: "0.2rem 0.4rem",
              background: PROPERTY_PANEL_STYLES.BG,
              border: `1px solid ${PROPERTY_PANEL_STYLES.BORDER}`,
              borderRadius: 3,
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.7rem",
              color: PROPERTY_PANEL_STYLES.TEXT,
              wordBreak: "break-all",
              overflowWrap: "anywhere",
              maxHeight: "3.4rem",
              overflowY: "auto",
            }}
          >
            {value.src.startsWith("data:") ? `${value.src.slice(0, 32)}… (embedded)` : value.src}
          </code>
        </div>
      ) : null}

      {onReplace ? (
        <div style={{ padding: "0.4rem 0.65rem 0.2rem" }}>
          <button
            type="button"
            onClick={onReplace}
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
            Replace image…
          </button>
        </div>
      ) : null}
    </div>
  );
}
