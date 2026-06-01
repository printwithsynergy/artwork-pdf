// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import type { Page } from "../lib/dieline-template";

/**
 * Multi-page navigation strip. Lives:
 *  • in the desktop toolbar (thin horizontal row)
 *  • in the mobile drawer's "Pages" section (full-width buttons)
 *
 * Stays purely presentational — receives the current pages array +
 * active index + change callbacks from `EditorApp`. No state of its
 * own.
 *
 * @public
 */
export type PageNavigatorProps = {
  pages: Page[];
  currentPageIndex: number;
  onSelect: (index: number) => void;
  /** Append a duplicate of the current page. */
  onAddPage?: () => void;
  /** Remove the active page (disabled when only one remains). */
  onDeletePage?: () => void;
  /** Layout variant. `"strip"` is the thin desktop row; `"stack"` is the
   *  full-width vertical list in the mobile drawer. */
  variant?: "strip" | "stack";
};

const BG = "#120a04";
const PANEL_BG = "#1a0f08";
const BORDER = "#3d1a00";
const BRAND = "#fc5102";
const MUTED = "#888";

export function PageNavigator({
  pages,
  currentPageIndex,
  onSelect,
  onAddPage,
  onDeletePage,
  variant = "strip",
}: PageNavigatorProps) {
  const canDelete = pages.length > 1 && onDeletePage !== undefined;

  if (variant === "stack") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.2rem",
          padding: "0.4rem 0.65rem",
        }}
      >
        <div
          role="tablist"
          aria-label="Pages"
          aria-orientation="vertical"
          style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}
        >
          {pages.map((p, i) => {
            const active = i === currentPageIndex;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Page ${i + 1}${p.name ? `: ${p.name}` : ""}`}
                onClick={() => onSelect(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.55rem",
                  padding: "0.45rem 0.6rem",
                  background: active ? "#241308" : "transparent",
                  border: `1px solid ${active ? BRAND : "transparent"}`,
                  borderRadius: 4,
                  color: active ? BRAND : "#ddd",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "0.82rem",
                  textAlign: "left",
                }}
              >
                <span
                  aria-hidden
                  style={{ fontFamily: "monospace", color: MUTED, fontSize: "0.7rem" }}
                >
                  {i + 1}
                </span>
                <span style={{ flex: 1 }}>{p.name ?? `Page ${i + 1}`}</span>
                {active && (
                  <span aria-hidden style={{ color: BRAND }}>
                    ●
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {(onAddPage || canDelete) && (
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
            {onAddPage && (
              <button
                type="button"
                onClick={onAddPage}
                style={stackActionStyle}
                aria-label="Add page"
              >
                + Add page
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={onDeletePage}
                style={{ ...stackActionStyle, color: "#e57373", borderColor: "#5a1a1a" }}
                aria-label="Delete current page"
              >
                ✕ Delete
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // strip — thin desktop row
  return (
    <div
      role="tablist"
      aria-label="Pages"
      aria-orientation="horizontal"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.3rem",
        padding: "0.25rem 0.6rem",
        background: PANEL_BG,
        borderBottom: `1px solid ${BORDER}`,
        flexShrink: 0,
        flexWrap: "wrap",
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: "0.7rem",
          color: MUTED,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 600,
          marginRight: "0.4rem",
        }}
      >
        Pages
      </span>
      {pages.map((p, i) => {
        const active = i === currentPageIndex;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Page ${i + 1}${p.name ? `: ${p.name}` : ""}`}
            onClick={() => onSelect(i)}
            title={p.name ?? `Page ${i + 1}`}
            style={{
              background: active ? BRAND : "transparent",
              color: active ? "#fff" : "#ccc",
              border: `1px solid ${active ? BRAND : BORDER}`,
              borderRadius: 4,
              padding: "0.18rem 0.55rem",
              fontSize: "0.75rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {i + 1}
            {p.name ? (
              <span style={{ marginLeft: "0.35rem", color: active ? "#fff" : MUTED }}>
                {p.name}
              </span>
            ) : null}
          </button>
        );
      })}

      {onAddPage && (
        <button
          type="button"
          onClick={onAddPage}
          title="Add page"
          style={{
            background: "transparent",
            color: MUTED,
            border: `1px dashed ${BORDER}`,
            borderRadius: 4,
            padding: "0.18rem 0.55rem",
            fontSize: "0.75rem",
            cursor: "pointer",
            fontFamily: "inherit",
            marginLeft: "0.2rem",
          }}
        >
          +
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={onDeletePage}
          title="Delete current page"
          style={{
            background: "transparent",
            color: "#e57373",
            border: "1px solid #5a1a1a",
            borderRadius: 4,
            padding: "0.18rem 0.5rem",
            fontSize: "0.7rem",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

const stackActionStyle: React.CSSProperties = {
  flex: 1,
  background: BG,
  color: MUTED,
  border: `1px solid ${BORDER}`,
  borderRadius: 4,
  padding: "0.35rem 0.5rem",
  fontSize: "0.75rem",
  cursor: "pointer",
  fontFamily: "inherit",
};
