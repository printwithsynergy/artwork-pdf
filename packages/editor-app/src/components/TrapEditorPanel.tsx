// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useId } from "react";

/**
 * Controlled trap-policy shape consumed by the editor. Mirrors
 * `@artworkpdf/document-model`'s `TrapPolicy` minus the runtime dep
 * (the published editor package can't pull in document-model). Keep
 * these in sync; the future structural-dedup follow-up will move both
 * into a shared types module.
 *
 * @public
 */
export type TrapEditorValue = {
  widthMm: number;
  mode?: "auto" | "spread" | "choke";
};

/**
 * @public
 */
export type TrapEditorPanelProps = {
  /** Current policy. `undefined` means "no trap policy set" — the
   *  panel renders empty defaults the user can fill in. */
  value: TrapEditorValue | undefined;
  /** Fires on every committed change (slider release, select change).
   *  Hosts wire this to `document.pages[activeIdx].trapConfig` so the
   *  D1 preview overlay (PR-12) updates live as the user adjusts. */
  onChange: (next: TrapEditorValue) => void;
  /** Min width in mm. Defaults to 0 (no trap). */
  minMm?: number;
  /** Max width in mm. Defaults to 1.0 — typical maximum for press
   *  trapping. Hosts can raise for specialty work. */
  maxMm?: number;
  /** Step in mm. Defaults to 0.01 mm (one hundredth-millimeter) so
   *  fine-grain edits feel natural. */
  stepMm?: number;
};

/**
 * D2 interactive trap-policy editor.
 *
 * Controlled component: takes the current `TrapEditorValue` and emits
 * the next one on every committed change. Surfaces the two fields the
 * Wave 1 `TrapPolicy` shape supports today — `widthMm` (0–1 mm) and
 * `mode` (`auto` / `spread` / `choke`). Per-edge (top/right/bottom/
 * left) and per-color-pair tables are wired in a follow-up once the
 * compile-pdf trap producer exposes them; the panel layout reserves
 * space for those without committing to their final shape.
 *
 * Renders no chrome of its own — hosts wrap it in whatever modal /
 * drawer / right-rail container fits their layout (matches
 * `JobSetupPanel`'s embedding convention).
 *
 * @public
 */
export function TrapEditorPanel({
  value,
  onChange,
  minMm = 0,
  maxMm = 1,
  stepMm = 0.01,
}: TrapEditorPanelProps) {
  const widthId = useId();
  const modeId = useId();
  const current: TrapEditorValue = value ?? { widthMm: 0.144, mode: "auto" };

  const updateWidth = (next: number) => {
    // Clamp to the configured range so a stray pointer-up at the
    // slider edges doesn't propagate an out-of-range value.
    const clamped = Math.max(minMm, Math.min(maxMm, next));
    onChange({ ...current, widthMm: clamped });
  };

  const updateMode = (next: NonNullable<TrapEditorValue["mode"]>) => {
    onChange({ ...current, mode: next });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "0.75rem",
        fontSize: "0.85rem",
        color: "#1f2937",
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        minWidth: 240,
      }}
    >
      <label htmlFor={widthId} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span style={{ fontWeight: 600 }}>Trap width</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            id={widthId}
            type="range"
            min={minMm}
            max={maxMm}
            step={stepMm}
            value={current.widthMm}
            onChange={(e) => updateWidth(Number.parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span
            style={{
              minWidth: "3.5rem",
              textAlign: "right",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "0.75rem",
            }}
          >
            {current.widthMm.toFixed(3)} mm
          </span>
        </div>
      </label>

      <label htmlFor={modeId} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span style={{ fontWeight: 600 }}>Mode</span>
        <select
          id={modeId}
          value={current.mode ?? "auto"}
          onChange={(e) => updateMode(e.target.value as NonNullable<TrapEditorValue["mode"]>)}
          style={{
            padding: "0.25rem 0.5rem",
            fontSize: "0.8rem",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            background: "#ffffff",
          }}
        >
          <option value="auto">Auto (density-based)</option>
          <option value="spread">Spread (lighter into darker)</option>
          <option value="choke">Choke (darker into lighter)</option>
        </select>
      </label>

      <p
        style={{
          margin: 0,
          fontSize: "0.7rem",
          color: "#6b7280",
          lineHeight: 1.4,
        }}
      >
        Per-edge and per-color-pair overrides land in a future revision once the compile-pdf trap
        producer exposes them.
      </p>
    </div>
  );
}
