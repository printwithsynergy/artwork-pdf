// Properties Panel - Context-aware properties for selected objects
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import type { ArtworkObject } from "@artworkpdf/document-model";

interface PropertiesPanelProps {
  selectedObjects: ArtworkObject[];
  onObjectUpdate: (id: string, updates: Partial<ArtworkObject>) => void;
  onObjectDelete: (id: string) => void;
}

export function PropertiesPanel({
  selectedObjects,
  onObjectUpdate,
  onObjectDelete,
}: PropertiesPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (selectedObjects.length === 0) {
    return (
      <div className="border-b border-slate-700">
        <button className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span>Properties</span>
        </button>
        <div className="px-3 py-4 text-center text-xs text-slate-500">
          Select an object to edit properties
        </div>
      </div>
    );
  }

  const obj = selectedObjects[0];
  const isText = obj.type === "text";
  const isShape = ["rect", "ellipse", "polygon", "star"].includes(obj.type);

  return (
    <div className="border-b border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:bg-slate-700/30"
      >
        <span>Properties</span>
        <span className="text-slate-500">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="space-y-3 px-3 py-3">
          {/* Transform section */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">Transform</label>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1">
                <span className="w-4 text-xs text-slate-500">X</span>
                <input
                  type="number"
                  value={Math.round(obj.x)}
                  onChange={(e) => onObjectUpdate(obj.id, { x: parseFloat(e.target.value) })}
                  className="w-full rounded bg-slate-700 px-2 py-1 text-xs text-slate-200"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="w-4 text-xs text-slate-500">Y</span>
                <input
                  type="number"
                  value={Math.round(obj.y)}
                  onChange={(e) => onObjectUpdate(obj.id, { y: parseFloat(e.target.value) })}
                  className="w-full rounded bg-slate-700 px-2 py-1 text-xs text-slate-200"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="w-4 text-xs text-slate-500">W</span>
                <input
                  type="number"
                  value={Math.round(obj.width)}
                  onChange={(e) => onObjectUpdate(obj.id, { width: parseFloat(e.target.value) })}
                  className="w-full rounded bg-slate-700 px-2 py-1 text-xs text-slate-200"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="w-4 text-xs text-slate-500">H</span>
                <input
                  type="number"
                  value={Math.round(obj.height)}
                  onChange={(e) => onObjectUpdate(obj.id, { height: parseFloat(e.target.value) })}
                  className="w-full rounded bg-slate-700 px-2 py-1 text-xs text-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Rotation</span>
              <input
                type="number"
                value={Math.round(obj.rotation || 0)}
                onChange={(e) => onObjectUpdate(obj.id, { rotation: parseFloat(e.target.value) })}
                className="w-16 rounded bg-slate-700 px-2 py-1 text-xs text-slate-200"
              />
              <span className="text-xs text-slate-500">°</span>
            </div>
          </div>

          {/* Shape properties */}
          {isShape && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Fill & Stroke</label>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Fill</span>
                <input
                  type="color"
                  value={typeof obj.fill === "string" ? obj.fill : "#000000"}
                  onChange={(e) => onObjectUpdate(obj.id, { fill: e.target.value })}
                  className="h-6 w-10 rounded bg-transparent"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Stroke</span>
                <input
                  type="color"
                  value={typeof obj.stroke === "string" ? obj.stroke : "#000000"}
                  onChange={(e) => onObjectUpdate(obj.id, { stroke: e.target.value })}
                  className="h-6 w-10 rounded bg-transparent"
                />
                <input
                  type="number"
                  value={obj.strokeWidth || 0}
                  onChange={(e) => onObjectUpdate(obj.id, { strokeWidth: parseFloat(e.target.value) })}
                  className="w-14 rounded bg-slate-700 px-2 py-1 text-xs text-slate-200"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Opacity</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={(obj.opacity || 1) * 100}
                  onChange={(e) => onObjectUpdate(obj.id, { opacity: parseInt(e.target.value) / 100 })}
                  className="h-1 w-24 accent-brand-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Blend</span>
                <select
                  value={obj.blendMode || "normal"}
                  onChange={(e) => onObjectUpdate(obj.id, { blendMode: e.target.value })}
                  className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200"
                >
                  <option value="normal">Normal</option>
                  <option value="multiply">Multiply</option>
                  <option value="screen">Screen</option>
                  <option value="overlay">Overlay</option>
                </select>
              </div>
            </div>
          )}

          {/* Text properties */}
          {isText && obj.typography && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Typography</label>
              
              <div className="space-y-1">
                <select
                  value={obj.typography.fontFamily}
                  onChange={(e) =>
                    onObjectUpdate(obj.id, {
                      typography: { ...obj.typography!, fontFamily: e.target.value },
                    })
                  }
                  className="w-full rounded bg-slate-700 px-2 py-1 text-xs text-slate-200"
                >
                  <option value="Inter">Inter</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Playfair Display">Playfair Display</option>
                  <option value="Bebas Neue">Bebas Neue</option>
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={obj.typography.fontSize}
                    onChange={(e) =>
                      onObjectUpdate(obj.id, {
                        typography: { ...obj.typography!, fontSize: parseInt(e.target.value) },
                      })
                    }
                    className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-200"
                  />
                  <select
                    value={obj.typography.fontWeight}
                    onChange={(e) =>
                      onObjectUpdate(obj.id, {
                        typography: { ...obj.typography!, fontWeight: e.target.value as any },
                      })
                    }
                    className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                  </select>
                </div>

                <select
                  value={obj.typography.textAlign}
                  onChange={(e) =>
                    onObjectUpdate(obj.id, {
                      typography: { ...obj.typography!, textAlign: e.target.value as any },
                    })
                  }
                  className="w-full rounded bg-slate-700 px-2 py-1 text-xs text-slate-200"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>

              <textarea
                value={obj.text}
                onChange={(e) => onObjectUpdate(obj.id, { text: e.target.value })}
                rows={3}
                className="w-full rounded bg-slate-700 px-2 py-1 text-xs text-slate-200"
              />
            </div>
          )}

          {/* Delete button */}
          <button
            onClick={() => onObjectDelete(obj.id)}
            className="w-full rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30"
          >
            Delete Object
          </button>
        </div>
      )}
    </div>
  );
}
