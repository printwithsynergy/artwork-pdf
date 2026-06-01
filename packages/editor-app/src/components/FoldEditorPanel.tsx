// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 2 S4 (PR-4) — interactive fold editor.
 *
 * Surfaces each fold edge in `FoldConfig` as a row with an angle
 * slider, plus an OCG-style "show folded" toggle that hosts wire to
 * the {@link FoldPreviewOverlay}'s active vs. flat view. Editing is
 * controlled (`value` / `onChange`); the panel never owns state.
 *
 * Pairs with PR-3's `FoldPreviewOverlay` — the slider here updates
 * `FoldConfig.edges[*].angleDeg`, and the overlay re-renders the
 * Three.js scene on every commit.
 *
 * Designed to stay consumable without `@artworkpdf/document-model`:
 * the value shape (`FoldEditorPanelValue`) mirrors the document-model
 * `FoldConfig` field-for-field, same convention as
 * `EditorSeparation`, `FoldGeometryPanelMetadata`,
 * `EditorDielinePanel`.
 *
 * @public
 */

/**
 * One fold edge between two panels.
 *
 * @public
 */
export type FoldEditorEdge = {
  id: string;
  panelA: string;
  panelB: string;
  angleDeg: number;
  direction?: "mountain" | "valley";
};

/**
 * Controlled value — mirrors document-model's `FoldConfig`.
 *
 * @public
 */
export type FoldEditorPanelValue = {
  edges: FoldEditorEdge[];
  defaultAngleDeg?: number;
};

/**
 * @public
 */
export type FoldEditorPanelProps = {
  /** Current fold configuration. `undefined` means "no panels with
   *  fold metadata" — the panel renders a placeholder. */
  value: FoldEditorPanelValue | undefined;
  /** Fires on every slider tick. Hosts debounce externally if the
   *  3D scene rebuild becomes expensive. */
  onChange: (next: FoldEditorPanelValue) => void;
  /** When `true`, the {@link FoldPreviewOverlay} should render the
   *  *folded* state; when `false`, the flat unfolded state. Pure UI
   *  state — the value-side is unaffected. */
  showFolded?: boolean;
  /** Fires when the user toggles the show-folded switch. Hosts thread
   *  this back into a top-level UI flag and pass it to the overlay. */
  onShowFoldedChange?: (next: boolean) => void;
  /** Range bounds on the angle slider, in degrees. Defaults to
   *  `[-180, 180]` — the same range `FoldConfig` permits. */
  minAngleDeg?: number;
  maxAngleDeg?: number;
};

const DEFAULT_MIN = -180;
const DEFAULT_MAX = 180;

/**
 * @public
 */
export function FoldEditorPanel({
  value,
  onChange,
  showFolded,
  onShowFoldedChange,
  minAngleDeg,
  maxAngleDeg,
}: FoldEditorPanelProps) {
  const min = minAngleDeg ?? DEFAULT_MIN;
  const max = maxAngleDeg ?? DEFAULT_MAX;

  if (!value || value.edges.length === 0) {
    return (
      <div data-testid="fold-editor-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        Load a dieline with fold metadata to edit panel angles.
      </div>
    );
  }

  const setEdgeAngle = (id: string, raw: string) => {
    // In-progress edits ("", "-", "1e") parse to `NaN` / partial
    // values — silently keep the last good angle so the user can
    // type through to a valid one. The browser owns its `<input>`
    // DOM value mid-edit, so the field still shows whatever they
    // typed even though we haven't propagated it.
    if (raw === "" || raw === "-" || raw === "+") return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(Math.max(n, min), max);
    onChange({
      ...value,
      edges: value.edges.map((e) => (e.id === id ? { ...e, angleDeg: clamped } : e)),
    });
  };

  const setEdgeDirection = (id: string, direction: "mountain" | "valley" | undefined) => {
    onChange({
      ...value,
      edges: value.edges.map((e) => {
        if (e.id !== id) return e;
        // Clearing the select drops the field entirely — restores the
        // "no direction declared" state so the renderer can fall back
        // to its own heuristic.
        if (direction === undefined) {
          const { direction: _omit, ...rest } = e;
          return rest;
        }
        return { ...e, direction };
      }),
    });
  };

  return (
    <div data-testid="fold-editor-panel" style={{ padding: "0.5rem" }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
        <h3 style={{ margin: 0 }}>Fold angles</h3>
        {onShowFoldedChange && (
          <label style={{ marginLeft: "auto", fontSize: "0.85rem" }}>
            <input
              type="checkbox"
              checked={!!showFolded}
              onChange={(e) => onShowFoldedChange(e.target.checked)}
              aria-label="Show folded preview"
            />{" "}
            Show folded
          </label>
        )}
      </header>
      <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0 0" }}>
        {value.edges.map((edge) => (
          <li
            key={edge.id}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto auto",
              gap: "0.5rem",
              alignItems: "center",
              padding: "0.25rem 0",
            }}
          >
            <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
              {edge.panelA} ↔ {edge.panelB}
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={1}
              value={edge.angleDeg}
              onChange={(e) => setEdgeAngle(edge.id, e.target.value)}
              aria-label={`Angle for ${edge.id}`}
            />
            <input
              type="number"
              min={min}
              max={max}
              step={1}
              value={edge.angleDeg}
              onChange={(e) => setEdgeAngle(edge.id, e.target.value)}
              aria-label={`Numeric angle for ${edge.id}`}
              style={{ width: "4rem" }}
            />
            <select
              value={edge.direction ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "mountain" || v === "valley") {
                  setEdgeDirection(edge.id, v);
                } else if (v === "") {
                  setEdgeDirection(edge.id, undefined);
                }
              }}
              aria-label={`Fold direction for ${edge.id}`}
            >
              <option value="">—</option>
              <option value="mountain">mountain</option>
              <option value="valley">valley</option>
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
