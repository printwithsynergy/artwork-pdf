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

const BAR_BG = "rgba(15, 23, 42, 0.95)"; // slate-900/95 to match marketing nav
const BAR_BORDER = "#1e293b"; // slate-800
const BRAND = "#fc5102";
const TEXT_PRIMARY = "#f1f5f9"; // slate-100
const TEXT_MUTED = "#64748b"; // slate-500
const ICON_BORDER = "#334155"; // slate-700

/**
 * Bundled default logo. Inline SVG so the package has no external
 * asset paths leaking into consumers. Matches the marketing site's
 * `/logo-artwork.svg`: orange `#fc5102` rounded square with a white
 * stylized "A" mark inside a frame.
 *
 * @public
 */
export function ArtworkPdfLogo({ size = 24 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      aria-label="ArtworkPDF"
      role="img"
      style={{
        borderRadius: 4,
        border: `1px solid ${ICON_BORDER}`,
        background: "#020617",
        padding: 1,
        boxSizing: "border-box",
      }}
    >
      <title>ArtworkPDF</title>
      <rect x={18.75} y={18.75} width={988} height={988} rx={165} ry={165} fill={BRAND} />
      <path
        d="M151,224c0-34,26-60,60-60h88c22,0,40,18,40,40s-18,40-40,40h-92v537h92c22,0,40,18,40,40s-18,40-40,40h-88c-34,0-60-26-60-60V224Z"
        fill="#fff"
      />
      <path
        d="M874,224c0-34-26-60-60-60h-88c-22,0-40,18-40,40s18,40,40,40h92v537h-92c-22,0-40,18-40,40s18,40,40,40h88c34,0,60-26,60-60V224Z"
        fill="#fff"
      />
      <path
        d="M455,300h114l145,425h-96l-30-95h-152l-30,95h-95L455,300ZM458,560h100l-50-158L458,560Z"
        fill="#fff"
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
        gap: "0.55rem",
        padding: "0.45rem 0.85rem",
        background: BAR_BG,
        borderBottom: `1px solid ${BAR_BORDER}`,
        flexShrink: 0,
        backdropFilter: "blur(8px)",
      }}
    >
      {showMenuButton && (
        <button
          type="button"
          aria-label="Open menu"
          onClick={onMenuToggle}
          style={{
            background: "transparent",
            border: "none",
            color: TEXT_MUTED,
            cursor: "pointer",
            padding: "0.25rem 0.4rem",
            borderRadius: 4,
            fontSize: "1.05rem",
            lineHeight: 1,
            marginRight: "0.15rem",
          }}
        >
          ☰
        </button>
      )}
      {resolvedLogo !== null && (
        <span style={{ display: "inline-flex", alignItems: "center" }}>{resolvedLogo}</span>
      )}
      {brandText !== null && (
        <span
          style={{
            fontWeight: 600,
            color: TEXT_PRIMARY,
            fontSize: "0.9rem",
            letterSpacing: "-0.01em",
          }}
        >
          {brandText}
          {showDemoBadge && (
            <span
              style={{
                marginLeft: "0.5rem",
                fontSize: "0.6rem",
                background: "transparent",
                border: `1px solid ${BRAND}`,
                color: BRAND,
                padding: "0.1rem 0.35rem",
                borderRadius: 3,
                verticalAlign: "middle",
                letterSpacing: "0.08em",
                fontWeight: 700,
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
          color: b.primary ? "#fff" : TEXT_MUTED,
          background: b.primary ? BRAND : "transparent",
          border: b.primary ? `1px solid ${BRAND}` : "none",
          borderRadius: 6,
          padding: b.primary ? "0.3rem 0.7rem" : "0.3rem 0.55rem",
          cursor: "pointer",
          fontFamily: "inherit",
          textDecoration: "none",
          fontWeight: b.primary ? 600 : 500,
          transition: "color 0.12s",
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
