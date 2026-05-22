// Color/Swatches Panel - Color management and swatches
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import type { ArtworkObject } from "@artworkpdf/document-model";

interface ColorPanelProps {
  selectedObjects: ArtworkObject[];
  onObjectUpdate: (id: string, updates: Partial<ArtworkObject>) => void;
}

const DEFAULT_SWATCHES = [
  "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF",
  "#FFFF00", "#FF00FF", "#00FFFF", "#FFA500", "#800080",
  "#FFC0CB", "#A52A2A", "#808080", "#C0C0C0", "#FFD700",
];

const SEPARATION_NAMES = {
  C: "Cyan",
  M: "Magenta", 
  Y: "Yellow",
  K: "Black",
};

export function ColorPanel({ selectedObjects, onObjectUpdate }: ColorPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"swatches" | "cmyk" | "spot">("swatches");
  const [customColor, setCustomColor] = useState("#000000");

  if (selectedObjects.length === 0) return null;

  const obj = selectedObjects[0];
  const currentFill = typeof obj.fill === "string" ? obj.fill : "#000000";

  const handleSwatchClick = (color: string) => {
    onObjectUpdate(obj.id, { fill: color });
  };

  return (
    <div className="border-b border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:bg-slate-700/30"
      >
        <span>Color</span>
        <span className="text-slate-500">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="px-3 py-3">
          {/* Tabs */}
          <div className="mb-3 flex gap-1">
            {(["swatches", "cmyk", "spot"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded px-2 py-1 text-xs ${
                  activeTab === tab
                    ? "bg-brand-600 text-white"
                    : "bg-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Swatches tab */}
          {activeTab === "swatches" && (
            <div className="space-y-3">
              {/* Color grid */}
              <div className="grid grid-cols-5 gap-1.5">
                {DEFAULT_SWATCHES.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleSwatchClick(color)}
                    className={`h-8 w-full rounded-md border-2 ${
                      currentFill === color ? "border-white" : "border-slate-600"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              {/* Custom color picker */}
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="h-8 w-12 rounded bg-transparent"
                />
                <button
                  onClick={() => handleSwatchClick(customColor)}
                  className="flex-1 rounded bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-500"
                >
                  Apply Color
                </button>
              </div>

              {/* Current color info */}
              <div className="rounded bg-slate-700/50 px-2 py-2">
                <div className="flex items-center gap-2">
                  <div
                    className="h-6 w-6 rounded border border-slate-600"
                    style={{ backgroundColor: currentFill }}
                  />
                  <span className="text-xs text-slate-400">{currentFill}</span>
                </div>
              </div>
            </div>
          )}

          {/* CMYK tab */}
          {activeTab === "cmyk" && (
            <div className="space-y-2">
              {Object.entries(SEPARATION_NAMES).map(([key, name]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-14 text-xs font-medium text-slate-400">{name}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    className="flex-1 h-1 accent-brand-500"
                  />
                  <span className="w-8 text-right text-xs text-slate-500">0%</span>
                </div>
              ))}
              <p className="text-xs text-slate-500">
                CMYK values applied to separations
              </p>
            </div>
          )}

          {/* Spot colors tab */}
          {activeTab === "spot" && (
            <div className="space-y-2">
              <div className="rounded bg-slate-700/50 px-2 py-2 text-center">
                <p className="text-xs text-slate-400">No spot colors defined</p>
                <button className="mt-2 text-xs text-brand-400 hover:text-brand-300">
                  + Add Spot Color
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
