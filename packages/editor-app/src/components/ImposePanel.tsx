// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useId } from "react";

/**
 * Wire-shape mirror of `apps/service`'s `ImposeTemplate`. Kept inline
 * here so the published editor package has no runtime dep on
 * `apps/service`; the structural duplication is intentional — a
 * future refactor may centralize this in `@artworkpdf/document-model`.
 *
 * Sheet size is in PDF points (1 pt = 1/72 in) to match the wire
 * boundary; the panel renders human-friendly mm read-outs but stores
 * points so the value can be POSTed to compile-pdf unchanged.
 *
 * @public
 */
export type ImposePanelValue = {
  sheetWidthPt: number;
  sheetHeightPt: number;
  rows: number;
  cols: number;
  pageMapping?: "sequential" | "repeat";
  gutterMm?: number;
  marginMm?: number;
  registrationMarks?: boolean;
  cropMarks?: boolean;
};

/**
 * Pre-populated sheet presets. PDF-points dimensions match standard
 * commercial press sheet sizes used by the dieline library and
 * impose policies. Hosts can add custom presets via the `presets`
 * prop without losing the defaults.
 *
 * @public
 */
export type ImposePanelPreset = {
  /** Stable id, used as the `<option>` value. */
  id: string;
  /** Human label rendered in the dropdown. */
  label: string;
  widthPt: number;
  heightPt: number;
};

const DEFAULT_PRESETS: readonly ImposePanelPreset[] = [
  // Letter (8.5 × 11 in) — 612 × 792 pt
  { id: "letter", label: "Letter (8.5 × 11 in)", widthPt: 612, heightPt: 792 },
  // Tabloid (11 × 17 in) — 792 × 1224 pt
  { id: "tabloid", label: "Tabloid (11 × 17 in)", widthPt: 792, heightPt: 1224 },
  // SRA3 (320 × 450 mm) — commercial digital press standard
  { id: "sra3", label: "SRA3 (320 × 450 mm)", widthPt: 907.09, heightPt: 1275.59 },
  // 28 × 40 in offset sheet
  { id: "offset-28x40", label: "Offset sheet (28 × 40 in)", widthPt: 2016, heightPt: 2880 },
];

/**
 * @public
 */
export type ImposePanelProps = {
  /** Current template. `undefined` means "no impose configured" —
   *  the panel renders preset defaults the user can fill in. */
  value: ImposePanelValue | undefined;
  /** Fires on every change to any field (sheet picker, spinner,
   *  toggle, radio). Hosts wire this to the job's `imposeTemplate`
   *  field on submission. */
  onChange: (next: ImposePanelValue) => void;
  /** Override the default sheet-size dropdown. The first preset is
   *  used as the initial value when `value` is `undefined`. */
  presets?: readonly ImposePanelPreset[];
};

const MM_PER_PT = 25.4 / 72;

function ptToMm(pt: number): number {
  return pt * MM_PER_PT;
}

/**
 * O1 sheet-imposition builder.
 *
 * Controlled component: surfaces sheet size, rows × cols, gutter /
 * margin in mm, and registration / crop-mark toggles. Renders no
 * chrome of its own — hosts wrap it in a modal, drawer, or
 * right-rail container (matches the `JobSetupPanel` / `TrapEditorPanel`
 * convention).
 *
 * Wire shape uses PDF points everywhere; the panel converts to mm
 * for display so values can be POSTed to compile-pdf's
 * `/v1/impose/apply` endpoint without rescaling.
 *
 * @public
 */
export function ImposePanel({ value, onChange, presets = DEFAULT_PRESETS }: ImposePanelProps) {
  const sheetId = useId();
  const rowsId = useId();
  const colsId = useId();
  const gutterId = useId();
  const marginId = useId();
  const mappingName = useId();

  const firstPreset = presets[0] ?? DEFAULT_PRESETS[0];
  if (!firstPreset) {
    // Should be unreachable: DEFAULT_PRESETS is non-empty. Defensive
    // fallback keeps TypeScript happy without a non-null assertion.
    throw new Error("ImposePanel: presets must contain at least one entry");
  }

  const current: ImposePanelValue = value ?? {
    sheetWidthPt: firstPreset.widthPt,
    sheetHeightPt: firstPreset.heightPt,
    rows: 2,
    cols: 2,
    pageMapping: "sequential",
  };

  const update = (patch: Partial<ImposePanelValue>) => onChange({ ...current, ...patch });

  // Match the currently-selected preset by exact point dimensions;
  // falls back to "custom" when the user has edited away from a
  // preset (e.g. via a host-injected custom sheet).
  const selectedPresetId =
    presets.find((p) => p.widthPt === current.sheetWidthPt && p.heightPt === current.sheetHeightPt)
      ?.id ?? "custom";

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
        minWidth: 280,
      }}
    >
      <label htmlFor={sheetId} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span style={{ fontWeight: 600 }}>Sheet size</span>
        <select
          id={sheetId}
          value={selectedPresetId}
          onChange={(e) => {
            const next = presets.find((p) => p.id === e.target.value);
            if (next) update({ sheetWidthPt: next.widthPt, sheetHeightPt: next.heightPt });
          }}
          style={selectStyle}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          {selectedPresetId === "custom" && (
            <option value="custom">
              Custom ({ptToMm(current.sheetWidthPt).toFixed(0)} ×{" "}
              {ptToMm(current.sheetHeightPt).toFixed(0)} mm)
            </option>
          )}
        </select>
      </label>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <label
          htmlFor={rowsId}
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}
        >
          <span style={{ fontWeight: 600 }}>Rows</span>
          <input
            id={rowsId}
            type="number"
            min={1}
            max={32}
            step={1}
            value={current.rows}
            onChange={(e) =>
              update({ rows: Math.max(1, Number.parseInt(e.target.value || "1", 10)) })
            }
            style={numberStyle}
          />
        </label>
        <label
          htmlFor={colsId}
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}
        >
          <span style={{ fontWeight: 600 }}>Columns</span>
          <input
            id={colsId}
            type="number"
            min={1}
            max={32}
            step={1}
            value={current.cols}
            onChange={(e) =>
              update({ cols: Math.max(1, Number.parseInt(e.target.value || "1", 10)) })
            }
            style={numberStyle}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <label
          htmlFor={gutterId}
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}
        >
          <span style={{ fontWeight: 600 }}>Gutter (mm)</span>
          <input
            id={gutterId}
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={current.gutterMm ?? 0}
            onChange={(e) =>
              update({ gutterMm: Math.max(0, Number.parseFloat(e.target.value || "0")) })
            }
            style={numberStyle}
          />
        </label>
        <label
          htmlFor={marginId}
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}
        >
          <span style={{ fontWeight: 600 }}>Margin (mm)</span>
          <input
            id={marginId}
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={current.marginMm ?? 0}
            onChange={(e) =>
              update({ marginMm: Math.max(0, Number.parseFloat(e.target.value || "0")) })
            }
            style={numberStyle}
          />
        </label>
      </div>

      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, padding: 0, marginBottom: "0.25rem" }}>
          Page mapping
        </legend>
        <div style={{ display: "flex", gap: "1rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <input
              type="radio"
              name={mappingName}
              value="sequential"
              checked={(current.pageMapping ?? "sequential") === "sequential"}
              onChange={() => update({ pageMapping: "sequential" })}
            />
            Sequential
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <input
              type="radio"
              name={mappingName}
              value="repeat"
              checked={current.pageMapping === "repeat"}
              onChange={() => update({ pageMapping: "repeat" })}
            />
            Repeat page 0
          </label>
        </div>
      </fieldset>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <input
            type="checkbox"
            checked={current.registrationMarks ?? false}
            onChange={(e) => update({ registrationMarks: e.target.checked })}
          />
          Registration marks
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <input
            type="checkbox"
            checked={current.cropMarks ?? false}
            onChange={(e) => update({ cropMarks: e.target.checked })}
          />
          Crop marks
        </label>
      </div>
    </div>
  );
}

const selectStyle = {
  padding: "0.25rem 0.5rem",
  fontSize: "0.8rem",
  border: "1px solid #d1d5db",
  borderRadius: 4,
  background: "#ffffff",
} as const;

const numberStyle = {
  padding: "0.25rem 0.5rem",
  fontSize: "0.8rem",
  border: "1px solid #d1d5db",
  borderRadius: 4,
  background: "#ffffff",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;
