// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 S6 — lightweight dieline preview panel.
 *
 * Renders a small 2D thumbnail of the active page's dieline: every
 * panel from `panelMetadata` is drawn as a rect (bbox-derived), and
 * every fold edge from `foldConfig` is overlaid as a colored segment
 * (mountain = blue, valley = red).
 *
 * Distinct from {@link FoldPreviewOverlay}, which spins up a Three.js
 * WebGL scene for full 3D viewing. S6 is the cheap always-on chrome
 * companion: SVG-only, no GPU, SSR-safe, ~zero bundle cost. Hosts
 * typically dock it in the right rail next to {@link DielineParametersPanel}
 * so a parametric edit + this preview update side-by-side.
 *
 * The component is fully controlled and props-driven — no internal
 * state, no fold-angle math, no hover side effects. The host owns
 * `activePanelId`; the preview just renders it. This keeps the panel
 * useful in both Wave 4 contexts (host-driven hover affordance) and
 * Wave 5+ contexts (host-driven panel-anchored object selection).
 *
 * @public
 */

import type { ReactElement } from "react";

/**
 * One panel of the dieline registry, structurally compatible with
 * `@artworkpdf/document-model`'s `DielinePanel` and editor-side
 * {@link FoldGeometryPanel}. The fields below are the subset we need
 * for the 2D preview — `pathData` is intentionally omitted; the
 * preview uses the axis-aligned `bbox` for speed and SSR-safety.
 *
 * @public
 */
export type DielinePreviewPanel = {
  id: string;
  name?: string;
  bbox: { x: number; y: number; width: number; height: number };
  role?: string;
};

/**
 * Panel registry input — structurally compatible with `PanelMetadata`
 * on `@artworkpdf/document-model`'s `PageV3`.
 *
 * @public
 */
export type DielinePreviewPanelMetadata = {
  panels: DielinePreviewPanel[];
};

/**
 * One fold edge between two panels (Wave 2 S4 wire shape).
 * Structurally compatible with `@artworkpdf/document-model`'s
 * `FoldEdge`.
 *
 * @public
 */
export type DielinePreviewFoldEdge = {
  id: string;
  panelA: string;
  panelB: string;
  angleDeg: number;
  direction?: "mountain" | "valley";
};

/**
 * Fold-edge registry input — structurally compatible with `FoldConfig`
 * on `@artworkpdf/document-model`'s `PageV3`.
 *
 * @public
 */
export type DielinePreviewFoldConfig = {
  edges: DielinePreviewFoldEdge[];
  defaultAngleDeg?: number;
};

/**
 * @public
 */
export type DielinePreviewProps = {
  /** Panel registry for the active page. `undefined` renders the
   *  "no dieline loaded" empty state. */
  panelMetadata: DielinePreviewPanelMetadata | undefined;
  /** Fold-edge registry for the active page. `undefined` is fine —
   *  panels render alone, no hinge lines appear. */
  foldConfig?: DielinePreviewFoldConfig;
  /** Optional template id surfaced in the panel header. Hosts that
   *  carry `PageV3.dielineTemplateId` pass it here as a label hint. */
  templateId?: string;
  /** Preview viewport size in CSS pixels (square). Defaults to 160. */
  sizePx?: number;
  /** Id of a panel to render in the "active" style (host-controlled
   *  hover / selection affordance). Absent → no highlight. */
  activePanelId?: string;
};

/** Default preview size. Tight enough for a sidebar slot, big enough
 *  to read panel roles at a glance. */
const DEFAULT_SIZE_PX = 160;

/** SVG gutter around the dieline so panel strokes don't kiss the edge. */
const GUTTER_PX = 8;

/**
 * Internal layout shape produced by {@link computeDielinePreviewLayout}.
 *
 * Exposed only via the helper's return type so tests can assert
 * geometry without driving the SVG renderer.
 */
export type DielinePreviewLayout = {
  panels: DielinePreviewLaidOutPanel[];
  hinges: DielinePreviewLaidOutHinge[];
  scale: number;
};

/**
 * One panel projected into the preview viewport.
 *
 * @public
 */
export type DielinePreviewLaidOutPanel = {
  id: string;
  name?: string;
  role?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * One hinge segment projected into the preview viewport.
 *
 * @public
 */
export type DielinePreviewLaidOutHinge = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  direction: "mountain" | "valley";
};

/**
 * Pure geometry helper — projects the panel registry + fold config
 * into the preview viewport at `sizePx` square. Exposed for tests
 * and for hosts that want to drive their own SVG / canvas renderer
 * over the same numbers.
 *
 * Returns an empty layout when `panels` is empty; collapses to a
 * unit scale when every panel has zero extent (mid-edit guard).
 *
 * @public
 */
export function computeDielinePreviewLayout(
  panelMetadata: DielinePreviewPanelMetadata,
  foldConfig: DielinePreviewFoldConfig | undefined,
  sizePx: number,
): DielinePreviewLayout {
  if (panelMetadata.panels.length === 0) {
    return { panels: [], hinges: [], scale: 1 };
  }

  // AABB across every panel's bbox in source units.
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of panelMetadata.panels) {
    if (p.bbox.x < minX) minX = p.bbox.x;
    if (p.bbox.y < minY) minY = p.bbox.y;
    if (p.bbox.x + p.bbox.width > maxX) maxX = p.bbox.x + p.bbox.width;
    if (p.bbox.y + p.bbox.height > maxY) maxY = p.bbox.y + p.bbox.height;
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const longest = Math.max(spanX, spanY);
  // Defensive: degenerate registries (all-zero bboxes) get unit scale
  // so we still render *something* and don't divide by zero.
  const scale = longest > 0 ? (sizePx - 2 * GUTTER_PX) / longest : 1;

  const panels: DielinePreviewLaidOutPanel[] = panelMetadata.panels.map((p) => {
    const out: DielinePreviewLaidOutPanel = {
      id: p.id,
      x: GUTTER_PX + (p.bbox.x - minX) * scale,
      y: GUTTER_PX + (p.bbox.y - minY) * scale,
      width: p.bbox.width * scale,
      height: p.bbox.height * scale,
    };
    if (p.name !== undefined) out.name = p.name;
    if (p.role !== undefined) out.role = p.role;
    return out;
  });

  const panelById = new Map(panels.map((p) => [p.id, p]));
  const hinges: DielinePreviewLaidOutHinge[] = [];
  if (foldConfig) {
    for (const edge of foldConfig.edges) {
      const a = panelById.get(edge.panelA);
      const b = panelById.get(edge.panelB);
      if (!a || !b) continue;
      // Hinge segment = the overlap of the two panels' bbox edges.
      // For non-touching panels we still draw a connector between
      // their bbox centers so the operator can see the fold intent.
      hinges.push({
        id: edge.id,
        ...hingeBetween(a, b),
        direction: edge.direction ?? "mountain",
      });
    }
  }

  return { panels, hinges, scale };
}

/**
 * Compute the hinge segment between two laid-out panels. Returns the
 * shared bbox edge when the panels touch; otherwise returns a connector
 * between their centers so dangling-fold cases still render visibly.
 */
function hingeBetween(
  a: DielinePreviewLaidOutPanel,
  b: DielinePreviewLaidOutPanel,
): { x1: number; y1: number; x2: number; y2: number } {
  const aRight = a.x + a.width;
  const aBottom = a.y + a.height;
  const bRight = b.x + b.width;
  const bBottom = b.y + b.height;
  // Horizontal-adjacent: a is left of b, edge is x = aRight ≈ b.x.
  if (Math.abs(aRight - b.x) < 0.5 || Math.abs(bRight - a.x) < 0.5) {
    const x = Math.abs(aRight - b.x) < 0.5 ? aRight : a.x;
    const y1 = Math.max(a.y, b.y);
    const y2 = Math.min(aBottom, bBottom);
    return { x1: x, y1, x2: x, y2 };
  }
  // Vertical-adjacent: a is above b, edge is y = aBottom ≈ b.y.
  if (Math.abs(aBottom - b.y) < 0.5 || Math.abs(bBottom - a.y) < 0.5) {
    const y = Math.abs(aBottom - b.y) < 0.5 ? aBottom : a.y;
    const x1 = Math.max(a.x, b.x);
    const x2 = Math.min(aRight, bRight);
    return { x1, y1: y, x2, y2: y };
  }
  // Non-touching: connect centers.
  return {
    x1: a.x + a.width / 2,
    y1: a.y + a.height / 2,
    x2: b.x + b.width / 2,
    y2: b.y + b.height / 2,
  };
}

/**
 * @public
 */
export function DielinePreview({
  panelMetadata,
  foldConfig,
  templateId,
  sizePx = DEFAULT_SIZE_PX,
  activePanelId,
}: DielinePreviewProps): ReactElement {
  const headerLabel = templateId ? `Dieline preview — ${templateId}` : "Dieline preview";

  if (!panelMetadata || panelMetadata.panels.length === 0) {
    return (
      <section
        data-testid="dieline-preview"
        aria-label="Dieline preview"
        style={{ padding: "0.5rem" }}
      >
        <header style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.5rem" }}>
          {headerLabel}
        </header>
        <div
          data-testid="dieline-preview-empty"
          style={{
            width: sizePx,
            height: sizePx,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px dashed #ccc",
            borderRadius: 4,
            color: "#888",
            fontSize: "0.75rem",
            textAlign: "center",
            padding: "0.5rem",
            boxSizing: "border-box",
          }}
        >
          No dieline loaded
        </div>
      </section>
    );
  }

  const layout = computeDielinePreviewLayout(panelMetadata, foldConfig, sizePx);

  return (
    <section
      data-testid="dieline-preview"
      aria-label="Dieline preview"
      style={{ padding: "0.5rem" }}
    >
      <header style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.5rem" }}>
        {headerLabel}
      </header>
      <svg
        data-testid="dieline-preview-svg"
        width={sizePx}
        height={sizePx}
        viewBox={`0 0 ${sizePx} ${sizePx}`}
        role="img"
        aria-label={`Dieline thumbnail with ${layout.panels.length} panel${layout.panels.length === 1 ? "" : "s"}`}
        style={{ border: "1px solid #ddd", background: "#fafafa", borderRadius: 4 }}
      >
        {layout.panels.map((p) => {
          const isActive = p.id === activePanelId;
          return (
            <rect
              key={p.id}
              data-testid={`dieline-preview-panel-${p.id}`}
              x={p.x}
              y={p.y}
              width={p.width}
              height={p.height}
              fill={isActive ? "#e0ecff" : "#fff"}
              stroke={isActive ? "#2563eb" : "#222"}
              strokeWidth={isActive ? 1.5 : 1}
            />
          );
        })}
        {layout.hinges.map((h) => (
          <line
            key={h.id}
            data-testid={`dieline-preview-hinge-${h.id}`}
            x1={h.x1}
            y1={h.y1}
            x2={h.x2}
            y2={h.y2}
            stroke={h.direction === "mountain" ? "#2563eb" : "#dc2626"}
            strokeWidth={1.5}
            strokeDasharray={h.direction === "valley" ? "3 2" : undefined}
          />
        ))}
      </svg>
    </section>
  );
}
