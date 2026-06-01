// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { type CSSProperties, useEffect } from "react";

/**
 * Print process category. Mirrors `PrintContext.process` in
 * `@artworkpdf/document-model` — kept as a structural literal so this
 * package doesn't pull a document-model dependency.
 *
 * @public
 */
export type PrintProcess = "offset" | "flexo" | "gravure" | "digital" | "screen";

/**
 * Substrate finish category. Mirrors the document-model shape.
 * @public
 */
export type SubstrateFinish = "matte" | "gloss" | "satin" | "uncoated";

/**
 * Editable shape consumed by {@link JobSetupPanel}. Mirrors
 * `PrintContext` in `@artworkpdf/document-model`; kept structural so
 * this UI package stays consumable by hosts that don't import the
 * document-model.
 *
 * Hosts thread this in as `value` + `onChange`; the panel is a
 * controlled component — it owns no state of its own.
 *
 * @public
 */
export type JobSetupValue = {
  process: PrintProcess;
  substrate: {
    id: string;
    color: string;
    opacity: number;
    finish: SubstrateFinish;
  };
  /** ISO 3166-1 alpha-2 codes, e.g. `["US", "CA", "GB"]`. */
  targetMarkets?: string[];
  /** ICC profile name — free text in this wave; library-backed selector lands later. */
  colorProfile?: string;
  /** Total Area Coverage limit, percent (e.g. `300` for offset, `260` for newsprint). */
  tacLimit?: number;
};

/**
 * Props for the print-context modal.
 *
 * `enable_print_context: false` hides the panel entirely; mount with
 * `<JobSetupPanel />` only when {@link showFeature} returns true for
 * `print_context`.
 *
 * @public
 */
export type JobSetupPanelProps = {
  value: JobSetupValue;
  onChange: (next: JobSetupValue) => void;
  onClose: () => void;
};

const PANEL_BG = "#1a0f08";
const BORDER = "#3d1a00";
const BRAND = "#fc5102";
const TEXT = "#f4ece6";
const MUTED = "#888";

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: MUTED,
  marginBottom: "0.25rem",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.6rem",
  background: "#0f0a05",
  border: `1px solid ${BORDER}`,
  borderRadius: 4,
  color: TEXT,
  fontSize: "0.85rem",
  fontFamily: "inherit",
};

const PROCESSES: PrintProcess[] = ["offset", "flexo", "gravure", "digital", "screen"];
const FINISHES: SubstrateFinish[] = ["matte", "gloss", "satin", "uncoated"];

/**
 * Modal panel for editing a document's print context (F2).
 *
 * Renders a five-field form: process, substrate (id/color/opacity/
 * finish composite), color profile (ICC), TAC limit, and target
 * markets. Writes propagate through `onChange` immediately —
 * controlled component, no local state — so hosts can persist into
 * `document.printContext` without an explicit save step.
 *
 * @public
 */
export function JobSetupPanel({ value, onChange, onClose }: JobSetupPanelProps) {
  function patch(p: Partial<JobSetupValue>) {
    onChange({ ...value, ...p });
  }
  function patchSubstrate(p: Partial<JobSetupValue["substrate"]>) {
    onChange({ ...value, substrate: { ...value.substrate, ...p } });
  }

  // Close on Escape — matches PaletteManager pattern + standard
  // modal a11y. Focus trapping is deferred (substantial; tracked as
  // a follow-up).
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label="Job setup — print context"
      aria-modal="true"
      // Click on the backdrop (this element) closes; clicks inside
      // the inner panel stopPropagate via the panel's own handler.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: PANEL_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          padding: "1.25rem",
          width: "min(440px, 92vw)",
          maxHeight: "85vh",
          overflow: "auto",
          color: TEXT,
          fontFamily: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: BRAND }}>Job setup</h2>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close job setup"
            style={{
              background: "transparent",
              border: `1px solid ${BORDER}`,
              color: TEXT,
              borderRadius: 4,
              padding: "0.25rem 0.55rem",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "grid", gap: "0.85rem" }}>
          <div>
            <label htmlFor="js-process" style={labelStyle}>
              Print process
            </label>
            <select
              id="js-process"
              value={value.process}
              onChange={(e) => patch({ process: e.target.value as PrintProcess })}
              style={inputStyle}
            >
              {PROCESSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <fieldset
            style={{ border: `1px solid ${BORDER}`, borderRadius: 6, padding: "0.6rem 0.75rem" }}
          >
            <legend style={{ padding: "0 0.35rem", fontSize: "0.72rem", color: MUTED }}>
              Substrate
            </legend>
            <div style={{ display: "grid", gap: "0.55rem" }}>
              <div>
                <label htmlFor="js-substrate-id" style={labelStyle}>
                  Id
                </label>
                <input
                  id="js-substrate-id"
                  value={value.substrate.id}
                  onChange={(e) => patchSubstrate({ id: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem" }}>
                <div>
                  <label htmlFor="js-substrate-color" style={labelStyle}>
                    Color
                  </label>
                  <input
                    id="js-substrate-color"
                    value={value.substrate.color}
                    onChange={(e) => patchSubstrate({ color: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label htmlFor="js-substrate-opacity" style={labelStyle}>
                    Opacity (0–1)
                  </label>
                  <input
                    id="js-substrate-opacity"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={value.substrate.opacity}
                    onChange={(e) => {
                      // Empty → no-op (don't conflate "user clearing
                      // the field" with "fully transparent"). Out-of-
                      // range typed input gets clamped to [0,1]
                      // because HTML min/max only constrain the
                      // spinner, not raw keyboard input.
                      const v = e.target.value;
                      if (v === "") return;
                      const n = Number(v);
                      if (Number.isNaN(n)) return;
                      const clamped = Math.min(1, Math.max(0, n));
                      patchSubstrate({ opacity: clamped });
                    }}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="js-substrate-finish" style={labelStyle}>
                  Finish
                </label>
                <select
                  id="js-substrate-finish"
                  value={value.substrate.finish}
                  onChange={(e) => patchSubstrate({ finish: e.target.value as SubstrateFinish })}
                  style={inputStyle}
                >
                  {FINISHES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <div>
            <label htmlFor="js-icc" style={labelStyle}>
              Color profile (ICC)
            </label>
            <input
              id="js-icc"
              value={value.colorProfile ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v) {
                  patch({ colorProfile: v });
                } else {
                  const { colorProfile: _, ...rest } = value;
                  onChange(rest);
                }
              }}
              placeholder="ISOcoated_v2_eci"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="js-tac" style={labelStyle}>
              TAC limit (%)
            </label>
            <input
              id="js-tac"
              type="number"
              min="0"
              max="400"
              value={value.tacLimit ?? ""}
              onChange={(e) => {
                if (e.target.value === "") {
                  const { tacLimit: _, ...rest } = value;
                  onChange(rest);
                } else {
                  patch({ tacLimit: Number(e.target.value) });
                }
              }}
              placeholder="300"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="js-markets" style={labelStyle}>
              Target markets (comma-separated ISO 3166-1 alpha-2)
            </label>
            <input
              id="js-markets"
              value={(value.targetMarkets ?? []).join(", ")}
              onChange={(e) => {
                const parts = e.target.value
                  .split(",")
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean);
                if (parts.length > 0) {
                  patch({ targetMarkets: parts });
                } else {
                  const { targetMarkets: _, ...rest } = value;
                  onChange(rest);
                }
              }}
              placeholder="US, CA, GB"
              style={inputStyle}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
