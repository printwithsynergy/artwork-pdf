// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Wave 2 S3 — panel-anchored objects.
 *
 * Lightweight hit-testing + lookup helpers for binding canvas objects
 * to a specific {@link DielinePanel}. The document-model already
 * carries the anchor id (`ArtworkObject.anchorPanelId`); these
 * helpers complete the editor-side wiring so hosts can:
 *
 *   - resolve which panel a click landed on (`findPanelAt`)
 *   - look up an anchored panel by id (`getPanelById`)
 *   - compute an object's effective parent panel during layout
 *
 * The current implementation uses bbox-only hit-testing — fast, good
 * enough for orthogonal carton dielines, and side-step's polygon /
 * SVG-`d` parsing. Hosts that ship complex non-rectangular panels
 * (e.g. organic pouches) can extend by walking each panel's
 * `pathData` themselves and bypass `findPanelAt`.
 *
 * @public
 */

/**
 * Editor-side mirror of `@artworkpdf/document-model`'s `DielinePanel`.
 * Duplicated here to keep `editor-app` consumable without the
 * document-model peer dep (same pattern as `EditorSeparation` and
 * `FoldGeometryPanelMetadata`).
 *
 * @public
 */
export type EditorDielinePanel = {
  id: string;
  name?: string;
  pathData: string;
  bbox: { x: number; y: number; width: number; height: number };
  role?: "front" | "back" | "top" | "bottom" | "left" | "right" | "flap" | "glue" | "other";
};

/**
 * Point-in-bbox test for a single panel. Returns `true` when the
 * point falls strictly inside (right + bottom edges are inclusive of
 * the inside, exclusive of neighbouring panels — matches Konva's
 * default hit-target semantics).
 *
 * @public
 */
export function isPointInPanel(
  point: { x: number; y: number },
  panel: EditorDielinePanel,
): boolean {
  const { x, y, width, height } = panel.bbox;
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
}

/**
 * Return the first panel that contains `point`, or `undefined` when
 * the click landed outside every panel (over the bleed area, say).
 *
 * Panels are checked in declaration order; hosts that emit overlapping
 * panels (e.g. a glue flap that overlaps a front face) get the
 * first-match semantics they need by ordering the array
 * front-of-rendering-stack first.
 *
 * @public
 */
export function findPanelAt(
  point: { x: number; y: number },
  panels: readonly EditorDielinePanel[],
): EditorDielinePanel | undefined {
  return panels.find((p) => isPointInPanel(point, p));
}

/**
 * Convenience lookup — returns the panel with the given id, or
 * `undefined` if the anchor is stale (e.g. the dieline was
 * regenerated and the previous panel ids no longer exist).
 *
 * @public
 */
export function getPanelById(
  id: string,
  panels: readonly EditorDielinePanel[],
): EditorDielinePanel | undefined {
  return panels.find((p) => p.id === id);
}

/**
 * Compute an object's effective parent panel:
 *   - if `anchorPanelId` is set and resolves, return that panel
 *   - otherwise fall back to whichever panel contains the object's
 *     current `(x, y)` position
 *
 * Returns `undefined` when neither resolves — the object is free-
 * floating (positioned in page coordinates, not panel-relative).
 *
 * Hosts call this on every commit to keep the visible "anchored to
 * X" badge in sync.
 *
 * @public
 */
export function resolveAnchorPanel(
  obj: { x: number; y: number; anchorPanelId?: string },
  panels: readonly EditorDielinePanel[],
): EditorDielinePanel | undefined {
  if (obj.anchorPanelId) {
    const explicit = getPanelById(obj.anchorPanelId, panels);
    if (explicit) return explicit;
  }
  return findPanelAt({ x: obj.x, y: obj.y }, panels);
}
