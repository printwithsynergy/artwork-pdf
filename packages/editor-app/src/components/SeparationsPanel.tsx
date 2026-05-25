// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import type { CanvasObj } from "./EditorCanvas";

type Props = {
  objects: CanvasObj[];
  hidden: Set<string>;
  onToggle: (color: string) => void;
};

const PANEL = "#1a0f08";
const BORDER = "#3d1a00";
const MUTED = "#888";

/**
 * Approximate per-channel separation: in basic RGB land we infer ink coverage
 * from the source color. CMYK is computed via a naive RGB→CMYK conversion, and
 * any non-CMYK paint is grouped under its hex as a spot ink. This is a preview
 * surface only — the real separations come from the pdf-writer + Ghostscript
 * pipeline server-side.
 */
type Channel = {
  key: string;
  label: string;
  swatch: string;
  colors: string[];
  isSpot: boolean;
};

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = Number.parseInt(m[1] as string, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function isCmykPrimary(hex: string): "C" | "M" | "Y" | "K" | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  if (r < 16 && g < 16 && b < 16) return "K";
  if (r > 220 && g < 60 && b < 60) return null; // pure red → treated as spot
  if (r < 60 && g > 200 && b > 200) return "C";
  if (r > 200 && g < 60 && b > 200) return "M";
  if (r > 200 && g > 200 && b < 60) return "Y";
  return null;
}

function inkChannels(objects: CanvasObj[]): Channel[] {
  const map = new Map<string, Channel>();

  const addColor = (raw: string | undefined) => {
    if (!raw || raw === "transparent") return;
    const hex = raw.toLowerCase();
    const cmyk = isCmykPrimary(hex);
    if (cmyk) {
      const swatchMap: Record<string, string> = {
        C: "#00bcd4",
        M: "#e91e63",
        Y: "#ffeb3b",
        K: "#222",
      };
      const labelMap: Record<string, string> = {
        C: "Cyan",
        M: "Magenta",
        Y: "Yellow",
        K: "Black",
      };
      const existing = map.get(cmyk);
      if (existing) {
        if (!existing.colors.includes(hex)) existing.colors.push(hex);
      } else {
        map.set(cmyk, {
          key: cmyk,
          label: labelMap[cmyk] ?? cmyk,
          swatch: swatchMap[cmyk] ?? "#000",
          colors: [hex],
          isSpot: false,
        });
      }
      return;
    }
    // Spot ink — group by source hex
    const existing = map.get(hex);
    if (existing) return;
    map.set(hex, {
      key: hex,
      label: `Spot ${hex.toUpperCase()}`,
      swatch: hex,
      colors: [hex],
      isSpot: true,
    });
  };

  for (const o of objects) {
    addColor(o.fill);
    addColor(o.stroke);
  }

  // Deterministic ordering: CMYK first, then spots.
  const order: Record<string, number> = { C: 0, M: 1, Y: 2, K: 3 };
  return [...map.values()].sort((a, b) => {
    const ai = order[a.key] ?? 100;
    const bi = order[b.key] ?? 100;
    if (ai !== bi) return ai - bi;
    return a.label.localeCompare(b.label);
  });
}

export function SeparationsPanel({ objects, hidden, onToggle }: Props) {
  const channels = inkChannels(objects);

  return (
    <aside
      style={{
        width: 220,
        background: PANEL,
        borderLeft: `1px solid ${BORDER}`,
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
        Separations ({channels.length})
      </header>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {channels.length === 0 && (
          <p style={{ padding: "0.75rem", fontSize: "0.75rem", color: MUTED, margin: 0 }}>
            No ink coverage yet. Set a fill or stroke to populate channels.
          </p>
        )}
        {channels.map((ch) => {
          const allHidden = ch.colors.every((c) => hidden.has(c));
          return (
            <label
              key={ch.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
                padding: "0.45rem 0.75rem",
                borderBottom: `1px solid #120a04`,
                cursor: "pointer",
                fontSize: "0.78rem",
                color: allHidden ? MUTED : "#ddd",
              }}
            >
              <input
                type="checkbox"
                checked={!allHidden}
                onChange={() => {
                  for (const c of ch.colors) onToggle(c);
                }}
                style={{ accentColor: "#fc5102" }}
              />
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: ch.swatch,
                  border: ch.swatch === "#222" ? "1px solid #555" : "none",
                }}
              />
              <span style={{ flex: 1 }}>{ch.label}</span>
              {ch.isSpot && (
                <span
                  style={{
                    fontSize: "0.6rem",
                    color: MUTED,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Spot
                </span>
              )}
            </label>
          );
        })}
      </div>

      <p
        style={{
          padding: "0.6rem 0.75rem",
          margin: 0,
          fontSize: "0.65rem",
          color: MUTED,
          borderTop: `1px solid ${BORDER}`,
          lineHeight: 1.4,
        }}
      >
        Preview only. Final separations are produced by the render service (pdf-writer + Ghostscript
        ICC).
      </p>
    </aside>
  );
}
