// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Shared form controls for the per-type properties panels
 * ({@link RectPropertiesPanel}, {@link EllipsePropertiesPanel},
 * {@link TextPropertiesPanel}, {@link ImagePropertiesPanel},
 * {@link PathPropertiesPanel}). Pulled into their own module so the
 * five panels stay focused on their domain shape while sharing one
 * visual language (dark-theme inputs that match
 * {@link RightRailAccordion}'s `BG / PANEL_BG / BORDER / BRAND`
 * vocabulary).
 *
 * The controls are intentionally minimal — no library dependencies,
 * inline styles, and a uniform `LabeledRow` chrome so every property
 * panel renders the same shape (label on the left, control on the
 * right). Hosts that want fully bespoke property surfaces import the
 * panels' controlled-mode contracts directly and skip these helpers.
 *
 * @internal
 */

import type { CSSProperties, ReactNode } from "react";

const BG = "#120a05";
const BORDER = "#3d1a00";
const TEXT = "#f4ece6";
const MUTED = "#9c9c9c";
const BRAND = "#fc5102";

const ROW_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.65rem",
  padding: "0.32rem 0.65rem",
  fontSize: "0.75rem",
  color: TEXT,
};

const LABEL_STYLE: CSSProperties = {
  width: 88,
  color: MUTED,
  fontSize: "0.7rem",
  fontWeight: 500,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
  flexShrink: 0,
};

const INPUT_STYLE: CSSProperties = {
  background: BG,
  border: `1px solid ${BORDER}`,
  color: TEXT,
  borderRadius: 3,
  padding: "0.25rem 0.4rem",
  fontSize: "0.78rem",
  fontFamily: "inherit",
  minWidth: 0,
  flex: 1,
};

export function LabeledRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={ROW_STYLE}>
      <span style={LABEL_STYLE}>{label}</span>
      {children}
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  ariaLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => {
        const parsed = Number.parseFloat(e.target.value);
        if (Number.isFinite(parsed)) onChange(parsed);
      }}
      {...(min !== undefined ? { min } : {})}
      {...(max !== undefined ? { max } : {})}
      {...(step !== undefined ? { step } : {})}
      {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
      style={INPUT_STYLE}
    />
  );
}

export function RangeInput({
  value,
  onChange,
  min,
  max,
  step,
  ariaLabel,
  showPct,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
  ariaLabel?: string;
  /** When true, render a trailing "%" readout (0..1 → 0..100%). */
  showPct?: boolean;
}) {
  return (
    <>
      <input
        type="range"
        value={Number.isFinite(value) ? value : min}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
        style={{ flex: 1, accentColor: BRAND }}
      />
      <span style={{ color: MUTED, fontSize: "0.72rem", minWidth: 36, textAlign: "right" }}>
        {showPct ? `${Math.round(value * 100)}%` : value.toFixed(step < 1 ? 2 : 0)}
      </span>
    </>
  );
}

export function ColorInput({
  value,
  onChange,
  allowTransparent,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  allowTransparent?: boolean;
  ariaLabel?: string;
}) {
  const isTransparent = value === "transparent";
  return (
    <>
      <input
        type="color"
        value={isTransparent ? "#ffffff" : value}
        onChange={(e) => onChange(e.target.value)}
        {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
        style={{
          width: 28,
          height: 22,
          border: `1px solid ${BORDER}`,
          borderRadius: 3,
          padding: 0,
          background: "none",
          cursor: "pointer",
        }}
      />
      <code
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: "0.72rem",
          color: MUTED,
          minWidth: 70,
        }}
      >
        {isTransparent ? "transparent" : value}
      </code>
      {allowTransparent ? (
        <button
          type="button"
          onClick={() => onChange(isTransparent ? "#000000" : "transparent")}
          aria-pressed={isTransparent}
          style={{
            background: isTransparent ? "rgba(252,81,2,0.12)" : "transparent",
            border: `1px solid ${BORDER}`,
            color: isTransparent ? BRAND : MUTED,
            borderRadius: 3,
            padding: "0.15rem 0.5rem",
            fontSize: "0.7rem",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          None
        </button>
      ) : null}
    </>
  );
}

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  ariaLabel?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
      style={{
        ...INPUT_STYLE,
        appearance: "auto",
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function ToggleGroup<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  ariaLabel?: string;
}) {
  return (
    <div
      style={{ display: "inline-flex", border: `1px solid ${BORDER}`, borderRadius: 3, flex: 1 }}
      // biome-ignore lint/a11y/useSemanticElements: a button-toggle group is semantically role="group", not a <fieldset> (no form controls inside, no <legend>).
      role="group"
      {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            style={{
              flex: 1,
              background: active ? "rgba(252,81,2,0.18)" : "transparent",
              border: "none",
              color: active ? BRAND : TEXT,
              padding: "0.25rem 0.4rem",
              fontSize: "0.72rem",
              fontFamily: "inherit",
              cursor: "pointer",
              borderRight: `1px solid ${BORDER}`,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export const PROPERTY_PANEL_STYLES = {
  BG,
  BORDER,
  TEXT,
  MUTED,
  BRAND,
} as const;
