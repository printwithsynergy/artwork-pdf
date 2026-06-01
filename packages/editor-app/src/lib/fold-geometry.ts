// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Editor-side structural mirror of `@artworkpdf/document-model`'s
 * `FoldGeometryPanel`. Kept inline so the editor-app package stays
 * consumable by hosts that don't pull document-model in — the wire
 * shape is structurally compatible.
 *
 * @public
 */
export type FoldGeometryPanel = {
  id: string;
  pathData: string;
  bbox: { x: number; y: number; width: number; height: number };
  role?: string;
  name?: string;
};

/**
 * Editor-side structural mirror of `@artworkpdf/document-model`'s
 * `FoldGeometryPanelMetadata`.
 *
 * @public
 */
export type FoldGeometryPanelMetadata = {
  panels: FoldGeometryPanel[];
};

/**
 * Editor-side structural mirror of `@artworkpdf/document-model`'s
 * `FoldGeometryEdge`.
 *
 * @public
 */
export type FoldGeometryEdge = {
  id: string;
  panelA: string;
  panelB: string;
  angleDeg: number;
  direction?: "mountain" | "valley";
};

/**
 * Editor-side structural mirror of `@artworkpdf/document-model`'s
 * `FoldGeometryConfig`.
 *
 * @public
 */
export type FoldGeometryConfig = {
  edges: FoldGeometryEdge[];
  defaultAngleDeg?: number;
};

/**
 * S4 — fold-geometry math.
 *
 * Pure functions that convert a {@link FoldGeometryPanelMetadata} + {@link FoldGeometryConfig}
 * pair into the data a 3D renderer needs to draw a folded carton:
 * per-panel quads in 3D space, and per-edge hinge axes.
 *
 * No Three.js / React / DOM imports — this file is the unit-testable
 * core that the {@link import("../components/FoldPreviewOverlay").FoldPreviewOverlay}
 * component drives. Hosts wanting an alternative renderer (Babylon,
 * raw WebGL) can consume these helpers directly.
 *
 * Coordinate system
 * -----------------
 * - 2D inputs (`bbox.x`, `bbox.y`, `bbox.width`, `bbox.height`) are
 *   in page-local units; the conventions match {@link PageV3.unit}.
 * - 3D outputs are in the same units — no rescaling — with the page
 *   plane as the XY plane (Z = 0 when fully unfolded) and Z+ pointing
 *   up out of the page. Mountain folds bend Z+; valley folds bend Z-.
 * - Angles are in degrees clockwise around the hinge axis (Z+ is the
 *   handedness for the right-hand rule on the hinge direction).
 *
 * Wave 2 PR-3 scope: a flat layout (every panel at Z=0, no folding
 * applied) plus the hinge metadata. PR-4 adds interactive angle
 * scrubbing that drives `applyFolds()` over this scaffold.
 */

/**
 * Output shape — one panel projected into 3D space as a four-corner
 * quad. The quad is wound counter-clockwise viewed from +Z (the
 * standard "front face" convention).
 *
 * @public
 */
export type FoldPanelQuad = {
  /** Source {@link FoldGeometryPanel.id} this quad represents. */
  panelId: string;
  /** Four corners in world space. Order: top-left, top-right,
   *  bottom-right, bottom-left when viewed from +Z. Each corner is
   *  `[x, y, z]`. */
  corners: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ];
};

/**
 * Output shape — one hinge axis projected into 3D space.
 *
 * @public
 */
export type FoldHingeAxis = {
  /** Source {@link FoldGeometryEdge.id} this axis represents. */
  edgeId: string;
  /** Hinge start in world space. */
  from: readonly [number, number, number];
  /** Hinge end in world space. */
  to: readonly [number, number, number];
  /** Mountain (Z+) or valley (Z-) bend handedness. */
  direction: "mountain" | "valley";
};

/**
 * Aggregate scene specification — everything a Three.js scene needs
 * to draw the foldable artwork.
 *
 * @public
 */
export type FoldSceneSpec = {
  panels: FoldPanelQuad[];
  hinges: FoldHingeAxis[];
  /** AABB of every projected panel; useful for camera framing. */
  bounds: {
    min: readonly [number, number, number];
    max: readonly [number, number, number];
  };
};

const EMPTY_BOUNDS = {
  min: [0, 0, 0] as const,
  max: [0, 0, 0] as const,
};

/**
 * Build a {@link FoldSceneSpec} from a panel registry and (optional)
 * fold config.
 *
 * PR-3 scope: emits a *flat* layout — every panel sits at Z=0 with
 * its bbox-derived corners. The fold angles in `foldConfig` are
 * carried through onto the hinge axes for downstream renderers but
 * are not applied to panel positions here. PR-4 adds `applyFolds()`
 * which mutates panel corners according to the angles.
 *
 * Returns an empty spec when `panels` is empty.
 *
 * @public
 */
export function buildFoldScene(
  panelMetadata: FoldGeometryPanelMetadata,
  foldConfig?: FoldGeometryConfig,
): FoldSceneSpec {
  const panels = panelMetadata.panels.map(panelToQuad);
  const hinges = foldConfig ? foldConfig.edges.map((e) => edgeToHinge(e, panelMetadata)) : [];
  const validHinges = hinges.filter((h): h is FoldHingeAxis => h !== null);
  return {
    panels,
    hinges: validHinges,
    bounds: panels.length === 0 ? EMPTY_BOUNDS : computeBounds(panels),
  };
}

/** Flip a 2D page-coord Y into 3D world Y. Normalizes IEEE-754
 *  negative-zero (`-0`) to positive zero so test equality and JSON
 *  serialization don't surprise consumers. */
function flipY(y: number): number {
  const flipped = -y;
  return flipped === 0 ? 0 : flipped;
}

function panelToQuad(panel: FoldGeometryPanel): FoldPanelQuad {
  const { x, y, width, height } = panel.bbox;
  // Wind counter-clockwise viewed from +Z; +Y points away from
  // viewer in the page-coord convention, so we flip Y here so the
  // 3D scene reads the same way as the canvas.
  return {
    panelId: panel.id,
    corners: [
      [x, flipY(y), 0],
      [x + width, flipY(y), 0],
      [x + width, flipY(y + height), 0],
      [x, flipY(y + height), 0],
    ],
  };
}

function edgeToHinge(
  edge: FoldGeometryEdge,
  panelMetadata: FoldGeometryPanelMetadata,
): FoldHingeAxis | null {
  // The hinge is the shared edge between two panels. Find both, then
  // use the closer pair of bbox edges as the hinge axis. Dangling
  // edge refs (panelA/panelB ids not present) are skipped — the
  // editor enforces referential integrity on save, but renderers
  // should be defensive.
  const a = panelMetadata.panels.find((p) => p.id === edge.panelA);
  const b = panelMetadata.panels.find((p) => p.id === edge.panelB);
  if (!a || !b) return null;

  const seam = sharedEdge(a, b);
  if (!seam) return null;

  return {
    edgeId: edge.id,
    from: [seam.from[0], flipY(seam.from[1]), 0],
    to: [seam.to[0], flipY(seam.to[1]), 0],
    direction: edge.direction ?? "mountain",
  };
}

type Edge2D = {
  from: readonly [number, number];
  to: readonly [number, number];
};

/** Find the closest aligned pair of bbox edges between two panels.
 *  Returns the seam in page-local 2D coords, or `null` when the
 *  panels don't share an edge within a 0.5-unit tolerance. */
function sharedEdge(a: FoldGeometryPanel, b: FoldGeometryPanel): Edge2D | null {
  const TOL = 0.5;
  const ar = bboxRect(a.bbox);
  const br = bboxRect(b.bbox);

  // Vertical seam: a's right edge meets b's left, or vice versa.
  if (Math.abs(ar.x + ar.w - br.x) < TOL) {
    const y0 = Math.max(ar.y, br.y);
    const y1 = Math.min(ar.y + ar.h, br.y + br.h);
    if (y1 > y0) return { from: [br.x, y0], to: [br.x, y1] };
  }
  if (Math.abs(br.x + br.w - ar.x) < TOL) {
    const y0 = Math.max(ar.y, br.y);
    const y1 = Math.min(ar.y + ar.h, br.y + br.h);
    if (y1 > y0) return { from: [ar.x, y0], to: [ar.x, y1] };
  }
  // Horizontal seam: a's bottom edge meets b's top, or vice versa.
  if (Math.abs(ar.y + ar.h - br.y) < TOL) {
    const x0 = Math.max(ar.x, br.x);
    const x1 = Math.min(ar.x + ar.w, br.x + br.w);
    if (x1 > x0) return { from: [x0, br.y], to: [x1, br.y] };
  }
  if (Math.abs(br.y + br.h - ar.y) < TOL) {
    const x0 = Math.max(ar.x, br.x);
    const x1 = Math.min(ar.x + ar.w, br.x + br.w);
    if (x1 > x0) return { from: [x0, ar.y], to: [x1, ar.y] };
  }
  return null;
}

function bboxRect(bbox: FoldGeometryPanel["bbox"]): { x: number; y: number; w: number; h: number } {
  return { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height };
}

function computeBounds(panels: FoldPanelQuad[]): FoldSceneSpec["bounds"] {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const p of panels) {
    for (const [x, y, z] of p.corners) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
  }
  return {
    min: [minX, minY, minZ] as const,
    max: [maxX, maxY, maxZ] as const,
  };
}
