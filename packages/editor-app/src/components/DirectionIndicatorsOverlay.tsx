// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 S6 — Direction indicators overlay.
 *
 * Production needs to see non-printing context indicators that
 * never make it into the final artwork: corrugated-flute axis,
 * paper-grain axis, web-direction arrow, and an
 * inside-vs-outside-print badge. None of these get written into
 * the PDF — they're a non-printing overlay the editor renders on
 * top of the canvas so the operator catches mirroring / grain
 * mismatches before the file leaves the design seat.
 *
 * Pure-render component. Hosts pass in a
 * {@link DirectionIndicatorsSpec}; the overlay positions a small
 * legend chip + the four indicator markers at the page extents.
 *
 * @public
 */

import { type ReactElement, useId } from "react";

/**
 * Direction-context spec emitted by the host (typically derived
 * from `printContext.substrate` + per-page metadata).
 *
 * @public
 */
export type DirectionIndicatorsSpec = {
  /** Page extents in pixels — matches the canvas viewport. */
  widthPx: number;
  heightPx: number;
  /** Flute / grain axis. Absent = unknown (not rendered). */
  fluteAxis?: "horizontal" | "vertical";
  grainAxis?: "horizontal" | "vertical";
  /** Web direction — the direction the substrate travels through
   *  the press. Absent = unknown (not rendered). */
  webDirection?: "left-to-right" | "right-to-left" | "top-to-bottom" | "bottom-to-top";
  /** Print side. When `"inside"`, the canvas should render the
   *  page mirrored — the editor surfaces this badge so the
   *  operator can confirm the right side is being authored. */
  printSide?: "outside" | "inside";
};

/**
 * Props for the {@link DirectionIndicatorsOverlay}.
 *
 * @public
 */
export type DirectionIndicatorsOverlayProps = {
  spec: DirectionIndicatorsSpec;
};

const BADGE_BG = "rgba(20, 20, 20, 0.78)";
const BADGE_FG = "#f4ece6";

/**
 * Pure-render overlay. Anchored absolutely; consumers wrap the
 * canvas + this in a relatively-positioned container.
 *
 * @public
 */
export function DirectionIndicatorsOverlay({
  spec,
}: DirectionIndicatorsOverlayProps): ReactElement {
  const { widthPx, heightPx, fluteAxis, grainAxis, webDirection, printSide } = spec;

  // Compose the legend line by line, skipping rows the host left
  // unset so dieless-print jobs don't see a stub legend.
  const legend: string[] = [];
  if (fluteAxis) legend.push(`flute: ${fluteAxis}`);
  if (grainAxis) legend.push(`grain: ${grainAxis}`);
  if (webDirection) legend.push(`web: ${webDirection}`);
  if (printSide) legend.push(`side: ${printSide}-print`);

  return (
    <div
      data-testid="direction-indicators-overlay"
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: widthPx,
        height: heightPx,
        pointerEvents: "none",
      }}
    >
      {fluteAxis && <FluteHatch axis={fluteAxis} widthPx={widthPx} heightPx={heightPx} />}
      {webDirection && <WebArrow direction={webDirection} widthPx={widthPx} heightPx={heightPx} />}
      {printSide === "inside" && (
        <div
          data-testid="direction-indicators-mirror-warning"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            padding: "0.25rem 0.5rem",
            fontSize: "0.6875rem",
            background: "#a00",
            color: "#fff",
            borderRadius: 4,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          INSIDE-PRINT — mirror before output
        </div>
      )}
      {legend.length > 0 && (
        <div
          data-testid="direction-indicators-legend"
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            padding: "0.375rem 0.5rem",
            background: BADGE_BG,
            color: BADGE_FG,
            fontSize: "0.6875rem",
            lineHeight: 1.4,
            borderRadius: 4,
            fontFamily: "monospace",
          }}
        >
          {legend.map((row) => (
            <div key={row}>{row}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function FluteHatch({
  axis,
  widthPx,
  heightPx,
}: {
  axis: "horizontal" | "vertical";
  widthPx: number;
  heightPx: number;
}): ReactElement {
  // 16-line hatch across the page, faint enough not to obscure
  // artwork. Horizontal flute → vertical hatch (perpendicular)
  // and vice-versa — the hatch direction tracks the corrugated
  // peak ridges, not the channel-axis.
  const lines = 16;
  const isVerticalHatch = axis === "horizontal";
  return (
    <svg
      data-testid="direction-indicators-flute-hatch"
      width={widthPx}
      height={heightPx}
      style={{ position: "absolute", top: 0, left: 0, opacity: 0.18 }}
    >
      <title>{`flute hatch (${axis})`}</title>
      {Array.from({ length: lines }, (_, i) => {
        const t = (i + 0.5) / lines;
        if (isVerticalHatch) {
          const x = t * widthPx;
          // biome-ignore lint/suspicious/noArrayIndexKey: hatch lines are positional-only and never reorder
          return <line key={i} x1={x} y1={0} x2={x} y2={heightPx} stroke="#06a" strokeWidth={1} />;
        }
        const y = t * heightPx;
        // biome-ignore lint/suspicious/noArrayIndexKey: hatch lines are positional-only and never reorder
        return <line key={i} x1={0} y1={y} x2={widthPx} y2={y} stroke="#06a" strokeWidth={1} />;
      })}
    </svg>
  );
}

function WebArrow({
  direction,
  widthPx,
  heightPx,
}: {
  direction: NonNullable<DirectionIndicatorsSpec["webDirection"]>;
  widthPx: number;
  heightPx: number;
}): ReactElement {
  // Per-instance marker id so multiple overlays in the same DOM
  // (e.g. a multi-page editor with one indicator per page) don't
  // collide on a shared `id="web-arrowhead"` — only one definition
  // would be honoured and the rest would render unarrowed lines.
  const rawId = useId();
  const markerId = `web-arrowhead-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const cx = widthPx / 2;
  const cy = heightPx / 2;
  const len = Math.min(widthPx, heightPx) * 0.5;
  let x1 = cx;
  let y1 = cy;
  let x2 = cx;
  let y2 = cy;
  switch (direction) {
    case "left-to-right":
      x1 = cx - len / 2;
      x2 = cx + len / 2;
      break;
    case "right-to-left":
      x1 = cx + len / 2;
      x2 = cx - len / 2;
      break;
    case "top-to-bottom":
      y1 = cy - len / 2;
      y2 = cy + len / 2;
      break;
    case "bottom-to-top":
      y1 = cy + len / 2;
      y2 = cy - len / 2;
      break;
  }
  return (
    <svg
      data-testid="direction-indicators-web-arrow"
      width={widthPx}
      height={heightPx}
      style={{ position: "absolute", top: 0, left: 0, opacity: 0.5 }}
    >
      <title>{`web direction (${direction})`}</title>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX={8}
          refY={5}
          markerWidth={6}
          markerHeight={6}
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="#fc5102" />
        </marker>
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#fc5102"
        strokeWidth={3}
        markerEnd={`url(#${markerId})`}
      />
    </svg>
  );
}
