// Layers Panel - Right sidebar layer management
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import type { Layer } from "@artworkpdf/document-model";

interface LayersPanelProps {
  layers: Layer[];
  activeLayerId: string;
  onLayerSelect: (id: string) => void;
  onLayerUpdate: (id: string, updates: Partial<Layer>) => void;
  onLayerAdd: () => void;
  onLayerDelete: (id: string) => void;
}

export function LayersPanel({
  layers,
  activeLayerId,
  onLayerSelect,
  onLayerUpdate,
  onLayerAdd,
  onLayerDelete,
}: LayersPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  return (
    <div className="border-b border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:bg-slate-700/30"
      >
        <span>Layers</span>
        <span className="text-slate-500">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="space-y-1 px-2 py-2">
          {/* Layer list */}
          <div className="space-y-1">
            {layers.map((layer) => (
              <div
                key={layer.id}
                onClick={() => onLayerSelect(layer.id)}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer ${
                  layer.id === activeLayerId
                    ? "bg-brand-600/20 ring-1 ring-brand-500/50"
                    : "hover:bg-slate-700/30"
                }`}
              >
                {/* Visibility toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLayerUpdate(layer.id, { visible: !layer.visible });
                  }}
                  className={`h-4 w-4 rounded ${
                    layer.visible ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  {layer.visible ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>

                {/* Lock toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLayerUpdate(layer.id, { locked: !layer.locked });
                  }}
                  className={`h-4 w-4 rounded ${
                    layer.locked ? "text-brand-400" : "text-slate-600"
                  }`}
                >
                  {layer.locked ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>

                {/* Layer name */}
                <span className="flex-1 truncate text-slate-200">
                  {layer.name}
                </span>

                {/* Delete button (non-dieline only) */}
                {layer.type !== "dieline" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLayerDelete(layer.id);
                    }}
                    className="h-4 w-4 text-slate-600 hover:text-red-400"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add layer button */}
          <button
            onClick={onLayerAdd}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-slate-600 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Layer
          </button>

          {/* Active layer properties */}
          {activeLayer && (
            <div className="mt-3 space-y-2 border-t border-slate-700 pt-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">Opacity</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={(activeLayer.opacity ?? 1) * 100}
                  onChange={(e) =>
                    onLayerUpdate(activeLayer.id, { opacity: parseInt(e.target.value) / 100 })
                  }
                  className="h-1 w-20 accent-brand-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">Blend Mode</label>
                <select
                  value={activeLayer.blendMode || "normal"}
                  onChange={(e) => onLayerUpdate(activeLayer.id, { blendMode: e.target.value })}
                  className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200"
                >
                  <option value="normal">Normal</option>
                  <option value="multiply">Multiply</option>
                  <option value="screen">Screen</option>
                  <option value="overlay">Overlay</option>
                  <option value="soft-light">Soft Light</option>
                  <option value="hard-light">Hard Light</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
