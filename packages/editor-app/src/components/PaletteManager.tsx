// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorConfig, PaletteId } from "../lib/editor-config";
import { PALETTE_IDS, PALETTE_REGISTRY } from "../lib/palette-registry";

/**
 * Props for the desktop palette overflow menu.
 *
 * `panelVisibility` is the current state (absent / `true` entries
 * render as visible; `false` as hidden). `onChange` receives the
 * full next visibility object whenever the user toggles a row.
 *
 * `enable_palettes: false` collapses the entire menu off — hosts that
 * don't want the overflow toggle UI omit this component altogether
 * via `cfg.enable_palettes`. The mobile equivalent lives inside
 * `MobileToolDrawer` as a "Panels" section.
 *
 * @public
 */
export type PaletteManagerProps = {
  config: EditorConfig;
  panelVisibility: Partial<Record<PaletteId, boolean>>;
  onChange: (next: Partial<Record<PaletteId, boolean>>) => void;
};

const PANEL_BG = "#1a0f08";
const BORDER = "#3d1a00";
const BRAND = "#fc5102";
const TEXT = "#f4ece6";
const MUTED = "#888";

/**
 * Desktop-only overflow menu for toggling palette visibility.
 *
 * Renders nothing when `cfg.enable_palettes` is false. Closes on
 * outside-click and Escape; the toggle state is owned by the host
 * via `onChange` so visibility can be persisted (host's localStorage,
 * user-prefs API, etc.) and round-tripped on reload.
 *
 * @public
 */
export function PaletteManager({ config, panelVisibility, onChange }: PaletteManagerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (config.enable_palettes === false) return null;

  function toggle(id: PaletteId) {
    const current = panelVisibility[id] !== false;
    onChange({ ...panelVisibility, [id]: !current });
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle palettes"
        aria-expanded={open}
        style={{
          background: "transparent",
          color: TEXT,
          border: `1px solid ${BORDER}`,
          borderRadius: 4,
          padding: "0.35rem 0.65rem",
          fontSize: "0.78rem",
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Panels ▾
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            background: PANEL_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            padding: "0.35rem 0",
            minWidth: 200,
            zIndex: 50,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {PALETTE_IDS.map((id) => {
            const visible = panelVisibility[id] !== false;
            const { label } = PALETTE_REGISTRY[id];
            return (
              <button
                key={id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={visible}
                onClick={() => toggle(id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  width: "100%",
                  padding: "0.45rem 0.85rem",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: visible ? TEXT : MUTED,
                  fontSize: "0.85rem",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                <span>{label}</span>
                <span style={{ color: visible ? BRAND : MUTED, fontSize: "0.85rem" }}>
                  {visible ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
