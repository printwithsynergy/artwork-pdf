// SPDX-License-Identifier: AGPL-3.0-or-later
// Extended DocumentModel with Illustrator-grade features

export type ColorSpace = "CMYK" | "Spot" | "DeviceN" | "RGB" | "Gray";

export type Separation = {
  name: string;
  colorSpace: ColorSpace;
  pantone?: string;
  isTechnical?: boolean;
  // F1 — additive, backward compatible.
  // Spot *identity* resolution stays in codex-pdf (resolve_spot_swatch_color);
  // these fields let a job override or annotate the channel.
  lab?: { L: number; a: number; b: number };
  opacity?: number;
  type?: "ink" | "varnish" | "foil" | "emboss" | "white";
  overprint?: boolean;
  knockout?: boolean;
  order?: number;
};

// F2 — print process / substrate / market context applied at the job level.
// Optional; absent means "use defaults / no constraint".
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

// NEW: Gradient types
export type GradientType = "linear" | "radial";

export type GradientStop = {
  offset: number;      // 0-1
  color: string;       // hex or CMYK string
  opacity?: number;    // 0-1
};

export type Gradient = {
  type: GradientType;
  stops: GradientStop[];
  // Linear: angle in degrees, or use x1,y1,x2,y2
  // Radial: center point and radius
  transform: {
    x1?: number; y1?: number; x2?: number; y2?: number;  // linear
    cx?: number; cy?: number; r?: number;                   // radial
    fx?: number; fy?: number;                              // radial focus
  };
};

// NEW: Blend modes (CSS + Illustrator compatible)
export type BlendMode =
  | "normal" | "multiply" | "screen" | "overlay"
  | "soft-light" | "hard-light" | "color-dodge" | "color-burn"
  | "darken" | "lighten" | "difference" | "exclusion"
  | "hue" | "saturation" | "color" | "luminosity";

// NEW: Effect types (live effects, non-destructive)
export type EffectType =
  | "dropShadow"
  | "innerShadow"
  | "outerGlow"
  | "innerGlow"
  | "blur"
  | "stroke";

export type Effect =
  | { type: "dropShadow"; x: number; y: number; blur: number; color: string; opacity: number; spread?: number }
  | { type: "innerShadow"; x: number; y: number; blur: number; color: string; opacity: number }
  | { type: "outerGlow"; blur: number; color: string; opacity: number; spread?: number }
  | { type: "innerGlow"; blur: number; color: string; opacity: number }
  | { type: "blur"; radius: number }
  | { type: "stroke"; width: number; color: string; position: "inside" | "center" | "outside" };

// NEW: Extended object types
export type ArtworkObjectType =
  | "rect"
  | "ellipse"
  | "path"
  | "text"
  | "image"
  | "line"        // NEW
  | "polygon"     // NEW: configurable sides
  | "star"        // NEW: star shape with inner/outer radius
  | "arc";        // NEW: arc/segment

// NEW: Path point for bezier editing
export type PathPoint = {
  x: number;
  y: number;
  cp1x?: number;      // Control point 1 (incoming curve)
  cp1y?: number;
  cp2x?: number;      // Control point 2 (outgoing curve)
  cp2y?: number;
  type: "corner" | "smooth" | "symmetric";
};

// NEW: Fill type (solid or gradient)
export type Fill = string | Gradient;

// NEW: Stroke configuration
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

// NEW: Typography configuration
export type TypographyConfig = {
  fontFamily: string;
  fontSize: number;
  fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right" | "justify";
  lineHeight?: number;        // multiplier (1.5 = 150%)
  letterSpacing?: number;     // in px/em
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
};

// NEW: Image configuration
export type ImageConfig = {
  src: string;
  crop?: { x: number; y: number; width: number; height: number };
  preserveAspectRatio?: boolean;
};

// Extended ArtworkObject
export type ArtworkObject = {
  id: string;
  type: ArtworkObjectType;

  // Transform (NEW: added rotation, skew)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;        // degrees, clockwise
  skewX?: number;            // degrees
  skewY?: number;            // degrees

  // Fill (NEW: gradient support)
  fill?: Fill;
  fillOpacity?: number;       // 0-1

  // Stroke (NEW: full stroke config)
  stroke?: string | StrokeConfig;
  strokeWidth?: number;       // fallback for simple stroke

  // Effects (NEW)
  effects?: Effect[];

  // Opacity/Blend (NEW: blendMode)
  opacity?: number;           // 0-1
  blendMode?: BlendMode;

  // Text (NEW: typography config)
  text?: string;
  typography?: TypographyConfig;
  // Legacy fallbacks
  fontSize?: number;
  fontFamily?: string;

  // Image (NEW: image config)
  image?: ImageConfig;
  src?: string;               // legacy fallback

  // Path (NEW: points array for editing)
  pathData?: string;
  pathPoints?: PathPoint[];
  pathClosed?: boolean;

  // NEW: Parent/Group hierarchy
  parentId?: string;
  children?: string[];

  // NEW: Clipping
  clipPathId?: string;

  // Shape-specific props (NEW)
  polygonSides?: number;      // for polygon type
  starInnerRadius?: number;   // for star type (0-1 as % of outer)
  starPoints?: number;        // for star type
  arcStartAngle?: number;     // for arc type (degrees)
  arcEndAngle?: number;       // for arc type (degrees)
  arcClosed?: boolean;        // for arc type
};

// NEW: Extended layer types
export type LayerType =
  | "artwork"
  | "dieline"
  | "white"
  | "varnish"
  | "technical"
  | "variable-data"
  | "guide"           // NEW: non-printing guides
  | "template";       // NEW: locked reference

// Extended Layer
export type Layer = {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  locked?: boolean;           // NEW
  expanded?: boolean;         // NEW: layer panel state
  opacity?: number;           // NEW: 0-1
  blendMode?: BlendMode;      // NEW
  separation?: Separation;
  objects: ArtworkObject[];
  parentId?: string;          // NEW: for nested layers
  children?: string[];        // NEW: nested layer IDs
};

// NEW: Dieline template for library
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
  dielineData?: unknown;      // Parsed CF2/DDES/ARD data
  previewSvg?: string;         // SVG preview string
  tags: string[];
  isDefault?: boolean;
};

// Extended DocumentModel
export type DocumentModel = {
  version: "2";               // Bumped for extended types
  width: number;
  height: number;
  unit: "mm" | "in" | "px" | "pt";
  separations: Separation[];
  layers: Layer[];
  // NEW: Dieline reference
  dielineTemplateId?: string;
  // NEW: Document swatches
  swatches?: string[];
  // NEW: Graphic styles
  graphicStyles?: GraphicStyle[];
  flexoDistortion?: { distortionFactorX: number; distortionFactorY: number };
  variableData?: Record<string, string>;
};

// NEW: Graphic style (reusable appearance)
export type GraphicStyle = {
  id: string;
  name: string;
  fill?: Fill;
  stroke?: StrokeConfig;
  effects?: Effect[];
  opacity?: number;
  blendMode?: BlendMode;
};

// NEW: View/preview state (not saved to document)
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
  separationPreview?: string | null;  // null = composite, "C" = cyan only, etc.
};

export type JobOutputFormat = "pdf-x4" | "thumbnail" | "preview-separations";

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
};

// NEW: Google Fonts curated list for print design
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

// NEW: Helper to load Google Font
export function loadGoogleFont(fontFamily: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
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

// NEW: Default new document helper
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
