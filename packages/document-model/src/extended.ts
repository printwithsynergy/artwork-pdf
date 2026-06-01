// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Extended DocumentModel — the v2 wire shape, plus Illustrator-grade
// authoring primitives (gradients, blend modes, live effects, bezier
// paths, typography, dieline references, graphic styles). v2 is
// preserved here for backward compatibility with the editor and
// persisted documents; v3 (`v3.ts`) is the pages-first canonical
// shape going forward. See `migrate.ts` for the lift.

/**
 * Color space of a separation channel. `CMYK` is the four process
 * inks; `Spot` is a named PANTONE-style ink; `DeviceN` is a
 * multi-channel composite (e.g. PANTONE Hexachrome); `RGB`/`Gray` are
 * authoring-side spaces that get converted at render time.
 */
export type ColorSpace = "CMYK" | "Spot" | "DeviceN" | "RGB" | "Gray";

/**
 * One separation plate (printable channel) of the artwork.
 *
 * The optional fields below are additive on top of the core
 * `name` + `colorSpace` shape — a separation can be a plain process
 * ink (`name: "Cyan", colorSpace: "CMYK"`) or a richer spot definition
 * with explicit Lab color, opacity, type, and overprint/knockout
 * behavior.
 *
 * Spot *identity* resolution (mapping a PANTONE name to its measured
 * Lab color) lives in codex-pdf's `resolve_spot_swatch_color`; the
 * `lab` field here lets a job *override* that lookup for a specific
 * channel (e.g. when the press has measured a non-standard mix).
 *
 * `order` controls the print sequence (lower prints first); `type`
 * tags special channels (varnish, foil, emboss, white underbase)
 * that the renderer treats differently from inks.
 */
export type Separation = {
  name: string;
  colorSpace: ColorSpace;
  pantone?: string;
  isTechnical?: boolean;
  lab?: { L: number; a: number; b: number };
  opacity?: number;
  type?: "ink" | "varnish" | "foil" | "emboss" | "white";
  overprint?: boolean;
  knockout?: boolean;
  order?: number;
};

/**
 * Print process / substrate / market context applied at the job level.
 *
 * Optional; absent means "no constraint, use defaults". Drives
 * preflight rule selection (e.g. flexo gets distortion compensation,
 * digital tolerates RGB inputs), color-profile selection, and TAC
 * limit enforcement.
 */
export type PrintContext = {
  process: "offset" | "flexo" | "gravure" | "digital" | "screen";
  substrate: {
    id: string;
    color: string;
    opacity: number;
    finish: "matte" | "gloss" | "satin" | "uncoated";
  };
  targetMarkets?: string[];
  colorProfile?: string;
  tacLimit?: number;
};

/** Linear or radial gradient. */
export type GradientType = "linear" | "radial";

/**
 * One stop on a gradient. `offset` is 0–1 along the gradient axis;
 * `color` is a hex string or CMYK string; `opacity` is 0–1
 * (default 1).
 */
export type GradientStop = {
  offset: number;
  color: string;
  opacity?: number;
};

/**
 * A gradient fill.
 *
 * `transform` carries different coordinates depending on `type`:
 * linear uses `x1,y1 → x2,y2` (the gradient axis); radial uses
 * `cx,cy,r` for the bounding circle and optional `fx,fy` for the
 * focal point. Coordinates are in the parent object's local space
 * (0–1 normalized).
 */
export type Gradient = {
  type: GradientType;
  stops: GradientStop[];
  transform: {
    x1?: number; y1?: number; x2?: number; y2?: number;
    cx?: number; cy?: number; r?: number;
    fx?: number; fy?: number;
  };
};

/**
 * Blend mode for an object or layer. Subset of CSS / Illustrator's
 * shared vocabulary; the renderer maps each to the corresponding PDF
 * blend operator at compose time.
 */
export type BlendMode =
  | "normal" | "multiply" | "screen" | "overlay"
  | "soft-light" | "hard-light" | "color-dodge" | "color-burn"
  | "darken" | "lighten" | "difference" | "exclusion"
  | "hue" | "saturation" | "color" | "luminosity";

/** Discriminator for {@link Effect}. */
export type EffectType =
  | "dropShadow"
  | "innerShadow"
  | "outerGlow"
  | "innerGlow"
  | "blur"
  | "stroke";

/**
 * Live (non-destructive) effect applied to an object.
 *
 * Tagged-union shape — narrow on `type`. Coordinates and widths are
 * in the object's local units; `opacity` is 0–1; colors are hex or
 * CMYK strings.
 */
export type Effect =
  | { type: "dropShadow"; x: number; y: number; blur: number; color: string; opacity: number; spread?: number }
  | { type: "innerShadow"; x: number; y: number; blur: number; color: string; opacity: number }
  | { type: "outerGlow"; blur: number; color: string; opacity: number; spread?: number }
  | { type: "innerGlow"; blur: number; color: string; opacity: number }
  | { type: "blur"; radius: number }
  | { type: "stroke"; width: number; color: string; position: "inside" | "center" | "outside" };

/**
 * Renderable object kind on a layer. Each kind reads a different
 * subset of {@link ArtworkObject} fields — see the field-level docs
 * on `ArtworkObject` for which fields apply to which type.
 */
export type ArtworkObjectType =
  | "rect"
  | "ellipse"
  | "path"
  | "text"
  | "image"
  | "line"
  | "polygon"
  | "star"
  | "arc";

/**
 * One point on a bezier path.
 *
 * `cp1` is the incoming control handle, `cp2` outgoing. `type`
 * controls handle-coupling in the editor: `corner` (handles
 * independent), `smooth` (handles collinear, lengths free),
 * `symmetric` (handles collinear, lengths mirrored).
 */
export type PathPoint = {
  x: number;
  y: number;
  cp1x?: number;
  cp1y?: number;
  cp2x?: number;
  cp2y?: number;
  type: "corner" | "smooth" | "symmetric";
};

/**
 * Fill value — either a solid color (hex / CMYK string) or a
 * {@link Gradient}. Discriminate by `typeof`: strings are solid,
 * objects are gradient.
 */
export type Fill = string | Gradient;

/**
 * Stroke configuration. SVG-aligned semantics — `dashArray` is
 * `[on, off, on, off, ...]` lengths; `dashOffset` shifts the pattern
 * along the path; `miterLimit` caps the miter ratio before falling
 * back to a bevel.
 */
export type StrokeConfig = {
  color: string;
  width: number;
  opacity?: number;
  dashArray?: number[];
  dashOffset?: number;
  lineCap?: "butt" | "round" | "square";
  lineJoin?: "miter" | "round" | "bevel";
  miterLimit?: number;
};

/**
 * Typography configuration for `type: "text"` objects.
 *
 * `lineHeight` is a multiplier (1.5 = 150% of font size);
 * `letterSpacing` is in the object's local units. Fonts not in the
 * curated Google Fonts list ({@link GOOGLE_FONTS_CURATION}) must be
 * resolvable by name at render time — compile-pdf will fail the
 * `font_embedding` preflight check on unknown faces.
 */
export type TypographyConfig = {
  fontFamily: string;
  fontSize: number;
  fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
};

/**
 * Image configuration for `type: "image"` objects.
 *
 * `src` is a URL or an `/assets/:id` reference resolved by
 * apps/service. `crop` is in source-image pixel coordinates and
 * windows the visible area; `preserveAspectRatio` controls letterbox
 * vs stretch behavior when the object's `width`/`height` ratio
 * differs from the crop.
 */
export type ImageConfig = {
  src: string;
  crop?: { x: number; y: number; width: number; height: number };
  preserveAspectRatio?: boolean;
};

/**
 * A renderable object on a layer.
 *
 * The shape is intentionally permissive — many fields apply only to
 * specific `type`s (e.g. `polygonSides` only for `type: "polygon"`,
 * `pathPoints` only for `type: "path"`). Renderers should read the
 * fields relevant to the discriminator and ignore the rest; the
 * editor preserves out-of-band fields on round-trip.
 *
 * Layout: `x,y,width,height` are the bounding box in the parent
 * layer's units; `rotation` is degrees clockwise; `skewX`/`skewY`
 * are in degrees. Transforms compose translate → rotate → skew.
 *
 * Hierarchy: `parentId` + `children` form an in-document tree for
 * groups. `clipPathId` references another object's path geometry as
 * a clip mask.
 *
 * Legacy fields: `stroke` accepts a string for a simple
 * stroke-by-color path; `fontSize`/`fontFamily` / `src` are
 * pre-`typography`/`image` fallbacks preserved for older documents.
 */
export type ArtworkObject = {
  id: string;
  type: ArtworkObjectType;

  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  skewX?: number;
  skewY?: number;

  fill?: Fill;
  fillOpacity?: number;

  stroke?: string | StrokeConfig;
  strokeWidth?: number;

  effects?: Effect[];

  opacity?: number;
  blendMode?: BlendMode;

  text?: string;
  typography?: TypographyConfig;
  fontSize?: number;
  fontFamily?: string;

  image?: ImageConfig;
  src?: string;

  pathData?: string;
  pathPoints?: PathPoint[];
  pathClosed?: boolean;

  parentId?: string;
  children?: string[];

  clipPathId?: string;

  polygonSides?: number;
  starInnerRadius?: number;
  starPoints?: number;
  arcStartAngle?: number;
  arcEndAngle?: number;
  arcClosed?: boolean;
};

/**
 * Layer category.
 *
 * `artwork` is the default ink-bearing content. `dieline` is the
 * structural cut/crease reference (typically non-printing).
 * `white`/`varnish` are technical channels rendered as their named
 * separation. `variable-data` carries personalization tokens.
 * `guide` is editor-only (never printed). `template` is a
 * locked reference (e.g. a positioning guide imported from a master
 * file).
 */
export type LayerType =
  | "artwork"
  | "dieline"
  | "white"
  | "varnish"
  | "technical"
  | "variable-data"
  | "guide"
  | "template";

/**
 * One layer of a v2 document (or one layer within a v3 page).
 *
 * `separation` binds the layer to a specific {@link Separation} —
 * used for `white`, `varnish`, and other technical channels that
 * must render onto a named plate. `parentId`/`children` enable
 * nested layer hierarchies.
 */
export type Layer = {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  locked?: boolean;
  expanded?: boolean;
  opacity?: number;
  blendMode?: BlendMode;
  separation?: Separation;
  objects: ArtworkObject[];
  parentId?: string;
  children?: string[];
};

/**
 * A reusable dieline template — geometry + metadata for a packaging
 * structure (pouch, bottle wrap, carton, etc.).
 *
 * `dielineData` carries the parsed CF2/DDES/ARD structure (shape
 * depends on the source format; see `@artworkpdf/dieline-parser`).
 * `previewSvg` is an inline SVG suitable for thumbnail rendering in
 * the template-picker UI. `tags` and `category` drive editor
 * filtering.
 */
export type DielineTemplate = {
  id: string;
  name: string;
  description: string;
  category: "pouch" | "bottle" | "box" | "label" | "carton" | "sachet" | "other";
  dimensions: {
    widthMm: number;
    heightMm: number;
    depthMm?: number;
  };
  bleedMm: number;
  trimBox: { x: number; y: number; width: number; height: number };
  dielineData?: unknown;
  previewSvg?: string;
  tags: string[];
  isDefault?: boolean;
};

/**
 * The v2 DocumentModel — flat layers, doc-level dimensions, single
 * page by construction. Backward-compatible wire shape; lift to
 * {@link DocumentV3} via `ensureV3()` at any v3-only boundary.
 */
export type DocumentModel = {
  version: "2";
  width: number;
  height: number;
  unit: "mm" | "in" | "px" | "pt";
  separations: Separation[];
  layers: Layer[];
  dielineTemplateId?: string;
  swatches?: string[];
  graphicStyles?: GraphicStyle[];
  flexoDistortion?: { distortionFactorX: number; distortionFactorY: number };
  variableData?: Record<string, string>;
};

/**
 * A reusable appearance bundle — fill, stroke, effects, opacity,
 * blend mode. Applied to objects by name from the editor's
 * graphic-styles panel so a single style change cascades across
 * every consumer in the document.
 */
export type GraphicStyle = {
  id: string;
  name: string;
  fill?: Fill;
  stroke?: StrokeConfig;
  effects?: Effect[];
  opacity?: number;
  blendMode?: BlendMode;
};

/**
 * Editor view/preview state — viewport, visibility toggles, snap
 * settings, current selection, active tool.
 *
 * Intentionally separate from {@link DocumentModel}: this is *not*
 * persisted with the document. Hosts that want to restore the
 * editor view on reload (e.g. last-zoom-and-pan) should persist this
 * separately keyed by user + document.
 *
 * `separationPreview`: `null` (or absent) renders the composite;
 * a separation name (e.g. `"Cyan"`) isolates that channel for soft
 * proofing.
 */
export type EditorViewState = {
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  showRulers: boolean;
  showGuides: boolean;
  showDieline: boolean;
  showBleed: boolean;
  snapToDieline: boolean;
  snapToGrid: boolean;
  snapToPixel: boolean;
  activeLayerId?: string;
  selectedObjectIds: string[];
  activeTool: string;
  separationPreview?: string | null;
};

/**
 * Output format requested on a `/jobs` submission.
 *
 * `pdf-x4` renders a print-ready PDF; `thumbnail` rasterizes a
 * preview image; `preview-separations` emits per-separation PNGs
 * for soft-proofing.
 */
export type JobOutputFormat = "pdf-x4" | "thumbnail" | "preview-separations";

/**
 * Body shape for `POST /jobs`.
 *
 * `preflightReport`, when present, lets the server skip
 * client-evaluable rules (see {@link PreflightReport.skippedChecks}).
 * `preflightConfig` carries the scope keys
 * (`labelClass`/`labelType`/`tenantId`) used to resolve the
 * effective ruleset against the `preflight_rules` table.
 *
 * The optional producer fields (`marksTemplate`, `trapPolicy`,
 * `imposeTemplate`) request that the render handler chain those
 * producers after compose; absent fields skip the producer. See
 * {@link "./producer-plans"} for the wire shapes.
 *
 * `separationsOverride`, when present, gives the editor full control
 * over the declared `Separation[]` for this job — bypasses any
 * separations the renderer would have inferred from the document.
 * Used by the editor's "register as spot" flow to thread named spot
 * inks (with Lab / Pantone) into compile-pdf.
 *
 * Empty-array contract — three states are distinguishable on the wire:
 * - `undefined` (field absent) → renderer infers separations from
 *   the document content as usual.
 * - non-empty `Separation[]` → explicit override; the renderer uses
 *   exactly this list.
 * - `[]` (explicit empty array) → explicit "no separations / produce
 *   composite-only output", *not* a no-op. Callers that mean "infer"
 *   must omit the field.
 */
export type JobSubmitRequest = {
  document: DocumentModel;
  output: { format: JobOutputFormat; colorProfile?: string };
  preflightReport?: import("./preflight.js").PreflightReport;
  preflightConfig?: {
    labelClass?: string;
    labelType?: string;
    tenantId?: string;
    dielineDimensions?: {
      widthMm: number;
      heightMm: number;
      bleedMm: number;
    };
  };
  marksTemplate?: import("./producer-plans.js").MarksPlan;
  trapPolicy?: import("./producer-plans.js").TrapPolicy;
  imposeTemplate?: import("./producer-plans.js").ImposeTemplate;
  separationsOverride?: Separation[];
};

/**
 * Curated list of Google Fonts pre-vetted for print design.
 *
 * Drives the editor's font picker. Adding a font here does *not*
 * automatically permit it on the server — compile-pdf still enforces
 * its own embed-allowlist; this list is purely the editor's offered
 * set.
 */
export const GOOGLE_FONTS_CURATION = [
  { name: "Inter", category: "sans-serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: "Roboto", category: "sans-serif", weights: [100, 300, 400, 500, 700, 900] },
  { name: "Open Sans", category: "sans-serif", weights: [300, 400, 600, 700, 800] },
  { name: "Playfair Display", category: "serif", weights: [400, 500, 600, 700, 800, 900] },
  { name: "Merriweather", category: "serif", weights: [300, 400, 700, 900] },
  { name: "Lato", category: "sans-serif", weights: [100, 300, 400, 700, 900] },
  { name: "Montserrat", category: "sans-serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: "Oswald", category: "sans-serif", weights: [200, 300, 400, 500, 600, 700] },
  { name: "Raleway", category: "sans-serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: "Source Sans Pro", category: "sans-serif", weights: [200, 300, 400, 600, 700, 900] },
  { name: "Poppins", category: "sans-serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: "Bebas Neue", category: "display", weights: [400] },
  { name: "Abril Fatface", category: "display", weights: [400] },
  { name: "Cinzel", category: "serif", weights: [400, 500, 600, 700, 800, 900] },
  { name: "Lora", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Work Sans", category: "sans-serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: "Fira Sans", category: "sans-serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: "Barlow", category: "sans-serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: "IBM Plex Sans", category: "sans-serif", weights: [100, 200, 300, 400, 500, 600, 700] },
  { name: "Libre Baskerville", category: "serif", weights: [400, 700] },
] as const;

/**
 * Dynamically load a Google Font in the browser and resolve once
 * the face is available to the document.
 *
 * Skips the network round-trip when the font is already loaded
 * (checked via `document.fonts.check`). Browser-only: this calls
 * `document.createElement` and `document.fonts`; node consumers
 * should not invoke it.
 *
 * Rejects on `link.onerror` (network/CORS failure) or on
 * `document.fonts.load` failure (font face declared but
 * unrenderable).
 */
export function loadGoogleFont(fontFamily: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.fonts.check(`16px "${fontFamily}"`)) {
      resolve();
      return;
    }

    const link = document.createElement("link");
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, "+")}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
    link.rel = "stylesheet";

    link.onload = async () => {
      try {
        await document.fonts.load(`16px "${fontFamily}"`);
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    link.onerror = reject;
    document.head.appendChild(link);
  });
}

/**
 * Build a fresh, render-ready v2 document for a given dieline.
 *
 * If `dielineTemplate` is omitted, falls back to a 4×6 inch
 * (101.6 × 152.4 mm) page with 3 mm bleed — a sensible default for
 * label and small-carton work. The returned document has:
 *
 * - Bleed-inclusive dimensions (`width` and `height` already include
 *   `bleedMm * 2`).
 * - CMYK separations preloaded.
 * - A locked `dieline` layer and an unlocked `artwork-1` layer.
 * - A small starter swatch list (black, white, R, G, B).
 *
 * Use as the seed for the editor when a user starts from scratch.
 */
export function createDefaultDocument(dielineTemplate?: DielineTemplate): DocumentModel {
  const template = dielineTemplate || {
    dimensions: { widthMm: 101.6, heightMm: 152.4 },
    bleedMm: 3,
  };

  const width = template.dimensions.widthMm + template.bleedMm * 2;
  const height = template.dimensions.heightMm + template.bleedMm * 2;

  return {
    version: "2",
    width,
    height,
    unit: "mm",
    separations: [
      { name: "Cyan", colorSpace: "CMYK" },
      { name: "Magenta", colorSpace: "CMYK" },
      { name: "Yellow", colorSpace: "CMYK" },
      { name: "Black", colorSpace: "CMYK" },
    ],
    layers: [
      {
        id: "dieline",
        type: "dieline",
        name: "Dieline (Template)",
        visible: true,
        locked: true,
        opacity: 1,
        objects: [],
      },
      {
        id: "artwork-1",
        type: "artwork",
        name: "Artwork",
        visible: true,
        locked: false,
        opacity: 1,
        objects: [],
      },
    ],
    ...(dielineTemplate?.id ? { dielineTemplateId: dielineTemplate.id } : {}),
    swatches: ["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF"],
  };
}
