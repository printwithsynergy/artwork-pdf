// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 X3 — Annotation overlay.
 *
 * Renders pinned author annotations from `PageV3.annotations` on top
 * of the canvas. Three kinds, discriminated by `kind`:
 *   - `"point"` — anchor pin with optional note
 *   - `"area"`  — bounded rectangle with optional note
 *   - `"text"`  — anchor pin with a required text body
 *
 * Pure controlled SVG overlay. No state, no DOM events beyond an
 * optional `onSelect` click — the host owns selection / hover /
 * popover UI and writes back to `document.pages[i].annotations`.
 *
 * Pairs with the discriminated union in `@artworkpdf/document-model`'s
 * `Annotation` type. The component duplicates the wire shape locally
 * (same pattern as `BrandAsset` / `PreflightFinding`) so the editor
 * stays consumable without the doc-model SDK.
 *
 * @public
 */

import type { KeyboardEvent, ReactElement } from "react";

/**
 * Fields shared by every annotation variant. Mirrors document-model's
 * internal `AnnotationBase` shape.
 *
 * @public
 */
export type AnnotationBaseInput = {
  id: string;
  x: number;
  y: number;
  author?: string;
  createdAt: string;
  resolved?: boolean;
};

/**
 * Pinpoint annotation — single x/y marker with an optional note.
 * Width / height are forbidden by the union discrimination.
 *
 * @public
 */
export type PointAnnotationInput = AnnotationBaseInput & {
  kind: "point";
  text?: string;
};

/**
 * Bounded-region annotation. `width` / `height` define a rectangle
 * anchored at (`x`, `y`) in page coordinates. `text` is the optional
 * note body.
 *
 * @public
 */
export type AreaAnnotationInput = AnnotationBaseInput & {
  kind: "area";
  width: number;
  height: number;
  text?: string;
};

/**
 * Inline text annotation — anchor pin with a required text body.
 * Use {@link PointAnnotationInput} when the note is optional.
 *
 * @public
 */
export type TextAnnotationInput = AnnotationBaseInput & {
  kind: "text";
  text: string;
};

/**
 * One annotation, discriminated on `kind`. Structurally compatible
 * with document-model's `Annotation` union.
 *
 * @public
 */
export type AnnotationOverlayAnnotation =
  | PointAnnotationInput
  | AreaAnnotationInput
  | TextAnnotationInput;

/**
 * @public
 */
export type AnnotationOverlayProps = {
  /** Annotations to render. Typically `PageV3.annotations ?? []`. */
  annotations: readonly AnnotationOverlayAnnotation[];
  /** Width of the underlying page in CSS pixels. The SVG overlay
   *  matches the host's page-rendering surface so annotation anchors
   *  land where the user placed them. */
  pageWidthPx: number;
  /** Height of the underlying page in CSS pixels. */
  pageHeightPx: number;
  /** When `true`, also render annotations whose `resolved` flag is
   *  `true`. Absent / `false`: resolved annotations are hidden so
   *  the canvas stays focused on open conversations. */
  showResolved?: boolean;
  /** Id of the annotation to render in the "active" style (host-
   *  controlled hover / selection affordance). */
  activeAnnotationId?: string;
  /** Optional click callback. Hosts wire it to open their own
   *  popover / sidebar showing the annotation body, author, etc. */
  onSelect?: (annotation: AnnotationOverlayAnnotation) => void;
};

/**
 * Pixel hit radius around a point / text annotation's anchor. Pretty
 * small so adjacent pins don't fight; hosts that want larger targets
 * can scale the overlay with CSS transforms.
 */
const HIT_RADIUS_PX = 8;

/** Visual marker size (radius) for point + text pins. Slightly
 *  smaller than the hit radius so the cursor finds the center even
 *  on the marker's edge. */
const MARKER_RADIUS_PX = 6;

const COLORS = {
  open: "#dc2626",
  resolved: "#9ca3af",
  active: "#2563eb",
  textBackground: "#fde68a",
  textForeground: "#78350f",
} as const;

/**
 * Filter resolved annotations unless `showResolved` is set. Pure
 * function; exposed for hosts that drive their own renderer.
 *
 * @public
 */
export function visibleAnnotations(
  annotations: readonly AnnotationOverlayAnnotation[],
  showResolved: boolean,
): readonly AnnotationOverlayAnnotation[] {
  if (showResolved) return annotations;
  return annotations.filter((a) => !a.resolved);
}

/**
 * Hit-test an annotation at a point. Point / text annotations use a
 * circular hit zone of {@link HIT_RADIUS_PX} around `(x, y)`; area
 * annotations use the inclusive bounding rectangle. Pure function;
 * exposed so hosts can hit-test against the same algorithm the
 * overlay uses for click handling.
 *
 * @public
 */
export function isPointInsideAnnotation(
  annotation: AnnotationOverlayAnnotation,
  px: number,
  py: number,
): boolean {
  if (annotation.kind === "area") {
    return (
      px >= annotation.x &&
      px <= annotation.x + annotation.width &&
      py >= annotation.y &&
      py <= annotation.y + annotation.height
    );
  }
  const dx = px - annotation.x;
  const dy = py - annotation.y;
  return dx * dx + dy * dy <= HIT_RADIUS_PX * HIT_RADIUS_PX;
}

/**
 * Renders the annotation layer as an absolutely-positioned SVG over
 * the page surface. Pointer events propagate through transparent
 * areas; hosts can stack the overlay over interactive layers without
 * blocking selection of canvas objects.
 *
 * @public
 */
export function AnnotationOverlay({
  annotations,
  pageWidthPx,
  pageHeightPx,
  showResolved,
  activeAnnotationId,
  onSelect,
}: AnnotationOverlayProps): ReactElement {
  const visible = visibleAnnotations(annotations, showResolved ?? false);
  return (
    <svg
      data-testid="annotation-overlay"
      width={pageWidthPx}
      height={pageHeightPx}
      viewBox={`0 0 ${pageWidthPx} ${pageHeightPx}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
      role="img"
      aria-label={`Page annotations (${visible.length})`}
    >
      {visible.map((a) => (
        <AnnotationMarker
          key={a.id}
          annotation={a}
          isActive={a.id === activeAnnotationId}
          onSelect={onSelect}
        />
      ))}
    </svg>
  );
}

/**
 * Renders a single annotation marker. Switches on `kind`: area
 * draws a translucent rectangle, point + text draw a circular pin.
 * Text annotations get a small badge so the operator can distinguish
 * them from notes-optional points at a glance.
 *
 * Intra-package helper — not exported.
 */
function AnnotationMarker({
  annotation,
  isActive,
  onSelect,
}: {
  annotation: AnnotationOverlayAnnotation;
  isActive: boolean;
  onSelect: ((a: AnnotationOverlayAnnotation) => void) | undefined;
}): ReactElement {
  const color = isActive ? COLORS.active : annotation.resolved ? COLORS.resolved : COLORS.open;
  const cursor = onSelect ? "pointer" : "default";
  const handleClick = onSelect ? () => onSelect(annotation) : undefined;
  // Enter / Space activate the marker via keyboard — keeps the SVG
  // overlay accessible to keyboard-only users while the host still
  // owns higher-level focus management (tab order, roving index).
  const handleKey = onSelect
    ? (e: KeyboardEvent<SVGGElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(annotation);
        }
      }
    : undefined;
  const interactiveProps = onSelect
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": `Annotation ${annotation.id}`,
      }
    : {};

  if (annotation.kind === "area") {
    return (
      <g
        data-testid={`annotation-${annotation.id}`}
        style={{ pointerEvents: "auto", cursor }}
        onClick={handleClick}
        onKeyDown={handleKey}
        {...interactiveProps}
      >
        <rect
          x={annotation.x}
          y={annotation.y}
          width={annotation.width}
          height={annotation.height}
          fill={color}
          fillOpacity={0.1}
          stroke={color}
          strokeWidth={isActive ? 2 : 1}
          strokeDasharray={annotation.resolved ? "4 2" : undefined}
        />
      </g>
    );
  }

  const isTextKind = annotation.kind === "text";
  return (
    <g
      data-testid={`annotation-${annotation.id}`}
      style={{ pointerEvents: "auto", cursor }}
      onClick={handleClick}
      onKeyDown={handleKey}
      {...interactiveProps}
    >
      <circle
        cx={annotation.x}
        cy={annotation.y}
        r={MARKER_RADIUS_PX}
        fill={isTextKind ? COLORS.textBackground : color}
        stroke={color}
        strokeWidth={isActive ? 2 : 1}
      />
      {/* The "T" badge differentiates a required-body text
       * annotation from a notes-optional point at first glance.
       * `aria-hidden` would conflict with the focusable parent
       * `<g role="button">`, so the badge stays in the a11y tree;
       * the parent's `aria-label` already names the annotation. */}
      {isTextKind && (
        <text
          x={annotation.x}
          y={annotation.y + 3}
          textAnchor="middle"
          fontSize="7"
          fontWeight="bold"
          fill={COLORS.textForeground}
        >
          T
        </text>
      )}
    </g>
  );
}
