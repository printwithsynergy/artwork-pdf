// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import type { CSSProperties } from "react";

/**
 * Props for the X2 history-scrubber panel.
 *
 * The panel is purely presentational — EditorCanvas owns the
 * snapshot stack + the active cursor and threads them in via these
 * props. `onSelect(idx)` seeks the canvas to the chosen snapshot;
 * stack depth is derived from `objectCounts.length` (single source
 * of truth — no separate `entries` prop to keep in sync).
 *
 * `cursor` is 0-indexed; row 0 is the initial canvas state, row N
 * is the most recent commit.
 *
 * @public
 */
export type HistoryPanelProps = {
  /** 0-indexed position of the active snapshot. */
  cursor: number;
  /** Per-snapshot object count, in stack order. Length defines the
   *  number of rows; the array itself drives the per-row count chip. */
  objectCounts: number[];
  /** Click handler — seek the canvas to the given snapshot index. */
  onSelect: (idx: number) => void;
};

const PANEL_BG = "#1a0f08";
const BORDER = "#3d1a00";
const BRAND = "#fc5102";
const TEXT = "#f4ece6";
const MUTED = "#888";

const headerStyle: CSSProperties = {
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: MUTED,
  padding: "0.55rem 0.85rem",
  borderBottom: `1px solid ${BORDER}`,
  fontFamily: "inherit",
};

const rowBaseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "0.4rem 0.85rem",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "0.78rem",
  textAlign: "left",
};

/**
 * Vertical list of history snapshots. The newest entry sits at the
 * top; the active cursor is highlighted with the brand color.
 *
 * Stack-size cap is enforced upstream in `EditorCanvas` (see the
 * 100-snapshot ceiling in `commit()`); rendering the entire list
 * here is cheap because the cap keeps the row count bounded.
 *
 * @returns An `<aside>` element containing the history header and
 *   one `<button>` per snapshot. Each button is keyed by its
 *   snapshot index and reports `aria-current="step"` when it is the
 *   active cursor.
 * @public
 */
export function HistoryPanel({ cursor, objectCounts, onSelect }: HistoryPanelProps) {
  // Render newest → oldest so the most-recent action is at the top
  // (mirrors the canvas's "future-of-undo is at the top of the
  // stack" mental model). Stack depth comes from objectCounts.length
  // — single source of truth.
  const entries = objectCounts.length;
  const indices = Array.from({ length: entries }, (_, i) => entries - 1 - i);

  return (
    <aside
      style={{
        width: 200,
        background: PANEL_BG,
        borderLeft: `1px solid ${BORDER}`,
        color: TEXT,
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
        flexShrink: 0,
      }}
    >
      <div style={headerStyle}>History · {entries} steps</div>
      {indices.map((idx) => {
        const active = idx === cursor;
        const count = objectCounts[idx] ?? 0;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(idx)}
            aria-current={active ? "step" : undefined}
            style={{
              ...rowBaseStyle,
              background: active ? "#241308" : "transparent",
              color: active ? BRAND : TEXT,
              borderLeft: active ? `2px solid ${BRAND}` : "2px solid transparent",
            }}
          >
            <span>Step {idx}</span>
            <span style={{ color: MUTED, fontSize: "0.72rem" }}>{count} obj</span>
          </button>
        );
      })}
    </aside>
  );
}
