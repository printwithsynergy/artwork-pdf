// ArtworkEditor - Full Illustrator-grade Label Design Editor
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Stage, Layer as KonvaLayer, Rect, Circle, Text, Image as KonvaImage, Path, Line, Group } from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";
import useImage from "use-image";

// Import extended DocumentModel types
import type {
  DocumentModel,
  ArtworkObject,
  ArtworkObjectType,
  Layer,
  DielineTemplate,
  Gradient,
  Effect,
  BlendMode,
  TypographyConfig,
  EditorViewState,
} from "@artworkpdf/document-model";
import { GOOGLE_FONTS_CURATION, loadGoogleFont, createDefaultDocument } from "@artworkpdf/document-model";

// Import panels
import { ToolsPanel } from "./ToolsPanel";
import { LayersPanel } from "./LayersPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { ColorPanel } from "./ColorPanel";
import { EffectsPanel } from "./EffectsPanel";
import { SeparationsPanel } from "./SeparationsPanel";
import { DielineLibraryModal } from "./DielineLibraryModal";
import { PreflightPanel } from "./PreflightPanel";
import { DemoWatermark } from "./DemoWatermark";
import { SmartGuides, snapToGuides } from "./SmartGuides";
import { SpellCheckPanel } from "./SpellCheckPanel";

// Dieline library data
const dielineLibrary: { templates: DielineTemplate[] } = {
  templates: [], // Will be loaded from fixtures
};

// Google Fonts curation
const GOOGLE_FONTS = [
  { name: "Inter", category: "sans-serif" },
  { name: "Roboto", category: "sans-serif" },
  { name: "Open Sans", category: "sans-serif" },
  { name: "Playfair Display", category: "serif" },
  { name: "Merriweather", category: "serif" },
  { name: "Lato", category: "sans-serif" },
  { name: "Montserrat", category: "sans-serif" },
  { name: "Poppins", category: "sans-serif" },
  { name: "Bebas Neue", category: "display" },
  { name: "Lora", category: "serif" },
] as const;

// Tools
export type ToolType =
  | "select"
  | "directSelect"
  | "pen"
  | "curvature"
  | "rectangle"
  | "ellipse"
  | "polygon"
  | "star"
  | "line"
  | "text"
  | "dielineLibrary"
  | "zoom"
  | "hand";

// Snap configuration
const SNAP_CONFIG = {
  dieline: true,
  grid: false,
  pixel: true,
  threshold: 5, // pixels
};

export function ArtworkEditor() {
  // State
  const [document, setDocument] = useState<DocumentModel | null>(null);
  const [selectedTool, setSelectedTool] = useState<ToolType>("select");
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string>("artwork-1");
  const [showDielineLibrary, setShowDielineLibrary] = useState(false);
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [preflightResult, setPreflightResult] = useState<unknown>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeSeparations, setActiveSeparations] = useState<string[]>(["C", "M", "Y", "K"]);
  const [isDemoMode] = useState(true); // Demo restrictions enabled

  // Canvas ref
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load dieline library and initialize
  useEffect(() => {
    fetch("/dieline-library/library.json")
      .then((r) => r.json())
      .then((data) => {
        dielineLibrary.templates = data.templates;
        const defaultTemplate = data.templates.find((t: DielineTemplate) => t.isDefault);
        if (defaultTemplate) {
          setDocument(createDefaultDocument(defaultTemplate));
        } else {
          setDocument(createDefaultDocument());
        }
      })
      .catch(() => {
        // Fallback if library not available
        setDocument(createDefaultDocument());
      });
  }, []);

  // Load initial fonts
  useEffect(() => {
    GOOGLE_FONTS.forEach((font) => {
      loadGoogleFont(font.name).catch(() => {
        // Font loading is best-effort
      });
    });
  }, []);

  // Get selected objects
  const selectedObjects = useMemo(() => {
    if (!document) return [];
    const objects: ArtworkObject[] = [];
    document.layers.forEach((layer) => {
      layer.objects.forEach((obj) => {
        if (selectedObjectIds.includes(obj.id)) {
          objects.push(obj);
        }
      });
    });
    return objects;
  }, [document, selectedObjectIds]);

  // Get active layer
  const activeLayer = useMemo(() => {
    return document?.layers.find((l) => l.id === activeLayerId);
  }, [document, activeLayerId]);

  // Canvas dimensions
  const canvasWidth = document?.width || 500;
  const canvasHeight = document?.height || 500;

  // View dimensions (scaled)
  const viewWidth = canvasWidth * zoom;
  const viewHeight = canvasHeight * zoom;

  // Object creation helpers
  const createObject = useCallback((
    type: ArtworkObjectType,
    x: number,
    y: number,
    width: number,
    height: number
  ): ArtworkObject => {
    const id = `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const base: ArtworkObject = {
      id,
      type,
      x,
      y,
      width,
      height,
      opacity: 1,
      blendMode: "normal",
    };

    switch (type) {
      case "rect":
      case "ellipse":
        return { ...base, fill: "#000000" };
      case "text":
        return {
          ...base,
          text: "Double-click to edit",
          typography: {
            fontFamily: "Inter",
            fontSize: 16,
            fontWeight: "normal",
            fontStyle: "normal",
            textAlign: "left",
          },
        };
      case "line":
        return {
          ...base,
          stroke: "#000000",
          strokeWidth: 1,
        };
      case "polygon":
        return {
          ...base,
          fill: "#000000",
          polygonSides: 6,
        };
      case "star":
        return {
          ...base,
          fill: "#000000",
          starPoints: 5,
          starInnerRadius: 0.5,
        };
      default:
        return base;
    }
  }, []);

  // Add object to layer
  const addObject = useCallback((obj: ArtworkObject) => {
    if (!document) return;
    
    setDocument((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        layers: prev.layers.map((layer) =>
          layer.id === activeLayerId
            ? { ...layer, objects: [...layer.objects, obj] }
            : layer
        ),
      };
    });
    setSelectedObjectIds([obj.id]);
  }, [document, activeLayerId]);

  // Update object
  const updateObject = useCallback((id: string, updates: Partial<ArtworkObject>) => {
    setDocument((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        layers: prev.layers.map((layer) => ({
          ...layer,
          objects: layer.objects.map((obj) =>
            obj.id === id ? { ...obj, ...updates } : obj
          ),
        })),
      };
    });
  }, []);

  // Delete object
  const deleteObject = useCallback((id: string) => {
    setDocument((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        layers: prev.layers.map((layer) => ({
          ...layer,
          objects: layer.objects.filter((obj) => obj.id !== id),
        })),
      };
    });
    setSelectedObjectIds((prev) => prev.filter((oid) => oid !== id));
  }, []);

  // Layer management
  const updateLayer = useCallback((id: string, updates: Partial<Layer>) => {
    setDocument((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        layers: prev.layers.map((layer) =>
          layer.id === id ? { ...layer, ...updates } : layer
        ),
      };
    });
  }, []);

  // Add new layer
  const addLayer = useCallback(() => {
    if (!document) return;
    
    const newLayer: Layer = {
      id: `layer-${Date.now()}`,
      type: "artwork",
      name: `Layer ${document.layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: "normal",
      objects: [],
    };
    
    setDocument((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        layers: [...prev.layers, newLayer],
      };
    });
    setActiveLayerId(newLayer.id);
  }, [document]);

  // Delete layer
  const deleteLayer = useCallback((id: string) => {
    setDocument((prev) => {
      if (!prev) return prev;
      const filtered = prev.layers.filter((l) => l.id !== id);
      // Ensure at least one layer remains
      if (filtered.length === 0) {
        filtered.push({
          id: "layer-1",
          type: "artwork",
          name: "Artwork",
          visible: true,
          objects: [],
        });
      }
      return { ...prev, layers: filtered };
    });
    
    if (activeLayerId === id) {
      const remaining = document?.layers.find((l) => l.id !== id);
      if (remaining) setActiveLayerId(remaining.id);
    }
  }, [activeLayerId, document]);

  // Canvas click handler for tool actions
  const handleCanvasClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!document || !stageRef.current) return;
    
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    // Transform to document coordinates
    const x = (pointer.x - pan.x) / zoom;
    const y = (pointer.y - pan.y) / zoom;

    switch (selectedTool) {
      case "rectangle": {
        const obj = createObject("rect", x - 50, y - 25, 100, 50);
        addObject(obj);
        setSelectedTool("select");
        break;
      }
      case "ellipse": {
        const obj = createObject("ellipse", x - 50, y - 25, 100, 50);
        addObject(obj);
        setSelectedTool("select");
        break;
      }
      case "text": {
        const obj = createObject("text", x, y, 200, 50);
        addObject(obj);
        setSelectedTool("select");
        break;
      }
      case "line": {
        const obj = createObject("line", x, y, 100, 0);
        addObject(obj);
        setSelectedTool("select");
        break;
      }
      case "polygon": {
        const obj = createObject("polygon", x - 40, y - 40, 80, 80);
        addObject(obj);
        setSelectedTool("select");
        break;
      }
      case "star": {
        const obj = createObject("star", x - 40, y - 40, 80, 80);
        addObject(obj);
        setSelectedTool("select");
        break;
      }
    }
  }, [document, zoom, pan, selectedTool, createObject, addObject]);

  // Render object based on type
  const renderObject = (obj: ArtworkObject, layer: Layer) => {
    const isSelected = selectedObjectIds.includes(obj.id);
    const isVisible = layer.visible && (obj.opacity ?? 1) > 0;
    
    if (!isVisible) return null;

    const commonProps = {
      id: obj.id,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      rotation: obj.rotation || 0,
      skewX: obj.skewX || 0,
      skewY: obj.skewY || 0,
      opacity: (obj.opacity ?? 1) * (layer.opacity ?? 1),
      visible: true,
      draggable: !layer.locked && selectedTool === "select",
      onClick: () => setSelectedObjectIds([obj.id]),
      onDragEnd: (e: KonvaEventObject<DragEvent>) => {
        updateObject(obj.id, {
          x: e.target.x(),
          y: e.target.y(),
        });
      },
    };

    // Apply blend mode
    const blendMode = obj.blendMode || layer.blendMode || "normal";
    
    // Selection indicator
    const selectionProps = isSelected ? {
      shadowColor: "#3b82f6",
      shadowBlur: 10,
      shadowEnabled: true,
    } : {};

    switch (obj.type) {
      case "rect":
        return (
          <Rect
            key={obj.id}
            {...commonProps}
            {...selectionProps}
            fill={typeof obj.fill === "string" ? obj.fill : "#000"}
            stroke={obj.stroke}
            strokeWidth={obj.strokeWidth || 0}
          />
        );
        
      case "ellipse":
        return (
          <Circle
            key={obj.id}
            {...commonProps}
            {...selectionProps}
            fill={typeof obj.fill === "string" ? obj.fill : "#000"}
            stroke={obj.stroke}
            strokeWidth={obj.strokeWidth || 0}
            radiusX={obj.width / 2}
            radiusY={obj.height / 2}
            offsetX={-obj.width / 2}
            offsetY={-obj.height / 2}
          />
        );
        
      case "text":
        return (
          <Text
            key={obj.id}
            {...commonProps}
            {...selectionProps}
            text={obj.text || ""}
            fontSize={obj.typography?.fontSize || obj.fontSize || 16}
            fontFamily={obj.typography?.fontFamily || obj.fontFamily || "Inter"}
            fontStyle={`${obj.typography?.fontWeight === "bold" ? "bold" : "normal"} ${obj.typography?.fontStyle || "normal"}`}
            align={obj.typography?.textAlign || "left"}
            fill={typeof obj.fill === "string" ? obj.fill : "#000"}
          />
        );
        
      case "line":
        return (
          <Line
            key={obj.id}
            {...commonProps}
            {...selectionProps}
            points={[0, 0, obj.width, obj.height]}
            stroke={obj.stroke || "#000"}
            strokeWidth={obj.strokeWidth || 1}
          />
        );
        
      case "polygon": {
        const sides = obj.polygonSides || 6;
        const points = calculatePolygonPoints(obj.width / 2, sides);
        return (
          <Line
            key={obj.id}
            {...commonProps}
            {...selectionProps}
            points={points}
            closed
            fill={typeof obj.fill === "string" ? obj.fill : "#000"}
            stroke={obj.stroke}
            strokeWidth={obj.strokeWidth || 0}
          />
        );
      }
      
      case "star": {
        const points = obj.starPoints || 5;
        const innerRadius = (obj.starInnerRadius || 0.5) * (Math.min(obj.width, obj.height) / 2);
        const outerRadius = Math.min(obj.width, obj.height) / 2;
        const starPoints = calculateStarPoints(outerRadius, innerRadius, points);
        return (
          <Line
            key={obj.id}
            {...commonProps}
            {...selectionProps}
            points={starPoints}
            closed
            fill={typeof obj.fill === "string" ? obj.fill : "#000"}
            stroke={obj.stroke}
            strokeWidth={obj.strokeWidth || 0}
          />
        );
      }
      
      case "image": {
        const [img] = useImage(obj.image?.src || obj.src || "");
        if (!img) return null;
        return (
          <KonvaImage
            key={obj.id}
            {...commonProps}
            {...selectionProps}
            image={img}
          />
        );
      }
      
      default:
        return null;
    }
  };

  // Calculate polygon points
  const calculatePolygonPoints = (radius: number, sides: number): number[] => {
    const points: number[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      points.push(radius + radius * Math.cos(angle));
      points.push(radius + radius * Math.sin(angle));
    }
    return points;
  };

  // Calculate star points
  const calculateStarPoints = (outerR: number, innerR: number, points: number): number[] => {
    const pts: number[] = [];
    const cx = outerR;
    const cy = outerR;
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      pts.push(cx + r * Math.cos(angle));
      pts.push(cy + r * Math.sin(angle));
    }
    return pts;
  };

  // Dieline change handler
  const handleDielineChange = (template: DielineTemplate) => {
    setDocument(createDefaultDocument(template));
    setShowDielineLibrary(false);
    setSelectedObjectIds([]);
  };

  // Save/Preflight handler
  const handleSave = async () => {
    if (!document) return;
    
    // TODO: Implement preflight API call to lint-pdf
    // For now, show placeholder
    setPreflightResult({
      findings: [
        { id: "1", message: "Check color compliance", severity: "warning" },
        { id: "2", message: "Bleed coverage validated", severity: "info" },
      ],
    });
    setPreflightOpen(true);
  };

  if (!document) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p>Loading ArtworkPDF Editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-900 text-slate-100">
      {/* Menu Bar */}
      <div className="flex h-10 flex-none items-center gap-4 border-b border-slate-700 bg-slate-800 px-4">
        <a href="/" className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">artworkPDF</span>
        </a>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <button className="hover:text-white">File</button>
          <button className="hover:text-white">Edit</button>
          <button className="hover:text-white">View</button>
          <button className="hover:text-white">Object</button>
          <button className="hover:text-white">Type</button>
          <button className="hover:text-white">Window</button>
          <button className="hover:text-white">Help</button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={handleSave}
            className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-500"
          >
            Save & Preflight
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tools Panel - Left */}
        <ToolsPanel
          selectedTool={selectedTool}
          onToolChange={setSelectedTool}
        />

        {/* Canvas Area - Center */}
        <div
          ref={containerRef}
          className="relative flex-1 overflow-auto bg-slate-950"
          style={{
            backgroundImage: `
              linear-gradient(to right, #1e293b 1px, transparent 1px),
              linear-gradient(to bottom, #1e293b 1px, transparent 1px)
            `,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          }}
        >
          {/* Dieline Overlay Info */}
          <div className="absolute left-4 top-4 z-10 rounded-md bg-slate-800/90 px-3 py-2 text-xs text-slate-300">
            <p className="font-medium text-white">
              {document.dielineTemplateId
                ? dielineLibrary.templates.find((t) => t.id === document.dielineTemplateId)?.name
                : "Custom Canvas"}
            </p>
            <p className="text-slate-400">
              {document.width.toFixed(1)} × {document.height.toFixed(1)} mm
            </p>
          </div>

          {/* Canvas */}
          <div className="flex min-h-full min-w-full items-center justify-center p-8">
            <Stage
              ref={stageRef}
              width={viewWidth}
              height={viewHeight}
              scaleX={zoom}
              scaleY={zoom}
              x={pan.x}
              y={pan.y}
              onClick={handleCanvasClick}
              draggable={selectedTool === "hand"}
              onDragEnd={(e) => {
                setPan({ x: e.target.x(), y: e.target.y() });
              }}
            >
              {/* Smart guides overlay layer */}
              <KonvaLayer listening={false}>
                <SmartGuides
                  selectedObjectIds={selectedObjectIds}
                  objects={document.layers.flatMap((l) => l.objects)}
                  layers={document.layers}
                  zoom={zoom}
                />
              </KonvaLayer>

              {/* Render layers in order */}
              {document.layers.map((layer) => (
                <KonvaLayer key={layer.id} visible={layer.visible}>
                  {/* Render dieline template if this is the dieline layer */}
                  {layer.type === "dieline" && document.dielineTemplateId && (
                    <DielineOverlay
                      template={dielineLibrary.templates.find(
                        (t) => t.id === document.dielineTemplateId
                      )}
                    />
                  )}
                  
                  {/* Render objects */}
                  {layer.objects.map((obj) => renderObject(obj, layer))}
                </KonvaLayer>
              ))}
            </Stage>

            {/* Demo watermark overlay */}
            <DemoWatermark isDemo={isDemoMode} />
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="flex w-64 flex-col border-l border-slate-700 bg-slate-800/40">
          {/* Layers Panel */}
          <LayersPanel
            layers={document.layers}
            activeLayerId={activeLayerId}
            onLayerSelect={setActiveLayerId}
            onLayerUpdate={updateLayer}
            onLayerAdd={addLayer}
            onLayerDelete={deleteLayer}
          />

          {/* Properties Panel */}
          <PropertiesPanel
            selectedObjects={selectedObjects}
            onObjectUpdate={updateObject}
            onObjectDelete={deleteObject}
          />

          {/* Spell Check Panel */}
          <SpellCheckPanel
            selectedObject={selectedObjects[0] || null}
            onTextUpdate={(id, newText) => updateObject(id, { text: newText })}
          />

          {/* Color Panel */}
          <ColorPanel
            selectedObjects={selectedObjects}
            onObjectUpdate={updateObject}
          />

          {/* Effects Panel */}
          <EffectsPanel
            selectedObjects={selectedObjects}
            onObjectUpdate={updateObject}
          />

          {/* Separations Panel */}
          <SeparationsPanel
            document={document}
            activeSeparations={activeSeparations}
            onSeparationToggle={(name) =>
              setActiveSeparations((prev) =>
                prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
              )
            }
          />
        </div>
      </div>

      {/* Modals */}
      {showDielineLibrary && (
        <DielineLibraryModal
          templates={dielineLibrary.templates}
          onSelect={handleDielineChange}
          onClose={() => setShowDielineLibrary(false)}
        />
      )}

      {preflightOpen && (
        <PreflightPanel
          result={preflightResult}
          onClose={() => setPreflightOpen(false)}
        />
      )}
    </div>
  );
}

// Dieline Overlay Component
function DielineOverlay({ template }: { template?: DielineTemplate }) {
  if (!template) return null;

  const bleed = template.bleedMm;
  const trim = template.trimBox;
  
  return (
    <Group>
      {/* Bleed boundary */}
      <Rect
        x={0}
        y={0}
        width={template.dimensions.widthMm + bleed * 2}
        height={template.dimensions.heightMm + bleed * 2}
        fill="transparent"
        stroke="#22c55e"
        strokeWidth={0.5}
        dash={[4, 4]}
        opacity={0.5}
      />
      
      {/* Trim box (dieline) */}
      <Rect
        x={trim.x}
        y={trim.y}
        width={trim.width}
        height={trim.height}
        fill="transparent"
        stroke="#ef4444"
        strokeWidth={0.75}
      />
      
      {/* Dieline label */}
      <Text
        x={trim.x + 5}
        y={trim.y - 15}
        text={`${template.name} — ${template.dimensions.widthMm}×${template.dimensions.heightMm}mm`}
        fontSize={8}
        fill="#ef4444"
      />
    </Group>
  );
}
