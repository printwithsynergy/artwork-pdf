// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 2 S1 — parametric dieline parameter panel.
 *
 * Editable controls (width / height / depth / bleed in mm) on top of
 * the active dieline. The actual *regeneration* (rebuilding the SVG
 * paths, recomputing the trim/bleed boxes, fanning the change into
 * the editor canvas) is the host's responsibility: the panel emits
 * the new parameters via `onChange` and the host wires that into
 * whatever parametric generator backs the dieline — a CF2 parser, a
 * codex-pdf carton-template macro, a synergy node, etc. This keeps
 * the editor package free of any specific dieline-generator dep.
 *
 * Pairs with `DielineTemplate.dimensions` for non-parametric library
 * templates: when a host has both, they typically render this panel
 * *only* for templates flagged parametric.
 *
 * @public
 */

import { useMemo } from "react";

/**
 * Editable dieline parameters. All values are in **mm**; the
 * conversion to PDF points happens at the regen step. `depthMm` is
 * optional because flat dielines (labels, postcards) don't carry a
 * third dimension.
 *
 * @public
 */
export type DielineParameters = {
  widthMm: number;
  heightMm: number;
  depthMm?: number;
  bleedMm: number;
};

/**
 * @public
 */
export type DielineParametersPanelProps = {
  /** Current parameters. `undefined` means "no parametric template
   *  loaded" — the panel shows a placeholder. */
  value: DielineParameters | undefined;
  /** Fires on every committed change. Hosts debounce externally if
   *  the regen step is expensive. */
  onChange: (next: DielineParameters) => void;
  /** Optional inclusive bounds for the numeric inputs. Defaults are
   *  conservative (1 - 2000 mm); hosts that ship a stricter
   *  parametric generator pass tighter bounds so the input clamps
   *  before reaching the generator. */
  minWidthMm?: number;
  maxWidthMm?: number;
  minHeightMm?: number;
  maxHeightMm?: number;
  minDepthMm?: number;
  maxDepthMm?: number;
  /** When `true`, hides the depth input even if `value.depthMm` is
   *  set. Useful for flat-only contexts (labels, postcards). */
  hideDepth?: boolean;
};

const DEFAULT_MIN_MM = 1;
const DEFAULT_MAX_MM = 2000;

/**
 * @public
 */
export function DielineParametersPanel({
  value,
  onChange,
  minWidthMm,
  maxWidthMm,
  minHeightMm,
  maxHeightMm,
  minDepthMm,
  maxDepthMm,
  hideDepth,
}: DielineParametersPanelProps) {
  const bounds = useMemo(
    () => ({
      width: {
        min: minWidthMm ?? DEFAULT_MIN_MM,
        max: maxWidthMm ?? DEFAULT_MAX_MM,
      },
      height: {
        min: minHeightMm ?? DEFAULT_MIN_MM,
        max: maxHeightMm ?? DEFAULT_MAX_MM,
      },
      depth: {
        min: minDepthMm ?? DEFAULT_MIN_MM,
        max: maxDepthMm ?? DEFAULT_MAX_MM,
      },
    }),
    [minWidthMm, maxWidthMm, minHeightMm, maxHeightMm, minDepthMm, maxDepthMm],
  );

  if (!value) {
    return (
      <div data-testid="dieline-parameters-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        Load a parametric dieline to edit its dimensions.
      </div>
    );
  }

  const set = (patch: Partial<DielineParameters>) => {
    onChange({ ...value, ...patch });
  };

  // Parse a numeric input, clamping to [min, max]. Empty / `NaN`
  // returns `null` so callers can decide what to do — width/height/
  // bleed treat that as a no-op (host keeps the last good value
  // while the user is mid-edit), so `Number("")` no longer leaks
  // `NaN` through `onChange`.
  const parseClamped = (raw: string, min: number, max: number): number | null => {
    if (raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.min(Math.max(n, min), max);
  };

  return (
    <div data-testid="dieline-parameters-panel" style={{ padding: "0.5rem" }}>
      <h3 style={{ margin: "0 0 0.5rem 0" }}>Dieline parameters</h3>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.25rem 0.5rem" }}>
        <label htmlFor="dieline-width">Width (mm)</label>
        <input
          id="dieline-width"
          type="number"
          step="0.1"
          min={bounds.width.min}
          max={bounds.width.max}
          value={value.widthMm}
          onChange={(e) => {
            const next = parseClamped(e.target.value, bounds.width.min, bounds.width.max);
            if (next !== null) set({ widthMm: next });
          }}
          aria-label="Width in millimetres"
        />
        <label htmlFor="dieline-height">Height (mm)</label>
        <input
          id="dieline-height"
          type="number"
          step="0.1"
          min={bounds.height.min}
          max={bounds.height.max}
          value={value.heightMm}
          onChange={(e) => {
            const next = parseClamped(e.target.value, bounds.height.min, bounds.height.max);
            if (next !== null) set({ heightMm: next });
          }}
          aria-label="Height in millimetres"
        />
        {!hideDepth && (
          <>
            <label htmlFor="dieline-depth">Depth (mm)</label>
            <input
              id="dieline-depth"
              type="number"
              step="0.1"
              min={bounds.depth.min}
              max={bounds.depth.max}
              value={value.depthMm ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  // Empty input clears the depth — surfaces as
                  // `undefined` to the host so flat dielines stay flat.
                  const { depthMm: _omit, ...rest } = value;
                  onChange(rest);
                  return;
                }
                const next = parseClamped(raw, bounds.depth.min, bounds.depth.max);
                if (next !== null) set({ depthMm: next });
              }}
              aria-label="Depth in millimetres"
              placeholder="—"
            />
          </>
        )}
        <label htmlFor="dieline-bleed">Bleed (mm)</label>
        <input
          id="dieline-bleed"
          type="number"
          step="0.1"
          min={0}
          max={20}
          value={value.bleedMm}
          onChange={(e) => {
            const next = parseClamped(e.target.value, 0, 20);
            if (next !== null) set({ bleedMm: next });
          }}
          aria-label="Bleed in millimetres"
        />
      </div>
    </div>
  );
}
