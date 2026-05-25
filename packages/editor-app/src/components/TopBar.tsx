// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import type React from "react";

/**
 * One CTA the host can attach to the right-hand side of the {@link TopBar}.
 *
 * @public
 */
export type TopBarButton = {
  label: string;
  href?: string;
  onClick?: () => void;
  target?: "_blank" | "_self";
  primary?: boolean;
};

/**
 * Customization surface for the editor's top bar. The hamburger trigger
 * is always rendered at the same position (mobile only) so muscle
 * memory is preserved across hosts; everything else is host-supplied.
 *
 * @public
 */
export type TopBarProps = {
  /**
   * The logo node. Pass any ReactNode (img, svg, span). Pass `null`
   * to hide. Leaving undefined uses the bundled {@link ArtworkPdfLogo}.
   */
  logo?: React.ReactNode;
  /** Wordmark text shown next to the logo. `null` hides; defaults to "artworkPDF". */
  brandText?: string | null;
  /** Demo badge — shows next to the brand text when truthy. */
  showDemoBadge?: boolean;
  /** Host-supplied CTAs (e.g. "← Back to artworkpdf.com"). */
  extraButtons?: TopBarButton[];
  /** Arbitrary right-aligned slot (e.g. host's custom toggle). */
  rightSlot?: React.ReactNode;
  /** Click handler for the hamburger button. Wired by `EditorApp`. */
  onMenuToggle?: () => void;
  /** Whether to show the hamburger (mobile only — desktop hides it). */
  showMenuButton?: boolean;
};

const BAR_BG = "#1a0f08";
const BAR_BORDER = "#3d1a00";
const BRAND = "#fc5102";
const MUTED = "#888";

/**
 * Bundled default logo. Inline SVG so the package has no external
 * asset paths leaking into consumers.
 *
 * @public
 */
export function ArtworkPdfLogo({ size = 22 }: { size?: number }) {
  // Square mark — orange rounded rect with white "A" wordmark.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-label="artworkPDF"
      role="img"
    >
      <rect x={2} y={2} width={60} height={60} rx={12} fill={BRAND} />
      <path
        d="M22 46 L32 18 L42 46 M26 38 L38 38"
        stroke="#fff"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Slim top bar rendered at the top of the editor. Carries only brand
 * + hamburger + host-supplied CTAs — the tool/mode/export controls
 * live in the toolbar (desktop) or the slide-in drawer (mobile).
 *
 * @public
 */
export function TopBar({
  logo,
  brandText = "artworkPDF",
  showDemoBadge = false,
  extraButtons = [],
  rightSlot,
  onMenuToggle,
  showMenuButton = false,
}: TopBarProps) {
  const resolvedLogo = logo === undefined ? <ArtworkPdfLogo /> : logo;
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: "0.4rem 0.75rem",
        background: BAR_BG,
        borderBottom: `1px solid ${BAR_BORDER}`,
        flexShrink: 0,
      }}
    >
      {showMenuButton && (
        <button
          type="button"
          aria-label="Open menu"
          onClick={onMenuToggle}
          style={{
            background: "transparent",
            border: `1px solid ${BAR_BORDER}`,
            color: "#ddd",
            cursor: "pointer",
            padding: "0.2rem 0.45rem",
            borderRadius: 4,
            fontSize: "1rem",
            lineHeight: 1,
          }}
        >
          ☰
        </button>
      )}
      {resolvedLogo !== null && (
        <span style={{ display: "inline-flex", alignItems: "center" }}>{resolvedLogo}</span>
      )}
      {brandText !== null && (
        <span style={{ fontWeight: 600, color: BRAND, fontSize: "0.9rem" }}>
          {brandText}
          {showDemoBadge && (
            <span
              style={{
                marginLeft: "0.45rem",
                fontSize: "0.6rem",
                background: "#2a1200",
                border: `1px solid ${BRAND}`,
                color: BRAND,
                padding: "0.1rem 0.35rem",
                borderRadius: 3,
                verticalAlign: "middle",
                letterSpacing: "0.08em",
              }}
            >
              DEMO
            </span>
          )}
        </span>
      )}
      <div style={{ flex: 1 }} />
      {extraButtons.map((b) => {
        const style: React.CSSProperties = {
          fontSize: "0.8rem",
          color: b.primary ? "#fff" : MUTED,
          background: b.primary ? BRAND : "transparent",
          border: b.primary ? `1px solid ${BRAND}` : "none",
          borderRadius: 4,
          padding: b.primary ? "0.25rem 0.6rem" : "0.25rem 0.4rem",
          cursor: "pointer",
          fontFamily: "inherit",
          textDecoration: "none",
          fontWeight: b.primary ? 600 : 400,
        };
        return b.href ? (
          <a
            key={`${b.label}-${b.href}`}
            href={b.href}
            target={b.target ?? "_self"}
            rel={b.target === "_blank" ? "noopener noreferrer" : undefined}
            onClick={b.onClick}
            style={style}
          >
            {b.label}
          </a>
        ) : (
          <button key={b.label} type="button" onClick={b.onClick} style={style}>
            {b.label}
          </button>
        );
      })}
      {rightSlot}
    </header>
  );
}
