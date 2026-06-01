// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { PDFDocument } from "pdf-lib";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Ellipse,
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
import type { PreflightReport } from "../lib/preflight/types";
import { DielineLibraryModal } from "./DielineLibraryModal";
import { HistoryPanel } from "./HistoryPanel";
import { LayersPanel } from "./LayersPanel";
import { isPanelVisible } from "../lib/editor-config";
import { MobileToolDrawer } from "./MobileToolDrawer";

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
};

type Tool = "select" | "rect" | "ellipse" | "text" | "image";

type ObjType = "rect" | "ellipse" | "text" | "image" | "path";

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

// ── helper: get pointer relative to stage content (ignoring stage transform) ──

function stagePointer(stage: Konva.Stage): { x: number; y: number } {
  const pos = stage.getPointerPosition() ?? { x: 0, y: 0 };
  return {
    x: (pos.x - stage.x()) / stage.scaleX(),
    y: (pos.y - stage.y()) / stage.scaleY(),
  };
}

// ── sub-component: single object node ────────────────────────────────────────

type NodeProps = {
  obj: CanvasObj;
  selected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onTransformEnd: (x: number, y: number, w: number, h: number) => void;
  onDblClick: (e: KonvaEventObject<MouseEvent>) => void;
};

function ObjNode({ obj, selected, onSelect, onDragEnd, onTransformEnd, onDblClick }: NodeProps) {
  const locked = obj.locked === true;
  // Locked objects (the dieline template rect) are inert: not
  // draggable, not selectable, not transformable, and don't
  // intercept pointer events so users can draw shapes over them.
  const sharedProps = {
    id: obj.id,
    x: obj.x,
    y: obj.y,
    opacity: obj.opacity,
    draggable: !locked,
    listening: !locked,
    ...(locked
      ? {}
      : {
          onClick: onSelect,
          onTap: onSelect,
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
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
      truncated.length > HISTORY_MAX
        ? truncated.slice(truncated.length - HISTORY_MAX)
        : truncated;
    setHistory(capped);
    setHistoryIdx(capped.length - 1);
    setObjects(next);
  }

  function seekHistory(idx: number) {
    const clamped = Math.max(0, Math.min(history.length - 1, idx));
    setHistoryIdx(clamped);
    setObjects(history[clamped] ?? []);
    setSelectedId(null);
  }

  function undo() {
    const idx = Math.max(0, historyIdx - 1);
    setHistoryIdx(idx);
    setObjects(history[idx] ?? []);
    setSelectedId(null);
  }

  function redo() {
    const idx = Math.min(history.length - 1, historyIdx + 1);
    setHistoryIdx(idx);
    setObjects(history[idx] ?? []);
    setSelectedId(null);
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
    if (tool === "select") {
      if (e.target === stageRef.current) setSelectedId(null);
      return;
    }
    if (!stageRef.current) return;
    e.evt.preventDefault();
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
    if (Math.abs(w) < 4 || Math.abs(h) < 4) return;

    const nx = w < 0 ? x + w : x;
    const ny = h < 0 ? y + h : y;
    const nw = Math.abs(w);
    const nh = Math.abs(h);

    const base = {
      id: crypto.randomUUID(),
      x: nx,
      y: ny,
      width: nw,
      height: nh,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth,
      opacity,
    };

    let obj: CanvasObj;
    if (tool === "text") {
      obj = { ...base, type: "text", text: "Text", fontSize: 16, fill: fillColor };
    } else {
      obj = { ...base, type: tool as "rect" | "ellipse" };
    }

    commit([...objects, obj]);
    setSelectedId(obj.id);
    setTool("select");
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
          {(["select", "rect", "ellipse", "text", "image"] as Tool[]).map((t) => (
            <ToolBtn
              key={t}
              active={tool === t}
              onClick={() => {
                setTool(t);
                if (t === "image") imageInputRef.current?.click();
              }}
            >
              {t === "select"
                ? "↖ Select"
                : t === "rect"
                  ? "▭ Rect"
                  : t === "ellipse"
                    ? "◯ Ellipse"
                    : t === "text"
                      ? "T Text"
                      : "⬚ Image"}
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
                  onSelect={() => setSelectedId(obj.id)}
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
            entries={history.length}
            cursor={historyIdx}
            objectCounts={history.map((snap) => snap.length)}
            onSelect={seekHistory}
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
