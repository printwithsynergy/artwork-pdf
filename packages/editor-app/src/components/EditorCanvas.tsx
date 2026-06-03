// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { PDFDocument } from "pdf-lib";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Path,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import { DEFAULT_BLEED_MM, formatBleed } from "../lib/bleed";
import { type DielineTemplate, templateToInitialState } from "../lib/dieline-template";
import type { EditorConfig } from "../lib/editor-config";
import { isPanelVisible, showFeature } from "../lib/editor-config";
import type { PreflightReport } from "../lib/preflight/types";
import { type EditorSeparation, findSpotByColor, registerSpot } from "../lib/separations-registry";
import { type BrailleSpec, MARBURG_MEDIUM, composeBraille } from "./BraillePanel";
import { DielineLibraryModal } from "./DielineLibraryModal";
import { HistoryPanel } from "./HistoryPanel";
import { LayersPanel } from "./LayersPanel";
import { MobileToolDrawer } from "./MobileToolDrawer";
import {
  DEFAULT_NUTRITION_FACTS,
  DEFAULT_NUTRITION_STYLE,
  type NutritionFacts,
  type NutritionStyle,
  composeNutritionFacts,
} from "./NutritionPanel";
import { RightRailAccordion } from "./RightRailAccordion";
import { TacOverlay } from "./TacOverlay";

// ── types ─────────────────────────────────────────────────────────────────────

// Structural shape of the production export request, kept inline so
// the published package doesn't depend on @artworkpdf/document-model.
// Mirrors the JobSubmitRequest shape consumed by apps/service.
type ProductionExportRequest = {
  document: {
    version: "2";
    width: number;
    height: number;
    unit: "pt";
    separations: unknown[];
    layers: Array<{
      id: string;
      type: "artwork";
      name: string;
      visible: boolean;
      objects: Array<Record<string, unknown>>;
    }>;
  };
  output: { format: "pdf-x4" };
  preflightReport?: PreflightReport;
  /** AI4 — editor's registered spot inks. When non-empty, threaded
   *  through compile-pdf as the source-of-truth separation list
   *  (bypasses what the renderer would infer from document content). */
  separationsOverride?: WireSeparation[];
};

/**
 * Wire shape sent to compile-pdf as `separationsOverride`. Mirrors
 * `EditorSeparation` minus the editor-only `hex` lookup key — the
 * remaining fields are structurally identical to document-model's
 * `Separation`, so this satisfies the apps/service shape on the wire
 * without pulling document-model as a dep.
 */
type WireSeparation = Omit<EditorSeparation, "hex">;

type Tool = "select" | "rect" | "ellipse" | "text" | "image" | "nutrition" | "braille";

type ObjType = "rect" | "ellipse" | "text" | "image" | "path" | "nutrition" | "braille";

/**
 * One renderable object on the editor canvas.
 *
 * Intentionally a flat, structural shape (not the richer
 * `@artworkpdf/document-model` `ArtworkObject`) — the published
 * package stays consumable by hosts that don't pull in the
 * document-model dep. The structural fields here mirror the
 * `JobSubmitRequest` payload sent to `apps/service`.
 *
 * `name` falls back to `type` when absent; `locked` makes the object
 * non-interactive (used for the dieline trim rect so users can't
 * drag the trim out of position).
 *
 * @public
 */
export type CanvasObj = {
  id: string;
  type: ObjType;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  src?: string;
  pathData?: string;
  imageEl?: HTMLImageElement;
  /** Display name shown in the Layers panel. Falls back to the type
   *  when absent. The dieline rect sets this to "Die Line". */
  name?: string;
  /** When true, the object is non-interactive: not draggable,
   *  not selectable, not transformable. Used for the dieline
   *  template rect — users shouldn't be able to move the trim. */
  locked?: boolean;
  /** Source data for type=`"nutrition"` objects. The visual is
   *  derived at render time via `composeNutritionFacts(facts)`; edits
   *  to fields in the properties panel flow back into this record. */
  nutritionFacts?: NutritionFacts;
  /** Optional style overrides for type=`"nutrition"` objects (font
   *  family + per-role scale multipliers). Missing → FDA baseline
   *  via {@link DEFAULT_NUTRITION_STYLE}. */
  nutritionStyle?: NutritionStyle;
  /** Source data for type=`"braille"` objects. The visual (cell + dot
   *  positions) is derived at render time via `composeBraille(spec)`. */
  brailleSpec?: BrailleSpec;
};

type ExportStatus = "idle" | "sending" | "polling" | "done" | "error";

type Drawing = { x: number; y: number; w: number; h: number };

type Props = {
  file?: File | null;
  report?: PreflightReport | null;
  demo?: boolean;
  initialObjects?: CanvasObj[];
  initialPageSize?: { width: number; height: number };
  mode?: "basic" | "pro";
  onModeChange?: (m: "basic" | "pro") => void;
  config: EditorConfig;
  bleedMm?: number;
  isMobile?: boolean;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  /** Fired whenever the canvas's objects change (drawing, drag, transform,
   *  delete, undo/redo, applyDieline). Used by the multi-page wrapper to
   *  keep the parent's `pages` array in sync. */
  onObjectsChange?: (objects: CanvasObj[]) => void;
  /** Fired whenever the page size changes (template apply, bleed override,
   *  uploaded-PDF parse). */
  onPageSizeChange?: (pageSize: { width: number; height: number }) => void;
  /** Fired whenever the bleed value changes (drawer input or URL prop sync). */
  onBleedMmChange?: (bleedMm: number) => void;
  /** AI4: initial spots registered on this page. Threads through to
   *  compile-pdf's `separationsOverride` at export time.
   *
   *  **Seed-only semantic:** like `initialObjects` and
   *  `initialPageSize`, this prop is read once at mount. EditorApp's
   *  multi-page wrapper re-mounts EditorCanvas on each page switch
   *  (via `key={activePage.id}`), so the per-page seed flows
   *  naturally. Hosts that mutate this prop on the live component
   *  without changing the `key` will not see the change reflected. */
  initialSeparations?: EditorSeparation[];
  /** Fired whenever the spot registry changes (register/unregister via
   *  the fill/stroke pickers' "as spot" affordance). */
  onSeparationsChange?: (separations: EditorSeparation[]) => void;
  /** Extra collapsible sections added to the *top* of the mobile drawer
   *  (used by `EditorApp` to insert the `PageNavigator` stack when the
   *  document is multi-page). */
  prependDrawerSections?: Array<{
    title: string;
    content: import("react").ReactNode;
    defaultOpen?: boolean;
  }>;
};

// ── constants ─────────────────────────────────────────────────────────────────

const SERVICE_URL = (process.env.NEXT_PUBLIC_SERVICE_URL ?? "http://localhost:3001").replace(
  /\/$/,
  "",
);

const BRAND = "#fc5102";
const PANEL_BG = "#1a0f08";
const BORDER = "#3d1a00";
const MUTED = "#666";

// ── helper: load image element ────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new window.Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// ── helper: default placement size for tap-to-place tools ───────────────────
//
// Tap-to-place tools (nutrition, braille) drop an object at the
// pointer at a sensible default size. The user can then adjust via
// the Transformer handles or the properties footer's W/H inputs.

function defaultPlacementSize(t: Tool): { width: number; height: number } {
  switch (t) {
    case "nutrition":
      // FDA panel proportions — narrow and tall.
      return { width: 200, height: 380 };
    case "braille":
      // Roughly 5 cells of "HELLO" at Marburg Medium scale.
      // Approx 35 mm × 8 mm → ~99pt × 23pt at 72/25.4.
      return { width: 100, height: 24 };
    default:
      return { width: 100, height: 100 };
  }
}

// ── helper: get pointer relative to stage content (ignoring stage transform) ──

function stagePointer(stage: Konva.Stage): { x: number; y: number } {
  const pos = stage.getPointerPosition() ?? { x: 0, y: 0 };
  return {
    x: (pos.x - stage.x()) / stage.scaleX(),
    y: (pos.y - stage.y()) / stage.scaleY(),
  };
}

// ── sub-component: single object node ────────────────────────────────────────

// ── FDA Nutrition Facts visual ────────────────────────────────────
//
// Renders a placed nutrition canvas object as a real FDA Nutrition
// Facts panel — bold "Nutrition Facts" header, thick black rules,
// right-aligned Calories number, right-aligned % Daily Value column,
// indented sub-nutrients, micronutrient footer. Layout proportions
// derive from the 2020 FDA spec (21 CFR §101.9); the visual is a
// reasonable approximation, not pixel-perfect for filing.
//
// All measurements are in PDF points (the canvas's working unit).

type NutritionFactsVisualProps = {
  facts: NutritionFacts;
  /** Style overrides; defaults to FDA baseline via
   *  {@link DEFAULT_NUTRITION_STYLE}. */
  style?: NutritionStyle;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
};

// Baseline FDA sizes (in pt) — multiplied by `style.scale * style.<role>Scale`
// at render time. The ratios match §101.9(d)(1)(ii): title largest,
// Calories second-largest, body small, footnote smallest.
const NF_BASE = {
  pad: 6,
  rowH: 14,
  titleMaxPt: 28,
  // Title shrinks to fit narrow panels — CONTENT_W / titleFitDivisor
  // is the upper bound when below the cap.
  titleFitDivisor: 7.5,
  servingsLinePt: 9,
  servingSizeLabelPt: 9,
  servingSizeValuePt: 11,
  amountPerPt: 8,
  caloriesLabelPt: 16,
  caloriesValuePt: 22,
  dvHeaderPt: 8,
  macroRowPt: 10,
  microRowPt: 9,
  footnotePt: 7,
};

function NutritionFactsVisual({
  facts,
  style,
  width,
  height,
  fill,
  stroke,
  strokeWidth,
}: NutritionFactsVisualProps) {
  const spec = composeNutritionFacts(facts);
  const s = style ?? DEFAULT_NUTRITION_STYLE;
  // Compound multipliers — global scale × per-role scale.
  const layoutMul = s.scale;
  const titleMul = s.scale * s.titleScale;
  const caloriesMul = s.scale * s.caloriesScale;
  const bodyMul = s.scale * s.bodyScale;
  const fontFamily = s.fontFamily;

  const PAD = NF_BASE.pad * layoutMul;
  const CONTENT_W = width - PAD * 2;
  const TEXT = "#0a0a0a";

  // Right-column widths for the DV% percentages — scale with body
  // size since they sit next to the macro/micro rows.
  const DV_W = 36 * bodyMul;
  // Amount column sits to the left of DV%; label column eats the
  // remaining space.
  const AMT_W = 60 * bodyMul;
  const LABEL_W = CONTENT_W - AMT_W - DV_W;

  // Calories block content.
  const caloriesValue = String(facts.calories);

  // Build the row list. The composer produces canonical FDA order +
  // bold/indent flags; we render a thin rule between every row and
  // a thick rule after Protein (the last macro). Micronutrients
  // follow with a different layout (label + DV% only — no amount).
  const isMicro = (label: string): boolean =>
    label === "Vitamin D" || label === "Calcium" || label === "Iron" || label === "Potassium";

  const macroRows = spec.rows.filter((r) => !isMicro(r.label));
  const microRows = spec.rows.filter((r) => isMicro(r.label));

  // Row heights scale with body text.
  const ROW_H = NF_BASE.rowH * bodyMul;

  // Accumulate y as we render.
  const elements: ReactNode[] = [];
  let y = PAD;

  // Title — bold extra-large. The FDA spec calls for "highly visible"
  // typography; we cap at the baseline 28pt × titleMul and scale down
  // for narrow panels using the same divisor.
  const titleSize = Math.min(
    NF_BASE.titleMaxPt * titleMul,
    (CONTENT_W / NF_BASE.titleFitDivisor) * titleMul,
  );
  elements.push(
    <Text
      key="title"
      text="Nutrition Facts"
      x={PAD}
      y={y}
      width={CONTENT_W}
      fontSize={titleSize}
      fontStyle="bold"
      fontFamily={fontFamily}
      fill={TEXT}
    />,
  );
  y += titleSize + 4 * layoutMul;

  // Thin rule under title.
  elements.push(<Rect key="r1" x={PAD} y={y} width={CONTENT_W} height={1} fill={TEXT} />);
  y += 4 * layoutMul;

  // Servings line.
  elements.push(
    <Text
      key="servings"
      text={spec.servingsLine}
      x={PAD}
      y={y}
      width={CONTENT_W}
      fontSize={NF_BASE.servingsLinePt * bodyMul}
      fontFamily={fontFamily}
      fill={TEXT}
    />,
  );
  y += 11 * bodyMul;

  // Serving size — "Serving size" label left, value bold right.
  elements.push(
    <Text
      key="ssz-label"
      text="Serving size"
      x={PAD}
      y={y}
      fontSize={NF_BASE.servingSizeLabelPt * bodyMul}
      fontFamily={fontFamily}
      fill={TEXT}
    />,
    <Text
      key="ssz-value"
      text={spec.servingSize}
      x={PAD}
      y={y}
      width={CONTENT_W}
      align="right"
      fontSize={NF_BASE.servingSizeValuePt * bodyMul}
      fontStyle="bold"
      fontFamily={fontFamily}
      fill={TEXT}
    />,
  );
  y += 14 * bodyMul;

  // Thick rule (the iconic FDA black band).
  elements.push(
    <Rect key="r-thick-1" x={PAD} y={y} width={CONTENT_W} height={6 * layoutMul} fill={TEXT} />,
  );
  y += 10 * layoutMul;

  // "Amount per serving" + Calories number on the right.
  elements.push(
    <Text
      key="amount-per"
      text="Amount per serving"
      x={PAD}
      y={y}
      fontSize={NF_BASE.amountPerPt * bodyMul}
      fontStyle="bold"
      fontFamily={fontFamily}
      fill={TEXT}
    />,
  );
  y += 11 * bodyMul;

  // Calories — "Calories" label bold large left, number bold huge right.
  elements.push(
    <Text
      key="cal-label"
      text="Calories"
      x={PAD}
      y={y + 3 * caloriesMul}
      fontSize={NF_BASE.caloriesLabelPt * caloriesMul}
      fontStyle="bold"
      fontFamily={fontFamily}
      fill={TEXT}
    />,
    <Text
      key="cal-value"
      text={caloriesValue}
      x={PAD}
      y={y}
      width={CONTENT_W}
      align="right"
      fontSize={NF_BASE.caloriesValuePt * caloriesMul}
      fontStyle="bold"
      fontFamily={fontFamily}
      fill={TEXT}
    />,
  );
  y += 26 * caloriesMul;

  // Medium rule.
  elements.push(
    <Rect key="r2" x={PAD} y={y} width={CONTENT_W} height={2 * layoutMul} fill={TEXT} />,
  );
  y += 3 * layoutMul;

  // "% Daily Value*" right-aligned, small bold.
  elements.push(
    <Text
      key="dv-header"
      text="% Daily Value*"
      x={PAD}
      y={y}
      width={CONTENT_W}
      align="right"
      fontSize={NF_BASE.dvHeaderPt * bodyMul}
      fontStyle="bold"
      fontFamily={fontFamily}
      fill={TEXT}
    />,
  );
  y += 11 * bodyMul;

  // Thin rule below DV header.
  elements.push(<Rect key="r3" x={PAD} y={y} width={CONTENT_W} height={1} fill={TEXT} />);
  y += 2 * layoutMul;

  // Macro rows with thin separators.
  for (const [i, row] of macroRows.entries()) {
    const indentPx = row.indent * 10 * bodyMul;
    const indentX = PAD + indentPx;
    elements.push(
      <Text
        key={`m-${i}-label`}
        text={row.label}
        x={indentX}
        y={y}
        width={LABEL_W - indentPx}
        fontSize={NF_BASE.macroRowPt * bodyMul}
        fontStyle={row.bold ? "bold" : "normal"}
        fontFamily={fontFamily}
        fill={TEXT}
      />,
      <Text
        key={`m-${i}-amt`}
        text={row.amount}
        x={PAD + LABEL_W}
        y={y}
        width={AMT_W}
        fontSize={NF_BASE.macroRowPt * bodyMul}
        fontFamily={fontFamily}
        fill={TEXT}
      />,
    );
    if (row.dvPct !== undefined) {
      elements.push(
        <Text
          key={`m-${i}-dv`}
          text={`${row.dvPct}%`}
          x={PAD + LABEL_W + AMT_W}
          y={y}
          width={DV_W}
          align="right"
          fontSize={NF_BASE.macroRowPt * bodyMul}
          fontStyle="bold"
          fontFamily={fontFamily}
          fill={TEXT}
        />,
      );
    }
    y += ROW_H;
    elements.push(
      <Rect key={`m-${i}-rule`} x={PAD} y={y - 2} width={CONTENT_W} height={0.5} fill={TEXT} />,
    );
  }

  if (microRows.length > 0) {
    // Thick rule before the micronutrient block.
    elements.push(
      <Rect key="r-thick-2" x={PAD} y={y} width={CONTENT_W} height={4 * layoutMul} fill={TEXT} />,
    );
    y += 6 * layoutMul;

    for (const [i, row] of microRows.entries()) {
      elements.push(
        <Text
          key={`u-${i}-label`}
          text={row.label}
          x={PAD}
          y={y}
          width={LABEL_W + AMT_W}
          fontSize={NF_BASE.microRowPt * bodyMul}
          fontFamily={fontFamily}
          fill={TEXT}
        />,
        <Text
          key={`u-${i}-amt`}
          text={row.amount}
          x={PAD + LABEL_W}
          y={y}
          width={AMT_W}
          fontSize={NF_BASE.microRowPt * bodyMul}
          fontFamily={fontFamily}
          fill={TEXT}
        />,
      );
      if (row.dvPct !== undefined) {
        elements.push(
          <Text
            key={`u-${i}-dv`}
            text={`${row.dvPct}%`}
            x={PAD + LABEL_W + AMT_W}
            y={y}
            width={DV_W}
            align="right"
            fontSize={NF_BASE.microRowPt * bodyMul}
            fontStyle="bold"
            fontFamily={fontFamily}
            fill={TEXT}
          />,
        );
      }
      y += ROW_H - 1;
      if (i < microRows.length - 1) {
        elements.push(
          <Rect key={`u-${i}-rule`} x={PAD} y={y - 2} width={CONTENT_W} height={0.5} fill={TEXT} />,
        );
      }
    }
  }

  // Thick rule + footnote at the bottom — only if vertical space allows.
  if (y < height - 30 * layoutMul) {
    elements.push(
      <Rect key="r-thick-3" x={PAD} y={y} width={CONTENT_W} height={2 * layoutMul} fill={TEXT} />,
    );
    y += 5 * layoutMul;
    elements.push(
      <Text
        key="footnote"
        text="* The % Daily Value tells you how much a nutrient in a serving of food contributes to a daily diet."
        x={PAD}
        y={y}
        width={CONTENT_W}
        fontSize={NF_BASE.footnotePt * bodyMul}
        fontFamily={fontFamily}
        fill={TEXT}
      />,
    );
  }

  return (
    <>
      <Rect width={width} height={height} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {elements}
    </>
  );
}

type NodeProps = {
  obj: CanvasObj;
  selected: boolean;
  /** When false, click/tap don't fire onSelect — drawing tools and
   *  tap-to-place tools need the existing objects to stay inert so
   *  the new placement isn't overridden by the underlying object's
   *  synthetic Konva click. */
  selectable: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onTransformEnd: (x: number, y: number, w: number, h: number) => void;
  onDblClick: (e: KonvaEventObject<MouseEvent>) => void;
};

function ObjNode({
  obj,
  selected,
  selectable,
  onSelect,
  onDragEnd,
  onTransformEnd,
  onDblClick,
}: NodeProps) {
  const locked = obj.locked === true;
  // Locked objects (the dieline template rect) are inert: not
  // draggable, not selectable, not transformable, and don't
  // intercept pointer events so users can draw shapes over them.
  const sharedProps = {
    id: obj.id,
    x: obj.x,
    y: obj.y,
    opacity: obj.opacity,
    draggable: !locked && selectable,
    listening: !locked,
    ...(locked
      ? {}
      : {
          ...(selectable ? { onClick: onSelect, onTap: onSelect } : {}),
          onDblClick,
          onDragEnd: (e: KonvaEventObject<DragEvent>) => onDragEnd(e.target.x(), e.target.y()),
          onTransformEnd: (e: KonvaEventObject<Event>) => {
            const node = e.target;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            onTransformEnd(
              node.x(),
              node.y(),
              Math.max(4, node.width() * scaleX),
              Math.max(4, node.height() * scaleY),
            );
          },
        }),
  };

  if (obj.type === "rect") {
    return (
      <Rect
        {...sharedProps}
        width={obj.width}
        height={obj.height}
        fill={obj.fill}
        stroke={selected ? BRAND : obj.stroke}
        strokeWidth={selected ? Math.max(obj.strokeWidth, 1) : obj.strokeWidth}
      />
    );
  }

  if (obj.type === "ellipse") {
    return (
      <Ellipse
        {...sharedProps}
        radiusX={obj.width / 2}
        radiusY={obj.height / 2}
        offsetX={-obj.width / 2}
        offsetY={-obj.height / 2}
        fill={obj.fill}
        stroke={selected ? BRAND : obj.stroke}
        strokeWidth={selected ? Math.max(obj.strokeWidth, 1) : obj.strokeWidth}
      />
    );
  }

  if (obj.type === "text") {
    return (
      <Text
        {...sharedProps}
        text={obj.text ?? "Text"}
        fontSize={obj.fontSize ?? 16}
        fill={obj.fill}
        width={obj.width}
      />
    );
  }

  if (obj.type === "image" && obj.imageEl) {
    return (
      <KonvaImage
        {...sharedProps}
        image={obj.imageEl}
        width={obj.width}
        height={obj.height}
        stroke={selected ? BRAND : obj.stroke}
        strokeWidth={selected ? 1 : obj.strokeWidth}
      />
    );
  }

  if (obj.type === "path" && obj.pathData) {
    // Konva.Path renders the SVG `d` string directly. Used by S2 for
    // imported CF2/DDES/ARD dieline paths (cut/crease/perf/bleed lines
    // emitted by `dielineToPage`); the locked flag keeps users from
    // dragging the structural reference geometry.
    //
    // Stroke is NOT overridden when selected — dieline paths encode
    // cut/crease/perf/bleed semantics via stroke color (per
    // DIELINE_PATH_STROKES); masking that with BRAND on selection
    // would hide the structural information. In practice the locked
    // flag means these can't be selected anyway, but keep the
    // semantic stroke in case a future feature unlocks them.
    return (
      <Path
        {...sharedProps}
        data={obj.pathData}
        stroke={obj.stroke}
        strokeWidth={obj.strokeWidth}
        fill={obj.fill === "transparent" ? "" : obj.fill}
      />
    );
  }

  if (obj.type === "nutrition" && obj.nutritionFacts) {
    return (
      <Group {...sharedProps}>
        <NutritionFactsVisual
          facts={obj.nutritionFacts}
          style={obj.nutritionStyle ?? DEFAULT_NUTRITION_STYLE}
          width={obj.width}
          height={obj.height}
          fill={obj.fill}
          stroke={selected ? BRAND : obj.stroke}
          strokeWidth={selected ? Math.max(obj.strokeWidth, 1) : obj.strokeWidth}
        />
      </Group>
    );
  }

  if (obj.type === "braille" && obj.brailleSpec) {
    // Each cell is 6 dots in a 2-col × 3-row grid. Marburg Medium
    // geometry: dot diameter 1.4 mm, dot spacing 2.5 mm,
    // intercolumn 2.5 mm, intercell 6.0 mm. Convert mm → pt at
    // 72/25.4 and position relative to the group origin.
    const PT_PER_MM = 72 / 25.4;
    const result = composeBraille(obj.brailleSpec);
    const dotR = (MARBURG_MEDIUM.dotBaseDiameterMm * PT_PER_MM) / 2;
    const colSpacing = 2.5 * PT_PER_MM;
    const rowSpacing = 2.5 * PT_PER_MM;
    return (
      <Group {...sharedProps}>
        <Rect
          width={obj.width}
          height={obj.height}
          fill="transparent"
          stroke={selected ? BRAND : "transparent"}
          strokeWidth={selected ? 1 : 0}
        />
        {result.cells.flatMap((cell, ci) =>
          cell.dots
            .map((on, di) => {
              if (!on) return null;
              const col = di < 3 ? 0 : 1;
              const row = di % 3;
              const cx = cell.xMm * PT_PER_MM + col * colSpacing + dotR;
              const cy = cell.yMm * PT_PER_MM + row * rowSpacing + dotR;
              return (
                <Ellipse
                  key={`${ci}-${di}`}
                  x={cx}
                  y={cy}
                  radiusX={dotR}
                  radiusY={dotR}
                  fill={obj.fill || "#111"}
                  listening={false}
                />
              );
            })
            .filter(Boolean),
        )}
      </Group>
    );
  }

  return null;
}

// ── main component ─────────────────────────────────────────────────────────────

export function EditorCanvas({
  file,
  report,
  demo = false,
  initialObjects,
  initialPageSize,
  mode = "basic",
  onModeChange,
  config,
  bleedMm: bleedMmProp = DEFAULT_BLEED_MM,
  isMobile = false,
  menuOpen = false,
  onMenuOpenChange,
  onObjectsChange,
  onPageSizeChange,
  onBleedMmChange,
  initialSeparations,
  onSeparationsChange,
  prependDrawerSections = [],
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [pageSize, setPageSize] = useState(initialPageSize ?? { width: 595, height: 842 }); // A4 in pt
  const [zoom, setZoom] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [bleedMm, setBleedMm] = useState<number>(bleedMmProp);
  const [currentTemplate, setCurrentTemplate] = useState<DielineTemplate | null>(null);

  const [objects, setObjects] = useState<CanvasObj[]>(initialObjects ?? []);
  const [history, setHistory] = useState<CanvasObj[][]>([initialObjects ?? []]);
  const [historyIdx, setHistoryIdx] = useState(0);
  // AI4 spot registry — per-page; threaded into JobSubmitRequest's
  // separationsOverride at export time. Pure local state; parent
  // (EditorApp) round-trips via onSeparationsChange.
  const [separations, setSeparationsState] = useState<EditorSeparation[]>(initialSeparations ?? []);
  function updateSeparations(next: EditorSeparation[]) {
    setSeparationsState(next);
    onSeparationsChange?.(next);
  }

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  // After a tap-to-place tool fires, Konva still dispatches the
  // synthetic `click` event on whichever object was under the
  // pointer — that would overwrite the just-placed selection with
  // the underlying object. The placement handler sets this ref so
  // the next click is ignored; the click handler clears it.
  const placementGuard = useRef(false);
  const [drawing, setDrawing] = useState<Drawing | null>(null);

  const [fillColor, setFillColor] = useState(BRAND);
  const [strokeColor, setStrokeColor] = useState("transparent");
  const [strokeWidth, setStrokeWidth] = useState(1);
  const [opacity, setOpacity] = useState(1);

  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Pro mode state — dieline modal + per-ink visibility filter for separations.
  const [dielineOpen, setDielineOpen] = useState(false);

  // ── sync bleed from prop ────────────────────────────────────────────────────

  useEffect(() => {
    setBleedMm(bleedMmProp);
  }, [bleedMmProp]);

  // ── notify parent of document-state changes ─────────────────────────────────
  // Used by the multi-page wrapper in EditorApp to mirror the active page
  // back into its `pages` array; no-op when the host doesn't pass callbacks.

  useEffect(() => {
    onObjectsChange?.(objects);
    // biome-ignore lint/correctness/useExhaustiveDependencies: fire on objects only
  }, [objects]);

  useEffect(() => {
    onPageSizeChange?.(pageSize);
    // biome-ignore lint/correctness/useExhaustiveDependencies: fire on pageSize only
  }, [pageSize]);

  useEffect(() => {
    onBleedMmChange?.(bleedMm);
    // biome-ignore lint/correctness/useExhaustiveDependencies: fire on bleedMm only
  }, [bleedMm]);

  // ── recompute page + dieline when bleed changes ────────────────────────────

  useEffect(() => {
    if (!currentTemplate) return;
    const { objects: seeded, pageSize: newPageSize } = templateToInitialState(
      currentTemplate,
      bleedMm,
    );
    setPageSize(newPageSize);
    setObjects((prev) => {
      const dielineObj = seeded[0];
      if (!dielineObj) return prev;
      return [dielineObj, ...prev.filter((o) => !/dieline/i.test(o.id))];
    });
  }, [bleedMm, currentTemplate]);

  // ── container resize ────────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setContainerSize({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── parse page size from uploaded file ─────────────────────────────────────

  useEffect(() => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      file
        .arrayBuffer()
        .then((buf) => PDFDocument.load(buf, { ignoreEncryption: true }))
        .then((doc) => {
          const page = doc.getPages()[0];
          if (page) {
            const { width, height } = page.getSize();
            setPageSize({ width, height });
          }
        })
        .catch(() => undefined);
    } else if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const max = 600;
        const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        setPageSize({ width: img.naturalWidth * s, height: img.naturalHeight * s });
      };
      img.src = url;
    }
  }, [file]);

  // ── fit to page when container or page size changes ─────────────────────────

  const fitPage = useCallback((cw: number, ch: number, pw: number, ph: number) => {
    if (cw <= 0 || ch <= 0 || pw <= 0 || ph <= 0) return;
    const pad = 80;
    const s = Math.min((cw - pad * 2) / pw, (ch - pad * 2) / ph, 3);
    const newZoom = Math.max(s, 0.05);
    setZoom(newZoom);
    setStagePos({ x: (cw - pw * newZoom) / 2, y: (ch - ph * newZoom) / 2 });
  }, []);

  useEffect(() => {
    fitPage(containerSize.width, containerSize.height, pageSize.width, pageSize.height);
  }, [pageSize, containerSize, fitPage]);

  // ── transformer sync ────────────────────────────────────────────────────────

  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (selectedId) {
      const node = stage.findOne(`#${selectedId}`);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
      }
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId]);

  // ── history helpers ─────────────────────────────────────────────────────────

  // Maximum snapshots kept in the undo stack. Prevents unbounded
  // memory growth in long-running editor sessions; X2's HistoryPanel
  // (`packages/editor-app/src/components/HistoryPanel.tsx`) reads the
  // capped stack so the rendered row count stays bounded too.
  const HISTORY_MAX = 100;

  function commit(next: CanvasObj[]) {
    const truncated = history.slice(0, historyIdx + 1).concat([next]);
    // Drop oldest entries when over the cap. The cursor lands on the
    // last entry (newest) because we just committed it.
    const capped =
      truncated.length > HISTORY_MAX ? truncated.slice(truncated.length - HISTORY_MAX) : truncated;
    setHistory(capped);
    setHistoryIdx(capped.length - 1);
    setObjects(next);
  }

  function seekHistory(idx: number) {
    const clamped = Math.max(0, Math.min(history.length - 1, idx));
    const snapshot = history[clamped] ?? [];
    setHistoryIdx(clamped);
    setObjects(snapshot);
    // Preserve selection only if the selected object still exists in
    // the target snapshot — otherwise the selection points at a
    // deleted id (e.g. undoing an "add"). Single consistent rule for
    // all three history-navigation paths (seek / undo / redo).
    if (selectedId && !snapshot.some((o) => o.id === selectedId)) {
      setSelectedId(null);
    }
  }

  function undo() {
    seekHistory(historyIdx - 1);
  }

  function redo() {
    seekHistory(historyIdx + 1);
  }

  // ── keyboard shortcuts ──────────────────────────────────────────────────────

  // biome-ignore lint/correctness/useExhaustiveDependencies: commit/undo/redo capture history via closure
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          commit(objects.filter((o) => o.id !== selectedId));
          setSelectedId(null);
        }
        return;
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        setTool("select");
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (mod && e.key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (!mod) {
        if (e.key === "v") setTool("select");
        if (e.key === "r") setTool("rect");
        if (e.key === "e") setTool("ellipse");
        if (e.key === "t") setTool("text");
        if (e.key === "i") setTool("image");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [objects, selectedId]);

  // ── stage pointer events (mouse + touch) ───────────────────────────────────

  function onStagePointerDown(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    // Reset the placement guard on every new pointer-down: the guard
    // only ever exists to swallow the SINGLE synthetic click Konva
    // fires immediately after a placement pointer-up. If the user
    // hasn't generated that synthetic click (clicked elsewhere
    // first), the guard would otherwise leak and silently swallow
    // a future legitimate selection click.
    placementGuard.current = false;
    if (tool === "select") {
      if (e.target === stageRef.current) setSelectedId(null);
      return;
    }
    if (tool === "image") return;
    if (!stageRef.current) return;
    e.evt.preventDefault();
    // Clear any prior selection BEFORE drawing — otherwise the
    // Transformer handles for the previously-selected object stay
    // live and intercept clicks meant for the new placement.
    if (selectedId !== null) setSelectedId(null);
    const pos = stagePointer(stageRef.current);
    setDrawing({ x: pos.x, y: pos.y, w: 0, h: 0 });
  }

  function onStagePointerMove(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!drawing) return;
    e.evt.preventDefault();
    if (!stageRef.current) return;
    const pos = stagePointer(stageRef.current);
    setDrawing((d) => (d ? { ...d, w: pos.x - d.x, h: pos.y - d.y } : null));
  }

  async function onStagePointerUp() {
    if (!drawing) return;
    const { x, y, w, h } = drawing;
    setDrawing(null);

    // For drag-to-place tools (rect/ellipse/text) tiny drags are
    // treated as a misclick and ignored. For tap-to-place tools
    // (nutrition/braille) a small drag is the *expected* path — they
    // place at default size at the pointer.
    const tapToPlace = tool === "nutrition" || tool === "braille";
    if (!tapToPlace && (Math.abs(w) < 4 || Math.abs(h) < 4)) return;

    const nx = w < 0 ? x + w : x;
    const ny = h < 0 ? y + h : y;
    const nw = Math.abs(w);
    const nh = Math.abs(h);

    const base = {
      id: crypto.randomUUID(),
      x: tapToPlace ? x : nx,
      y: tapToPlace ? y : ny,
      width: tapToPlace ? defaultPlacementSize(tool).width : nw,
      height: tapToPlace ? defaultPlacementSize(tool).height : nh,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth,
      opacity,
    };

    let obj: CanvasObj;
    if (tool === "text") {
      obj = { ...base, type: "text", text: "Text", fontSize: 16, fill: fillColor };
    } else if (tool === "nutrition") {
      obj = {
        ...base,
        type: "nutrition",
        fill: "#ffffff",
        stroke: "#111111",
        strokeWidth: 1,
        nutritionFacts: DEFAULT_NUTRITION_FACTS,
        nutritionStyle: DEFAULT_NUTRITION_STYLE,
      };
    } else if (tool === "braille") {
      obj = {
        ...base,
        type: "braille",
        fill: "#111111",
        stroke: "transparent",
        strokeWidth: 0,
        brailleSpec: { text: "HELLO", charSpacingMm: MARBURG_MEDIUM.charSpacingMm },
      };
    } else {
      obj = { ...base, type: tool as "rect" | "ellipse" };
    }

    commit([...objects, obj]);
    setSelectedId(obj.id);
    setTool("select");
    if (tapToPlace) placementGuard.current = true;
  }

  function onWheel(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const factor = e.evt.deltaY < 0 ? 1.08 : 1 / 1.08;
    const pointer = stage.getPointerPosition() ?? { x: 0, y: 0 };
    const newZoom = Math.min(Math.max(zoom * factor, 0.05), 8);
    const mx = (pointer.x - stagePos.x) / zoom;
    const my = (pointer.y - stagePos.y) / zoom;
    setZoom(newZoom);
    setStagePos({ x: pointer.x - mx * newZoom, y: pointer.y - my * newZoom });
  }

  // ── text double-click inline editing ───────────────────────────────────────

  function onTextDblClick(id: string, e: KonvaEventObject<MouseEvent>) {
    const textNode = e.target as Konva.Text;
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container();
    const cr = container.getBoundingClientRect();
    const absPos = textNode.getAbsolutePosition();

    const ta = document.createElement("textarea");
    ta.value = textNode.text();
    ta.style.cssText = [
      "position:fixed",
      `top:${cr.top + absPos.y}px`,
      `left:${cr.left + absPos.x}px`,
      `width:${Math.max(textNode.width() * zoom, 120)}px`,
      `min-height:${(textNode.fontSize() ?? 16) * zoom * 1.4}px`,
      `font-size:${(textNode.fontSize() ?? 16) * zoom}px`,
      "font-family:sans-serif",
      "background:#1a0f08",
      "color:#fff",
      "border:1px solid #fc5102",
      "border-radius:2px",
      "padding:2px 4px",
      "resize:none",
      "outline:none",
      "z-index:9999",
      "line-height:1.4",
    ].join(";");

    document.body.appendChild(ta);
    ta.focus();
    ta.select();

    const finish = () => {
      const val = ta.value;
      document.body.removeChild(ta);
      commit(objects.map((o) => (o.id === id ? { ...o, text: val } : o)));
    };

    ta.addEventListener("blur", finish, { once: true });
    ta.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" || (ev.key === "Enter" && !ev.shiftKey)) {
        ev.preventDefault();
        ta.blur();
      }
    });
  }

  // ── image import ────────────────────────────────────────────────────────────

  async function handleImageFile(f: File) {
    // Try uploading to the service so the asset has a persistent URL.
    // Falls back to a local data URL when the service is unavailable or in demo mode.
    let src: string;
    if (!demo) {
      try {
        const form = new FormData();
        form.append("file", f);
        const res = await fetch(`${SERVICE_URL}/assets`, { method: "POST", body: form });
        if (res.ok) {
          const json = (await res.json()) as { id: string; url: string };
          src = `${SERVICE_URL}${json.url}`;
        } else {
          throw new Error("upload failed");
        }
      } catch {
        src = await new Promise<string>((res) => {
          const reader = new FileReader();
          reader.onload = (ev) => res(ev.target?.result as string);
          reader.readAsDataURL(f);
        });
      }
    } else {
      src = await new Promise<string>((res) => {
        const reader = new FileReader();
        reader.onload = (ev) => res(ev.target?.result as string);
        reader.readAsDataURL(f);
      });
    }
    const imgEl = await loadImage(src);
    const max = Math.min(pageSize.width, pageSize.height) * 0.5;
    const s = Math.min(1, max / Math.max(imgEl.naturalWidth, imgEl.naturalHeight));
    const w = imgEl.naturalWidth * s;
    const h = imgEl.naturalHeight * s;
    const obj: CanvasObj = {
      id: crypto.randomUUID(),
      type: "image",
      x: (pageSize.width - w) / 2,
      y: (pageSize.height - h) / 2,
      width: w,
      height: h,
      fill: "transparent",
      stroke: "transparent",
      strokeWidth: 0,
      opacity: 1,
      src,
      imageEl: imgEl,
    };
    commit([...objects, obj]);
    setSelectedId(obj.id);
    setTool("select");
  }

  // ── update selected object properties ──────────────────────────────────────

  const selected = objects.find((o) => o.id === selectedId) ?? null;

  function updateSelected(patch: Partial<CanvasObj>) {
    if (!selectedId) return;
    commit(objects.map((o) => (o.id === selectedId ? { ...o, ...patch } : o)));
  }

  // ── PDF export ──────────────────────────────────────────────────────────────

  async function handleClientExport() {
    const stage = stageRef.current;
    if (!stage) return;
    setExportStatus("sending");
    try {
      // Rasterize just the page area at 2x for a crisp embed.
      const png = stage.toDataURL({
        x: stagePos.x,
        y: stagePos.y,
        width: pageSize.width * zoom,
        height: pageSize.height * zoom,
        pixelRatio: 2,
        mimeType: "image/png",
      });
      setSelectedId(null);

      const pdf = await PDFDocument.create();
      const page = pdf.addPage([pageSize.width, pageSize.height]);
      const img = await pdf.embedPng(png);
      page.drawImage(img, {
        x: 0,
        y: 0,
        width: pageSize.width,
        height: pageSize.height,
      });
      const bytes = await pdf.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "artwork-demo.pdf";
      link.click();
      URL.revokeObjectURL(url);
      setExportStatus("done");
      setTimeout(() => setExportStatus("idle"), 3000);
    } catch {
      setExportStatus("error");
    }
  }

  async function handleExport() {
    if (demo) {
      await handleClientExport();
      return;
    }
    setExportStatus("sending");

    const doc: ProductionExportRequest["document"] = {
      version: "2",
      width: pageSize.width,
      height: pageSize.height,
      unit: "pt",
      separations: [],
      layers: [
        {
          id: "layer-1",
          type: "artwork",
          name: "Artwork",
          visible: true,
          objects: objects.map((o) => ({
            id: o.id,
            type: o.type,
            x: o.x,
            y: o.y,
            width: o.width,
            height: o.height,
            fill: o.fill,
            stroke: o.stroke,
            ...(o.strokeWidth !== undefined ? { strokeWidth: o.strokeWidth } : {}),
            ...(o.opacity !== undefined ? { opacity: o.opacity } : {}),
            ...(o.text !== undefined ? { text: o.text } : {}),
            ...(o.fontSize !== undefined ? { fontSize: o.fontSize } : {}),
            ...(o.fontFamily !== undefined ? { fontFamily: o.fontFamily } : {}),
            ...(o.src !== undefined ? { src: o.src } : {}),
            ...(o.pathData !== undefined ? { pathData: o.pathData } : {}),
          })),
        },
      ],
    };

    const req: ProductionExportRequest = {
      document: doc,
      output: { format: "pdf-x4" },
      ...(report ? { preflightReport: report } : {}),
      // AI4: thread the page's registered spots through as
      // separationsOverride. Strip the editor-only `hex` field on
      // the wire — compile-pdf's Separation shape doesn't carry it
      // (the hex is the editor's lookup key, not a wire field). The
      // remaining fields (name/colorSpace/pantone/lab/type) match
      // document-model's Separation structurally.
      ...(separations.length > 0
        ? {
            separationsOverride: separations.map((s) => {
              const { hex: _hex, ...wire } = s;
              return wire;
            }),
          }
        : {}),
    };

    try {
      const res = await fetch(`${SERVICE_URL}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const { id } = (await res.json()) as { id: string };
      setExportJobId(id);
      setExportStatus("polling");
      pollJob(id);
    } catch {
      setExportStatus("error");
    }
  }

  function pollJob(id: string) {
    let attempts = 0;
    const tick = async () => {
      attempts++;
      if (attempts > 60) {
        setExportStatus("error");
        return;
      }
      try {
        const r = await fetch(`${SERVICE_URL}/jobs/${id}`);
        const { status } = (await r.json()) as { status: string };
        if (status === "done") {
          const rr = await fetch(`${SERVICE_URL}/jobs/${id}/result`);
          const result = (await rr.json()) as { pdfBase64: string; filename: string };
          const link = document.createElement("a");
          link.href = `data:application/pdf;base64,${result.pdfBase64}`;
          link.download = result.filename ?? "artwork.pdf";
          link.click();
          setExportStatus("done");
          setTimeout(() => setExportStatus("idle"), 3000);
        } else if (status === "failed") {
          setExportStatus("error");
        } else {
          setTimeout(tick, 2000);
        }
      } catch {
        setExportStatus("error");
      }
    };
    setTimeout(tick, 1000);
  }

  // ── pro mode helpers ───────────────────────────────────────────────────────

  function reorderObject(id: string, direction: "up" | "down") {
    const idx = objects.findIndex((o) => o.id === id);
    if (idx === -1) return;
    const swapWith = direction === "up" ? idx + 1 : idx - 1;
    if (swapWith < 0 || swapWith >= objects.length) return;
    const next = objects.slice();
    const a = next[idx];
    const b = next[swapWith];
    if (!a || !b) return;
    next[idx] = b;
    next[swapWith] = a;
    commit(next);
  }

  function toggleVisible(id: string) {
    commit(objects.map((o) => (o.id === id ? { ...o, opacity: o.opacity === 0 ? 1 : 0 } : o)));
  }

  function applyDieline(template: DielineTemplate) {
    setCurrentTemplate(template);
    const { objects: seeded, pageSize: newPageSize } = templateToInitialState(template, bleedMm);
    setPageSize(newPageSize);
    // Replace any existing dieline rect so swapping templates is one click.
    const next = [...seeded, ...objects.filter((o) => !/dieline/i.test(o.id))];
    commit(next);
    setSelectedId(null);
  }

  // Real post-render separations live in the lens-pdf viewer
  // (`SeparationCanvas`, codex-backed). The pre-render RGB approximation
  // we used to do here was misleading and is no longer rendered.
  const visibleObjects = objects;

  // ── render ──────────────────────────────────────────────────────────────────

  const cursor = tool === "select" ? "default" : tool === "image" ? "cell" : "crosshair";

  const exportLabel =
    exportStatus === "sending"
      ? "Sending…"
      : exportStatus === "polling"
        ? "Rendering…"
        : exportStatus === "done"
          ? "Downloaded ✓"
          : exportStatus === "error"
            ? "Error — retry"
            : demo
              ? "Download PDF"
              : "Export PDF/X-4";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#ffffff",
      }}
    >
      {/* ── desktop toolbar (hidden on mobile; replaced by drawer + slim export strip) ── */}
      {!isMobile && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.375rem 0.75rem",
            background: PANEL_BG,
            borderBottom: `1px solid ${BORDER}`,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          {(
            [
              { id: "select", label: "↖ Select", flag: "enable_tool_select" },
              { id: "rect", label: "▭ Rect", flag: "enable_tool_rect" },
              { id: "ellipse", label: "◯ Ellipse", flag: "enable_tool_ellipse" },
              { id: "text", label: "T Text", flag: "enable_tool_text" },
              { id: "image", label: "⬚ Image", flag: "enable_tool_image" },
              { id: "nutrition", label: "NF Nutrition", flag: "enable_tool_nutrition" },
              { id: "braille", label: "⠿ Braille", flag: "enable_tool_braille" },
            ] as { id: Tool; label: string; flag: keyof EditorConfig }[]
          )
            .filter((t) => config[t.flag] !== false)
            .map((t) => (
              <ToolBtn
                key={t.id}
                active={tool === t.id}
                onClick={() => {
                  setTool(t.id);
                  if (t.id === "image") imageInputRef.current?.click();
                }}
              >
                {t.label}
              </ToolBtn>
            ))}

          <div style={{ width: 1, height: 20, background: BORDER, margin: "0 0.25rem" }} />

          <button
            type="button"
            onClick={undo}
            disabled={historyIdx === 0}
            style={iconBtnStyle(historyIdx === 0)}
          >
            ↩ Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={historyIdx >= history.length - 1}
            style={iconBtnStyle(historyIdx >= history.length - 1)}
          >
            ↪ Redo
          </button>

          <div style={{ width: 1, height: 20, background: BORDER, margin: "0 0.25rem" }} />

          <button
            type="button"
            onClick={() =>
              fitPage(containerSize.width, containerSize.height, pageSize.width, pageSize.height)
            }
            style={iconBtnStyle(false)}
          >
            ⊡ Fit
          </button>
          <span style={{ fontSize: "0.75rem", color: MUTED }}>{Math.round(zoom * 100)}%</span>

          {config.enable_dieline_chooser && (
            <>
              <div style={{ width: 1, height: 20, background: BORDER, margin: "0 0.25rem" }} />
              <button
                type="button"
                onClick={() => setDielineOpen(true)}
                style={iconBtnStyle(false)}
              >
                ▦ Dielines
              </button>
            </>
          )}

          <div style={{ flex: 1 }} />

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.75rem",
              color: "#999",
            }}
          >
            Fill
            <input
              type="color"
              value={fillColor}
              onChange={(e) => {
                setFillColor(e.target.value);
                if (selected) updateSelected({ fill: e.target.value });
              }}
              style={{
                width: 24,
                height: 20,
                border: "none",
                padding: 0,
                background: "none",
                cursor: "pointer",
              }}
            />
          </label>
          {/* AI4: "register as spot" affordance. When the current
              fill color isn't yet a registered spot, prompt for a
              name and add it; when it already is, show a small badge
              indicating the existing registration. The full
              SwatchesPicker (Wave 1 PR-7) replaces the prompt with a
              library browser; for now this is the manual path. */}
          {(() => {
            const existing = findSpotByColor(separations, fillColor);
            if (existing) {
              return (
                <span
                  title={`Registered as ${existing.name}`}
                  style={{
                    fontSize: "0.72rem",
                    color: BRAND,
                    padding: "0 0.35rem",
                  }}
                >
                  ✓ {existing.name}
                </span>
              );
            }
            return (
              <button
                type="button"
                onClick={() => {
                  const name = window.prompt(`Register ${fillColor} as a spot ink. Name:`);
                  if (name?.trim()) {
                    updateSeparations(registerSpot(separations, fillColor, name.trim()));
                  }
                }}
                title="Register this color as a spot ink"
                style={{
                  fontSize: "0.7rem",
                  color: MUTED,
                  background: "transparent",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 3,
                  padding: "0.15rem 0.35rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                + spot
              </button>
            );
          })()}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.75rem",
              color: "#999",
            }}
          >
            Stroke
            <input
              type="color"
              value={strokeColor === "transparent" ? "#000000" : strokeColor}
              onChange={(e) => {
                setStrokeColor(e.target.value);
                if (selected) updateSelected({ stroke: e.target.value });
              }}
              style={{
                width: 24,
                height: 20,
                border: "none",
                padding: 0,
                background: "none",
                cursor: "pointer",
              }}
            />
          </label>

          <div style={{ width: 1, height: 20, background: BORDER, margin: "0 0.25rem" }} />

          {config.enable_export_button && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exportStatus === "sending" || exportStatus === "polling"}
              style={{
                background:
                  exportStatus === "done"
                    ? "#2e7d32"
                    : exportStatus === "error"
                      ? "#b71c1c"
                      : BRAND,
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "0.3rem 0.85rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor:
                  exportStatus === "sending" || exportStatus === "polling" ? "wait" : "pointer",
                opacity: exportStatus === "sending" || exportStatus === "polling" ? 0.7 : 1,
              }}
            >
              {exportLabel}
            </button>
          )}
        </div>
      )}

      {/* On mobile the export action lives in the drawer's footer, not
          a top strip — keeps the chrome above the canvas minimal. */}

      {/* ── workspace row (canvas + pro panels) ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {config.enable_layers_panel && !isMobile && (
          <LayersPanel
            objects={objects}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            onReorder={reorderObject}
            onDelete={(id) => {
              commit(objects.filter((o) => o.id !== id));
              if (id === selectedId) setSelectedId(null);
            }}
            onToggleVisible={toggleVisible}
          />
        )}

        {/* ── canvas area ── */}
        <div ref={containerRef} style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <Stage
            ref={stageRef}
            width={containerSize.width}
            height={containerSize.height}
            scaleX={zoom}
            scaleY={zoom}
            x={stagePos.x}
            y={stagePos.y}
            onMouseDown={onStagePointerDown}
            onMouseMove={onStagePointerMove}
            onMouseUp={onStagePointerUp}
            onTouchStart={onStagePointerDown}
            onTouchMove={onStagePointerMove}
            onTouchEnd={onStagePointerUp}
            onWheel={onWheel}
            style={{ cursor }}
          >
            <Layer>
              {/* page shadow (subtle, on white) */}
              <Rect
                x={3}
                y={3}
                width={pageSize.width}
                height={pageSize.height}
                fill="rgba(0,0,0,0.08)"
              />
              {/* page white background */}
              <Rect
                x={0}
                y={0}
                width={pageSize.width}
                height={pageSize.height}
                fill="#ffffff"
                stroke="#d4d4d8"
                strokeWidth={0.5 / zoom}
                onClick={() => {
                  if (tool === "select") setSelectedId(null);
                }}
              />

              {/* light grid overlay — 10 mm / 50 mm bands */}
              {config.enable_canvas_grid && <GridLines pageSize={pageSize} zoom={zoom} />}

              {/* bleed visualization: dashed cyan rect at page edge + label */}
              {config.enable_bleed_visualization && (
                <>
                  <Rect
                    x={0}
                    y={0}
                    width={pageSize.width}
                    height={pageSize.height}
                    stroke="#0ea5e9"
                    strokeWidth={1 / zoom}
                    dash={[6 / zoom, 4 / zoom]}
                    listening={false}
                  />
                  <Text
                    text={`BLEED ${formatBleed(bleedMm, "in")}`}
                    x={6}
                    y={-14 / zoom}
                    fontSize={10 / zoom}
                    fill="#0ea5e9"
                    listening={false}
                  />
                </>
              )}

              {/* objects */}
              {visibleObjects.map((obj) => (
                <ObjNode
                  key={obj.id}
                  obj={obj}
                  selected={obj.id === selectedId}
                  selectable={tool === "select"}
                  onSelect={() => {
                    if (placementGuard.current) {
                      placementGuard.current = false;
                      return;
                    }
                    setSelectedId(obj.id);
                  }}
                  onDragEnd={(x, y) =>
                    commit(objects.map((o) => (o.id === obj.id ? { ...o, x, y } : o)))
                  }
                  onTransformEnd={(x, y, w, h) =>
                    commit(
                      objects.map((o) =>
                        o.id === obj.id ? { ...o, x, y, width: w, height: h } : o,
                      ),
                    )
                  }
                  onDblClick={(e) => obj.type === "text" && onTextDblClick(obj.id, e)}
                />
              ))}

              {/* transformer */}
              <Transformer
                ref={trRef}
                borderStroke={BRAND}
                borderStrokeWidth={1}
                anchorStroke={BRAND}
                anchorFill="#fff"
                anchorSize={8}
                rotateEnabled={false}
                keepRatio={false}
              />

              {/* drawing preview */}
              {drawing && tool !== "select" && (
                <Rect
                  x={drawing.w < 0 ? drawing.x + drawing.w : drawing.x}
                  y={drawing.h < 0 ? drawing.y + drawing.h : drawing.y}
                  width={Math.abs(drawing.w)}
                  height={Math.abs(drawing.h)}
                  fill={tool === "text" ? "rgba(252,81,2,0.08)" : `${fillColor}80`}
                  stroke={BRAND}
                  strokeWidth={1 / zoom}
                  dash={[4 / zoom, 4 / zoom]}
                />
              )}
            </Layer>
          </Stage>

          {/* C4 live total-area-coverage heatmap + readout */}
          {showFeature(config, "total_ink_coverage_live") && (
            <TacOverlay
              stage={stageRef.current}
              width={containerSize.width}
              height={containerSize.height}
              trigger={objects}
            />
          )}

          {/* empty state hint */}
          {objects.length === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Use the toolbar to draw shapes, add text, or import an image
              </span>
            </div>
          )}
        </div>

        {/* ── right rail: history scrubber (X2) ── */}
        {!isMobile && isPanelVisible(config, "history") && (
          <HistoryPanel
            cursor={historyIdx}
            objectCounts={history.map((snap) => snap.length)}
            onSelect={seekHistory}
          />
        )}

        {/* ── right rail: accordion of in-browser-only Wave 1–4 panels ──
            Each section is gated by its own `enable_<feature>` flag so
            hosts using `NO_BACKEND_DEFAULTS` see only the panels that
            work without a host-supplied adapter. */}
        {!isMobile && (
          <RightRailAccordion
            config={config}
            selectedObj={selected}
            onUpdateSelected={updateSelected}
          />
        )}
      </div>

      {/* ── selected properties footer ── */}
      {selected && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "0.375rem 0.75rem",
            background: PANEL_BG,
            borderTop: `1px solid ${BORDER}`,
            flexShrink: 0,
            fontSize: "0.75rem",
            color: "#999",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: BRAND, fontWeight: 600 }}>{selected.type}</span>

          <PropNum
            label="X"
            value={Math.round(selected.x)}
            onChange={(v) => updateSelected({ x: v })}
          />
          <PropNum
            label="Y"
            value={Math.round(selected.y)}
            onChange={(v) => updateSelected({ y: v })}
          />
          <PropNum
            label="W"
            value={Math.round(selected.width)}
            onChange={(v) => updateSelected({ width: Math.max(1, v) })}
          />
          <PropNum
            label="H"
            value={Math.round(selected.height)}
            onChange={(v) => updateSelected({ height: Math.max(1, v) })}
          />

          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            Fill
            <input
              type="color"
              value={selected.fill === "transparent" ? "#ffffff" : selected.fill}
              onChange={(e) => updateSelected({ fill: e.target.value })}
              style={{
                width: 22,
                height: 18,
                border: "none",
                padding: 0,
                background: "none",
                cursor: "pointer",
              }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            Stroke
            <input
              type="color"
              value={selected.stroke === "transparent" ? "#000000" : selected.stroke}
              onChange={(e) => updateSelected({ stroke: e.target.value })}
              style={{
                width: 22,
                height: 18,
                border: "none",
                padding: 0,
                background: "none",
                cursor: "pointer",
              }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            Opacity
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={selected.opacity}
              onChange={(e) => updateSelected({ opacity: Number(e.target.value) })}
              style={{ width: 60 }}
            />
            <span>{Math.round(selected.opacity * 100)}%</span>
          </label>

          {selected.type === "text" && (
            <>
              <PropNum
                label="Size"
                value={selected.fontSize ?? 16}
                onChange={(v) => updateSelected({ fontSize: Math.max(4, v) })}
              />
              <button
                type="button"
                onClick={() => {
                  // Spawn inline text edit by focusing textarea overlay
                  const stage = stageRef.current;
                  if (!stage) return;
                  const node = stage.findOne(`#${selected.id}`) as Konva.Text | undefined;
                  if (!node) return;
                  onTextDblClick(selected.id, {
                    target: node,
                  } as unknown as KonvaEventObject<MouseEvent>);
                }}
                style={{ ...iconBtnStyle(false), fontSize: "0.72rem" }}
              >
                Edit text
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              commit(objects.filter((o) => o.id !== selectedId));
              setSelectedId(null);
            }}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "1px solid #5a1a1a",
              color: "#e57373",
              borderRadius: 3,
              padding: "0.2rem 0.5rem",
              cursor: "pointer",
              fontSize: "0.72rem",
            }}
          >
            Delete
          </button>
        </div>
      )}

      {/* hidden image file input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImageFile(f);
          e.target.value = "";
        }}
      />

      {config.enable_dieline_chooser && (
        <DielineLibraryModal
          open={dielineOpen}
          onClose={() => setDielineOpen(false)}
          onSelect={applyDieline}
        />
      )}

      {isMobile && (
        <MobileToolDrawer
          isOpen={menuOpen}
          onClose={() => onMenuOpenChange?.(false)}
          config={config}
          activeTool={tool}
          onSelectTool={(t) => {
            setTool(t);
            if (t === "image") imageInputRef.current?.click();
          }}
          canUndo={historyIdx > 0}
          canRedo={historyIdx < history.length - 1}
          onUndo={undo}
          onRedo={redo}
          zoomPct={Math.round(zoom * 100)}
          onFit={() =>
            fitPage(containerSize.width, containerSize.height, pageSize.width, pageSize.height)
          }
          onOpenDielineChooser={() => setDielineOpen(true)}
          fillColor={fillColor}
          strokeColor={strokeColor === "transparent" ? "#000000" : strokeColor}
          onFillChange={(hex) => {
            setFillColor(hex);
            if (selected) updateSelected({ fill: hex });
          }}
          onStrokeChange={(hex) => {
            setStrokeColor(hex);
            if (selected) updateSelected({ stroke: hex });
          }}
          bleedMm={bleedMm}
          onBleedMmChange={setBleedMm}
          mode={mode}
          onModeChange={(m) => onModeChange?.(m)}
          onExport={handleExport}
          exportLabel={exportLabel}
          exportBusy={exportStatus === "sending" || exportStatus === "polling"}
          extraSections={[
            ...prependDrawerSections,
            ...(config.enable_layers_panel
              ? [
                  {
                    title: "Layers",
                    content: (
                      <LayersPanel
                        objects={objects}
                        selectedId={selectedId}
                        onSelect={(id) => setSelectedId(id)}
                        onReorder={reorderObject}
                        onDelete={(id) => {
                          commit(objects.filter((o) => o.id !== id));
                          if (id === selectedId) setSelectedId(null);
                        }}
                        onToggleVisible={toggleVisible}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
}

// ── grid overlay ──────────────────────────────────────────────────────────────

const MM_TO_PT_GRID = 2.83465;

function GridLines({
  pageSize,
  zoom,
}: {
  pageSize: { width: number; height: number };
  zoom: number;
}) {
  const minor = 10 * MM_TO_PT_GRID; // 10 mm → pt
  const major = 50 * MM_TO_PT_GRID; // 50 mm → pt
  const lines: React.ReactNode[] = [];
  for (let x = 0; x <= pageSize.width; x += minor) {
    const isMajor = Math.abs(x % major) < 0.01 || Math.abs((x % major) - major) < 0.01;
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, pageSize.height]}
        stroke={isMajor ? "#cbd5e1" : "#e5e7eb"}
        strokeWidth={0.5 / zoom}
        listening={false}
      />,
    );
  }
  for (let y = 0; y <= pageSize.height; y += minor) {
    const isMajor = Math.abs(y % major) < 0.01 || Math.abs((y % major) - major) < 0.01;
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, pageSize.width, y]}
        stroke={isMajor ? "#cbd5e1" : "#e5e7eb"}
        strokeWidth={0.5 / zoom}
        listening={false}
      />,
    );
  }
  return <>{lines}</>;
}

// ── small helper components ───────────────────────────────────────────────────

function ToolBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? BRAND : "transparent",
        color: active ? "#fff" : "#aaa",
        border: `1px solid ${active ? BRAND : BORDER}`,
        borderRadius: 4,
        padding: "0.2rem 0.6rem",
        fontSize: "0.75rem",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background 0.1s, color 0.1s",
      }}
    >
      {children}
    </button>
  );
}

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: "transparent",
    color: disabled ? "#444" : "#aaa",
    border: `1px solid ${disabled ? "#2a1200" : BORDER}`,
    borderRadius: 4,
    padding: "0.2rem 0.55rem",
    fontSize: "0.75rem",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  };
}

function PropNum({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: 52,
          background: "#120a04",
          border: `1px solid ${BORDER}`,
          color: "#ccc",
          borderRadius: 3,
          padding: "0.1rem 0.3rem",
          fontSize: "0.72rem",
        }}
      />
    </label>
  );
}
