// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import type { OverlayPlugin, ViewerContext } from "@printwithsynergy/lens-pdf";
import type { DielineTemplate } from "../lib/dieline-template";

const MM_TO_PT = 2.83465;
const DIELINE_STROKE = "#fc5102";
const BLEED_STROKE = "#0ea5e9";

/**
 * Build a lens-pdf overlay plugin that renders the dieline trim + bleed
 * lines over a rendered PDF. Mount via `register()` or pass into
 * `<LensPDF plugins={...}>`.
 *
 * `pages` maps 1-indexed PDF page numbers to the dieline template +
 * effective bleed used to render that page. The same artwork-pdf
 * dieline-template helpers used during editing produce the values to
 * pass here.
 *
 * @public
 */
export function dielineOverlayPlugin(opts: {
  pages: Record<number, { template: DielineTemplate; bleedMm: number }>;
  /** Override the trim-line color. Defaults to artwork-pdf brand orange. */
  trimColor?: string;
  /** Override the bleed-line color. Defaults to lens-pdf cyan. */
  bleedColor?: string;
}): OverlayPlugin {
  return {
    id: "artworkpdf.overlay.dieline",
    version: "1.0.0",
    slot: "overlay.canvas",
    mount(ctx: ViewerContext) {
      const entry = opts.pages[ctx.page];
      if (!entry) return null;
      const { template, bleedMm } = entry;
      const pageDims = ctx.document.pageDimensions[ctx.page - 1];
      if (!pageDims) return null;

      const trimColor = opts.trimColor ?? DIELINE_STROKE;
      const bleedColor = opts.bleedColor ?? BLEED_STROKE;

      // Page = trim + 2 × bleed. Convert to PDF points using PDF dims.
      // PDF point origin is bottom-left; lens-pdf overlay coordinates
      // are top-left (CSS-style), so we mirror y to match.
      const pageWidthPt = pageDims.width;
      const pageHeightPt = pageDims.height;
      const bleedPt = bleedMm * MM_TO_PT;
      const trimWidthPt = template.trimBox.width * MM_TO_PT;
      const trimHeightPt = template.trimBox.height * MM_TO_PT;

      return (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${pageWidthPt} ${pageHeightPt}`}
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
          }}
          aria-hidden
        >
          <title>Dieline overlay</title>
          {/* Bleed margin — page edge */}
          <rect
            x={0}
            y={0}
            width={pageWidthPt}
            height={pageHeightPt}
            fill="none"
            stroke={bleedColor}
            strokeWidth={1}
            strokeDasharray="6 4"
          />
          {/* Trim line — inside the bleed by bleedPt on each side */}
          <rect
            x={bleedPt}
            y={bleedPt}
            width={trimWidthPt}
            height={trimHeightPt}
            fill="none"
            stroke={trimColor}
            strokeWidth={1}
          />
        </svg>
      );
    },
  };
}
