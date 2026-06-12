// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import type { CanvasObj } from "./EditorCanvas";

type Props = {
  objects: CanvasObj[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
  onDelete: (id: string) => void;
  onToggleVisible: (id: string) => void;
};

const BG = "#120a04";
const PANEL = "#1a0f08";
const BORDER = "#3d1a00";
const BRAND = "#fc5102";
const MUTED = "#888";

const ICONS: Record<CanvasObj["type"], string> = {
  rect: "▭",
  ellipse: "◯",
  text: "T",
  image: "▣",
  path: "↯",
  nutrition: "NF",
  braille: "⠿",
};

function label(o: CanvasObj): string {
  if (o.name) return o.name;
  if (o.type === "text") return o.text?.slice(0, 24) || "Text";
  if (o.type === "nutrition") return "Nutrition Facts";
  if (o.type === "braille") return `Braille: ${o.brailleSpec?.text?.slice(0, 16) || ""}`;
  return `${o.type.charAt(0).toUpperCase()}${o.type.slice(1)}`;
}

export function LayersPanel({
  objects,
  selectedId,
  onSelect,
  onReorder,
  onDelete,
  onToggleVisible,
}: Props) {
  return (
    <aside
      style={{
        width: 220,
        background: PANEL,
        borderRight: `1px solid ${BORDER}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      <header
        style={{
          padding: "0.5rem 0.75rem",
          borderBottom: `1px solid ${BORDER}`,
          fontSize: "0.7rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: MUTED,
          fontWeight: 600,
        }}
      >
        Layers ({objects.length})
      </header>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {objects.length === 0 && (
          <p style={{ padding: "0.75rem", fontSize: "0.75rem", color: MUTED, margin: 0 }}>
            No objects yet. Draw a shape or import an image.
          </p>
        )}

        {/* Top of canvas stack first (z-order reversed for visual familiarity) */}
        {[...objects].reverse().map((o) => {
          const selected = o.id === selectedId;
          const hidden = o.opacity === 0;
          const locked = o.locked === true;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                if (!locked) onSelect(o.id);
              }}
              style={{
                width: "100%",
                background: selected ? "rgba(252,81,2,0.12)" : "transparent",
                border: "none",
                borderLeft: `3px solid ${selected ? BRAND : "transparent"}`,
                borderBottom: `1px solid ${BG}`,
                color: hidden ? MUTED : "#ddd",
                padding: "0.4rem 0.6rem",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: locked ? "default" : "pointer",
                fontSize: "0.78rem",
                fontFamily: "inherit",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 14,
                  textAlign: "center",
                  color: selected ? BRAND : MUTED,
                  fontFamily: "monospace",
                }}
              >
                {ICONS[o.type]}
              </span>
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textDecoration: hidden ? "line-through" : "none",
                }}
              >
                {label(o)}
              </span>
              {locked ? (
                // biome-ignore lint/a11y/useAriaPropsSupportedByRole: decorative lock glyph — title carries the tooltip, aria-label the SR text
                <span
                  aria-label="Locked"
                  title="Locked"
                  style={{ color: MUTED, fontSize: "0.72rem", userSelect: "none" }}
                >
                  🔒
                </span>
              ) : (
                <>
                  <RowIcon
                    title={hidden ? "Show" : "Hide"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisible(o.id);
                    }}
                    ch={hidden ? "○" : "●"}
                  />
                  <RowIcon
                    title="Bring forward"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorder(o.id, "up");
                    }}
                    ch="↑"
                  />
                  <RowIcon
                    title="Send backward"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorder(o.id, "down");
                    }}
                    ch="↓"
                  />
                  <RowIcon
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(o.id);
                    }}
                    ch="✕"
                    danger
                  />
                </>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function RowIcon({
  ch,
  title,
  onClick,
  danger = false,
}: {
  ch: string;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: nested inside an interactive row — a native <button> may not nest in this position
    <span
      role="button"
      tabIndex={0}
      title={title}
      aria-label={title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent);
        }
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        borderRadius: 3,
        color: danger ? "#e57373" : MUTED,
        fontSize: "0.72rem",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {ch}
    </span>
  );
}
