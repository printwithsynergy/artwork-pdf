// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { type ReactNode, useState } from "react";
import type { EditorConfig } from "../lib/editor-config";
import type { CanvasObj } from "./EditorCanvas";
import { type PropertiesSectionHooks, resolvePropertiesSection } from "./properties-sections";

type Tool = "select" | "rect" | "ellipse" | "text" | "image" | "nutrition" | "braille";

/**
 * Props for the slide-in mobile tool drawer. The drawer is purely
 * presentational — `EditorCanvas` owns the state and passes
 * everything in. Sections render only if their corresponding
 * {@link EditorConfig} flag is enabled.
 *
 * @public
 */
export type MobileToolDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  config: EditorConfig;
  // Tools
  activeTool: Tool;
  onSelectTool: (t: Tool) => void;
  // Edit
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  // View
  zoomPct: number;
  onFit: () => void;
  onOpenDielineChooser: () => void;
  // Style
  fillColor: string;
  strokeColor: string;
  onFillChange: (hex: string) => void;
  onStrokeChange: (hex: string) => void;
  // Bleed
  bleedMm: number;
  onBleedMmChange: (mm: number) => void;
  // Mode
  mode: "basic" | "pro";
  onModeChange: (m: "basic" | "pro") => void;
  // Export
  onExport: () => void;
  exportLabel: string;
  exportBusy: boolean;
  /** Extra collapsible sections appended to the drawer (used for the
   *  Layers / Separations panels in pro mode on mobile). */
  extraSections?: Array<{ title: string; content: ReactNode; defaultOpen?: boolean }>;
  /** The currently-selected canvas object, when one exists. Mirrors
   *  the desktop right-rail wiring: a "Properties" section appears
   *  at the top of the drawer when a selection is present and
   *  {@link MobileToolDrawerProps.onUpdateSelected} is wired. */
  selectedObj?: CanvasObj | null;
  /** Patch-style update for the currently-selected canvas object. */
  onUpdateSelected?: (patch: Partial<CanvasObj>) => void;
  /** Optional host-wired callbacks the properties dispatcher threads
   *  into per-type panels (see {@link
   *  RightRailAccordionProps.propertiesHooks}). */
  propertiesHooks?: PropertiesSectionHooks;
};

const PANEL_BG = "#1a0f08";
const BG = "#120a04";
const BORDER = "#3d1a00";
const BRAND = "#fc5102";
const MUTED = "#888";

function DrawerSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.55rem 0.85rem",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: MUTED,
          fontSize: "0.7rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: "inherit",
        }}
      >
        <span>{title}</span>
        <span
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        >
          ▾
        </span>
      </button>
      {open && <div style={{ padding: "0 0.5rem 0.5rem" }}>{children}</div>}
    </div>
  );
}

function DrawerItem({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        width: "100%",
        alignItems: "center",
        padding: "0.55rem 0.65rem",
        background: active ? "#241308" : "transparent",
        border: "1px solid transparent",
        borderRadius: 4,
        cursor: disabled ? "not-allowed" : "pointer",
        color: active ? BRAND : disabled ? "#444" : "#ddd",
        fontFamily: "inherit",
        fontSize: "0.85rem",
        textAlign: "left",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
      {active && <span style={{ marginLeft: "auto", color: BRAND }}>●</span>}
    </button>
  );
}

/**
 * Left-anchored slide-in drawer that hosts the editor's full toolbar
 * on mobile. Modeled on `printwithsynergy/lens-pdf`'s
 * `components/MobileDrawer.tsx` (Tailwind → inline-style port).
 *
 * @public
 */
export function MobileToolDrawer(props: MobileToolDrawerProps) {
  const {
    isOpen,
    onClose,
    config,
    activeTool,
    onSelectTool,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    zoomPct,
    onFit,
    onOpenDielineChooser,
    fillColor,
    strokeColor,
    onFillChange,
    onStrokeChange,
    bleedMm,
    onBleedMmChange,
    mode,
    onModeChange,
    onExport,
    exportLabel,
    exportBusy,
    extraSections = [],
    selectedObj,
    onUpdateSelected,
    propertiesHooks,
  } = props;

  const propertiesSection = resolvePropertiesSection(
    selectedObj,
    onUpdateSelected,
    config,
    propertiesHooks,
  );

  const handle = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const toolsEnabled =
    config.enable_tool_select ||
    config.enable_tool_rect ||
    config.enable_tool_ellipse ||
    config.enable_tool_text ||
    config.enable_tool_image;

  return (
    <>
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop hotspot — Escape/keyboard handling is wired and the drawer itself owns focus */}
      <div
        role="presentation"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 50,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.2s",
        }}
      />
      {/* Drawer */}
      <aside
        aria-label="Editor tools"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          maxWidth: "85vw",
          background: BG,
          borderRight: `1px solid ${BORDER}`,
          zIndex: 60,
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.22s ease-in-out",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 0.85rem",
            borderBottom: `1px solid ${BORDER}`,
            background: PANEL_BG,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff" }}>Tools</span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: MUTED,
              cursor: "pointer",
              padding: "0 0.25rem",
              fontSize: "1.2rem",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {propertiesSection && (
            <DrawerSection title={`${propertiesSection.label} properties`}>
              {propertiesSection.element}
            </DrawerSection>
          )}
          {toolsEnabled && (
            <DrawerSection title="Tools">
              {config.enable_tool_select && (
                <DrawerItem
                  label="Select"
                  active={activeTool === "select"}
                  onClick={handle(() => onSelectTool("select"))}
                />
              )}
              {config.enable_tool_rect && (
                <DrawerItem
                  label="Rectangle"
                  active={activeTool === "rect"}
                  onClick={handle(() => onSelectTool("rect"))}
                />
              )}
              {config.enable_tool_ellipse && (
                <DrawerItem
                  label="Ellipse"
                  active={activeTool === "ellipse"}
                  onClick={handle(() => onSelectTool("ellipse"))}
                />
              )}
              {config.enable_tool_text && (
                <DrawerItem
                  label="Text"
                  active={activeTool === "text"}
                  onClick={handle(() => onSelectTool("text"))}
                />
              )}
              {config.enable_tool_image && (
                <DrawerItem
                  label="Image…"
                  active={activeTool === "image"}
                  onClick={handle(() => onSelectTool("image"))}
                />
              )}
              {config.enable_tool_nutrition && (
                <DrawerItem
                  label="Nutrition Facts"
                  active={activeTool === "nutrition"}
                  onClick={handle(() => onSelectTool("nutrition"))}
                />
              )}
              {config.enable_tool_braille && (
                <DrawerItem
                  label="Braille"
                  active={activeTool === "braille"}
                  onClick={handle(() => onSelectTool("braille"))}
                />
              )}
            </DrawerSection>
          )}

          {config.enable_undo_redo && (
            <DrawerSection title="Edit" defaultOpen={false}>
              <DrawerItem label="Undo" disabled={!canUndo} onClick={handle(onUndo)} />
              <DrawerItem label="Redo" disabled={!canRedo} onClick={handle(onRedo)} />
            </DrawerSection>
          )}

          <DrawerSection title="View">
            {config.enable_fit_button && <DrawerItem label="Fit to page" onClick={handle(onFit)} />}
            {config.enable_zoom_indicator && (
              <div style={{ padding: "0.4rem 0.65rem", color: MUTED, fontSize: "0.8rem" }}>
                Zoom: {zoomPct}%
              </div>
            )}
            {config.enable_dieline_chooser && (
              <DrawerItem label="Dieline library…" onClick={handle(onOpenDielineChooser)} />
            )}
            {config.enable_bleed_input && (
              <div style={{ padding: "0.4rem 0.65rem" }}>
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.3rem",
                    fontSize: "0.75rem",
                    color: MUTED,
                  }}
                >
                  <span>Bleed (mm)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={Number.parseFloat(bleedMm.toFixed(3))}
                    onChange={(e) => {
                      const v = Number.parseFloat(e.target.value);
                      if (Number.isFinite(v) && v >= 0) onBleedMmChange(v);
                    }}
                    style={{
                      background: BG,
                      border: `1px solid ${BORDER}`,
                      color: "#fff",
                      borderRadius: 4,
                      padding: "0.25rem 0.4rem",
                      fontSize: "0.85rem",
                      fontFamily: "inherit",
                    }}
                  />
                </label>
              </div>
            )}
          </DrawerSection>

          {(config.enable_fill_picker || config.enable_stroke_picker) && (
            <DrawerSection title="Style" defaultOpen={false}>
              {config.enable_fill_picker && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    padding: "0.4rem 0.65rem",
                    fontSize: "0.8rem",
                    color: MUTED,
                  }}
                >
                  <span style={{ flex: 1 }}>Fill</span>
                  <input
                    type="color"
                    value={fillColor}
                    onChange={(e) => onFillChange(e.target.value)}
                    style={{
                      width: 38,
                      height: 26,
                      border: "none",
                      padding: 0,
                      background: "none",
                      cursor: "pointer",
                    }}
                  />
                </label>
              )}
              {config.enable_stroke_picker && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    padding: "0.4rem 0.65rem",
                    fontSize: "0.8rem",
                    color: MUTED,
                  }}
                >
                  <span style={{ flex: 1 }}>Stroke</span>
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => onStrokeChange(e.target.value)}
                    style={{
                      width: 38,
                      height: 26,
                      border: "none",
                      padding: 0,
                      background: "none",
                      cursor: "pointer",
                    }}
                  />
                </label>
              )}
            </DrawerSection>
          )}

          {config.enable_mode_toggle && (
            <DrawerSection title="Mode" defaultOpen={false}>
              <DrawerItem
                label="Basic"
                active={mode === "basic"}
                onClick={() => onModeChange("basic")}
              />
              <DrawerItem label="Pro" active={mode === "pro"} onClick={() => onModeChange("pro")} />
            </DrawerSection>
          )}

          {extraSections.map((s) => (
            <DrawerSection key={s.title} title={s.title} defaultOpen={s.defaultOpen ?? false}>
              {s.content}
            </DrawerSection>
          ))}
        </div>

        {config.enable_export_button && (
          <div
            style={{ padding: "0.6rem", borderTop: `1px solid ${BORDER}`, background: PANEL_BG }}
          >
            <button
              type="button"
              onClick={handle(onExport)}
              disabled={exportBusy}
              style={{
                width: "100%",
                background: BRAND,
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "0.55rem 0.75rem",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: exportBusy ? "wait" : "pointer",
                fontFamily: "inherit",
                opacity: exportBusy ? 0.7 : 1,
              }}
            >
              {exportLabel}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
