// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { useState } from "react";
import library from "../data/dielines.json";

export type DielineTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  dimensions: { widthMm: number; heightMm: number; depthMm: number };
  bleedMm: number;
  trimBox: { x: number; y: number; width: number; height: number };
  previewSvg: string;
  tags: string[];
  isDefault?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (template: DielineTemplate) => void;
};

const PANEL = "#1a0f08";
const BORDER = "#3d1a00";
const BRAND = "#fc5102";
const MUTED = "#888";

const TEMPLATES = (library as { templates: DielineTemplate[] }).templates;

export function DielineLibraryModal({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? TEMPLATES.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
    : TEMPLATES;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dieline library"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
        style={{
          background: PANEL,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          maxWidth: 880,
          width: "100%",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.85rem 1rem",
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <h2 style={{ margin: 0, fontSize: "0.95rem", color: "#fff", flex: 1 }}>
            Dieline library
          </h2>
          <input
            type="search"
            placeholder="Search pouches, labels, cartons…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              background: "#120a04",
              border: `1px solid ${BORDER}`,
              color: "#fff",
              borderRadius: 4,
              padding: "0.3rem 0.55rem",
              fontSize: "0.8rem",
              width: 240,
              fontFamily: "inherit",
            }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: MUTED,
              fontSize: "1.1rem",
              cursor: "pointer",
              padding: "0 0.25rem",
            }}
          >
            ✕
          </button>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1rem",
            display: "grid",
            gap: "0.85rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          }}
        >
          {filtered.length === 0 && (
            <p style={{ color: MUTED, fontSize: "0.85rem" }}>No dielines match “{query}”.</p>
          )}
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onSelect(t);
                onClose();
              }}
              style={{
                background: "#120a04",
                border: `1px solid ${BORDER}`,
                borderRadius: 6,
                padding: "0.6rem",
                textAlign: "left",
                color: "#ddd",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = BRAND;
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = BRAND;
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER;
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER;
              }}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: 4,
                  aspectRatio: "1 / 1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.5rem",
                  overflow: "hidden",
                }}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: previewSvg is a static bundled fixture
                dangerouslySetInnerHTML={{ __html: t.previewSvg }}
              />
              <div>
                <div style={{ color: BRAND, fontSize: "0.82rem", fontWeight: 600 }}>{t.name}</div>
                <div style={{ color: MUTED, fontSize: "0.7rem", marginTop: 2 }}>
                  {t.dimensions.widthMm} × {t.dimensions.heightMm} mm · {t.category}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
