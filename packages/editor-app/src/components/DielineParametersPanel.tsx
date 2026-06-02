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

import type { KeyboardEvent, ReactElement } from "react";
import { useMemo, useRef } from "react";

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
  /** Fires when the user *finishes* editing a field (input blur or
   *  Enter key). Distinct from `onChange` which fires on every
   *  keystroke. Hosts wire this into their undo stack so a 50→500
   *  width drag commits as one history entry rather than 451. */
  onCommit?: (next: DielineParameters) => void;
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
  /** When `true`, hides the live preview thumbnail. Useful for
   *  tight UI surfaces or when the host already renders its own
   *  preview elsewhere. */
  hidePreview?: boolean;
};

const DEFAULT_MIN_MM = 1;
const DEFAULT_MAX_MM = 2000;
const MAX_BLEED_MM = 20;
/** When bleed exceeds this fraction of the shorter trim dimension,
 *  the panel surfaces a warning — at 50% the bleed ring is bigger
 *  than the trim and most parametric generators reject it. */
const BLEED_WARN_FRACTION = 0.5;
/** SVG preview canvas size in CSS pixels. The dieline scales to
 *  fit; the size is fixed so the panel layout stays stable as the
 *  user changes dimensions. */
const PREVIEW_SIZE_PX = 120;

/**
 * Compute validation warnings for a set of dieline parameters.
 *
 * Exported so hosts that want to mirror the panel's validation
 * surface (e.g. a sticky banner above the canvas) can call the
 * same check function without re-implementing the rules.
 *
 * @public
 */
export function validateDielineParameters(value: DielineParameters): string[] {
  const warnings: string[] = [];
  const minTrim = Math.min(value.widthMm, value.heightMm);
  // Both checks guard on `minTrim > 0` so partial mid-edit values
  // (e.g. user clears a field momentarily) don't flash spurious
  // warnings. Once both width and height are populated, the
  // guard releases and validation fires normally.
  if (minTrim > 0 && value.bleedMm > minTrim * BLEED_WARN_FRACTION) {
    warnings.push(
      `Bleed ${value.bleedMm} mm exceeds ${(BLEED_WARN_FRACTION * 100).toFixed(0)}% of the shorter trim (${minTrim} mm) — most parametric generators will reject this.`,
    );
  }
  if (minTrim > 0 && value.depthMm !== undefined && value.depthMm > minTrim) {
    warnings.push(
      `Depth ${value.depthMm} mm exceeds the shorter trim ${minTrim} mm — the carton would not close.`,
    );
  }
  return warnings;
}

/**
 * @public
 */
export function DielineParametersPanel({
  value,
  onChange,
  onCommit,
  minWidthMm,
  maxWidthMm,
  minHeightMm,
  maxHeightMm,
  minDepthMm,
  maxDepthMm,
  hideDepth,
  hidePreview,
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

  // `warnings` recomputes only when `value` changes — the validation
  // rules don't depend on bounds so we don't pull them into the dep
  // array. Computing here (not inside the JSX) lets the empty case
  // fast-path the no-warning render.
  const warnings = useMemo(() => (value ? validateDielineParameters(value) : []), [value]);

  // Track the value as of the last commit so blur on an untouched
  // field doesn't push a duplicate history entry to the host.
  // `value` is recreated by `onChange` on every keystroke (via the
  // spread in `set`), so a reference compare is sufficient.
  const lastCommittedRef = useRef(value);

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

  const commit = () => {
    // Skip if the value hasn't changed since the last commit —
    // blur on an untouched field shouldn't fire an undo-stack
    // entry. Reference compare is safe because `set` recreates
    // the object on every keystroke.
    if (value === lastCommittedRef.current) return;
    lastCommittedRef.current = value;
    onCommit?.(value);
  };

  // Enter inside a numeric input should commit the same way blur
  // does — matches the contract documented on `onCommit` and keeps
  // keyboard-only users from being stuck in a "no commit ever
  // fires" state when they tab through fields with `Enter`.
  const commitOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit();
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
          onBlur={commit}
          onKeyDown={commitOnEnter}
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
          onBlur={commit}
          onKeyDown={commitOnEnter}
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
              onBlur={commit}
              onKeyDown={commitOnEnter}
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
          max={MAX_BLEED_MM}
          value={value.bleedMm}
          onChange={(e) => {
            const next = parseClamped(e.target.value, 0, MAX_BLEED_MM);
            if (next !== null) set({ bleedMm: next });
          }}
          onBlur={commit}
          onKeyDown={commitOnEnter}
          aria-label="Bleed in millimetres"
        />
      </div>

      {warnings.length > 0 && (
        <ul
          data-testid="dieline-parameters-warnings"
          role="alert"
          style={{
            margin: "0.5rem 0 0 0",
            padding: "0.4rem 0.6rem 0.4rem 1.2rem",
            background: "#fff8e1",
            border: "1px solid #f0c419",
            borderRadius: 4,
            color: "#8a6d00",
            fontSize: "0.85rem",
          }}
        >
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {!hidePreview && <DielineParametersPreview value={value} sizePx={PREVIEW_SIZE_PX} />}
    </div>
  );
}

/**
 * Live preview thumbnail rendered as inline SVG.
 *
 * Shows the trim box (black outline) and the bleed margin (dashed
 * red outline) scaled to fit `sizePx`. When `depthMm` is set, a
 * proportional side panel renders to the right of the trim so users
 * can see the 3D aspect at a glance. SVG (not Konva) keeps the
 * preview lightweight, screenreader-accessible, and renderable in
 * SSR contexts where a Konva Stage would need a browser canvas.
 */
function DielineParametersPreview({
  value,
  sizePx,
}: {
  value: DielineParameters;
  sizePx: number;
}): ReactElement {
  // Compute scale-to-fit so the longest outer dimension (trim +
  // bleed on both sides, plus the depth flap if present) maps to
  // `sizePx - 8` (leaving an 8px gutter for the preview frame).
  const outerWidth = value.widthMm + 2 * value.bleedMm + (value.depthMm ?? 0);
  const outerHeight = value.heightMm + 2 * value.bleedMm;
  const longestMm = Math.max(outerWidth, outerHeight, 1);
  const scale = (sizePx - 8) / longestMm;
  const trimX = 4 + value.bleedMm * scale;
  const trimY = 4 + value.bleedMm * scale;
  const trimW = value.widthMm * scale;
  const trimH = value.heightMm * scale;
  const bleedX = 4;
  const bleedY = 4;
  const bleedW = (value.widthMm + 2 * value.bleedMm) * scale;
  const bleedH = (value.heightMm + 2 * value.bleedMm) * scale;
  const depthW = (value.depthMm ?? 0) * scale;

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <svg
        data-testid="dieline-parameters-preview"
        width={sizePx}
        height={sizePx}
        viewBox={`0 0 ${sizePx} ${sizePx}`}
        role="img"
        aria-label={
          value.depthMm !== undefined
            ? `Dieline preview: ${value.widthMm} × ${value.heightMm} × ${value.depthMm} mm with ${value.bleedMm} mm bleed`
            : `Dieline preview: ${value.widthMm} × ${value.heightMm} mm with ${value.bleedMm} mm bleed`
        }
        style={{ border: "1px solid #ddd", background: "#fafafa", borderRadius: 4 }}
      >
        {value.bleedMm > 0 && (
          <rect
            x={bleedX}
            y={bleedY}
            width={bleedW}
            height={bleedH}
            fill="none"
            stroke="#d33"
            strokeDasharray="2 2"
            strokeWidth={1}
          />
        )}
        <rect
          x={trimX}
          y={trimY}
          width={trimW}
          height={trimH}
          fill="#fff"
          stroke="#222"
          strokeWidth={1}
        />
        {value.depthMm !== undefined && value.depthMm > 0 && (
          <rect
            x={trimX + trimW}
            y={trimY}
            width={depthW}
            height={trimH}
            fill="#fff"
            stroke="#222"
            strokeDasharray="3 2"
            strokeWidth={1}
          />
        )}
      </svg>
    </div>
  );
}
