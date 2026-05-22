// Separations Panel - Print preview and color separation controls
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import type { DocumentModel, Separation } from "@artworkpdf/document-model";

interface SeparationsPanelProps {
  document: DocumentModel | null;
  activeSeparations: string[];
  onSeparationToggle: (name: string) => void;
}

const CMYK_COLORS: Record<string, string> = {
  C: "#00FFFF",
  M: "#FF00FF",
  Y: "#FFFF00",
  K: "#000000",
};

export function SeparationsPanel({
  document,
  activeSeparations,
  onSeparationToggle,
}: SeparationsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [previewMode, setPreviewMode] = useState<"normal" | " Separations">("normal");

  const separations = document?.separations || [];

  // Calculate total ink coverage
  const totalCoverage = separations.reduce((sum, sep) => sum + (sep.coverage || 0), 0);

  return (
    <div className="border-b border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:bg-slate-700/30"
      >
        <span>Separations</span>
        <span className="text-slate-500">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="space-y-3 px-3 py-3">
          {/* Preview mode */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-400">Preview</label>
            <select
              value={previewMode}
              onChange={(e) => setPreviewMode(e.target.value as any)}
              className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-200"
            >
              <option value="normal">Normal</option>
              <option value=" Separations">Separations</option>
            </select>
          </div>

          {/* Separation list */}
          <div className="space-y-1.5">
            {separations.map((sep) => (
              <SeparationItem
                key={sep.name}
                separation={sep}
                isActive={activeSeparations.includes(sep.name)}
                onToggle={() => onSeparationToggle(sep.name)}
              />
            ))}
          </div>

          {/* Coverage stats */}
          <div className="rounded bg-slate-700/50 p-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Coverage</span>
              <span className="font-medium text-slate-200">{totalCoverage.toFixed(1)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-600">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.min(totalCoverage, 100)}%` }}
              />
            </div>
          </div>

          {/* Warning for high coverage */}
          {totalCoverage > 300 && (
            <div className="rounded bg-yellow-500/10 p-2">
              <p className="text-xs text-yellow-400">
                High ink coverage ({totalCoverage.toFixed(0)}%). Consider reducing for better drying.
              </p>
            </div>
          )}

          {/* Print info */}
          {document && (
            <div className="space-y-1 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Size:</span>
                <span>
                  {document.width}×{document.height} {document.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Layers:</span>
                <span>{document.layers.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Objects:</span>
                <span>
                  {document.layers.reduce(
                    (sum, l) => sum + (l.objects?.length || 0),
                    0
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SeparationItem({
  separation,
  isActive,
  onToggle,
}: {
  separation: Separation;
  isActive: boolean;
  onToggle: () => void;
}) {
  const color = CMYK_COLORS[separation.name] || separation.color || "#808080";
  const isSpot = separation.type === "spot";

  return (
    <div className="flex items-center gap-2 rounded bg-slate-700/30 p-2">
      {/* Visibility toggle */}
      <button
        onClick={onToggle}
        className={`h-4 w-4 rounded ${isActive ? "text-slate-300" : "text-slate-600"}`}
      >
        {isActive ? (
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

      {/* Color swatch */}
      <div
        className="h-4 w-4 rounded border border-slate-500"
        style={{ backgroundColor: color }}
      />

      {/* Name and type */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-slate-200 truncate">
            {separation.name}
          </span>
          {isSpot && (
            <span className="rounded bg-purple-500/20 px-1 py-0 text-[9px] text-purple-300">
              Spot
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-500">
          {separation.coverage?.toFixed(1)}% coverage
        </div>
      </div>

      {/* Angle indicator for CMYK */}
      {!isSpot && separation.angle !== undefined && (
        <div className="text-[10px] text-slate-500">
          {separation.angle}°
        </div>
      )}
    </div>
  );
}
