// Effects Panel - Drop shadow, glow, blur effects
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import type { ArtworkObject, Effect } from "@artworkpdf/document-model";

interface EffectsPanelProps {
  selectedObjects: ArtworkObject[];
  onObjectUpdate: (id: string, updates: Partial<ArtworkObject>) => void;
}

export function EffectsPanel({ selectedObjects, onObjectUpdate }: EffectsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (selectedObjects.length === 0) return null;

  const obj = selectedObjects[0];
  const effects = obj.effects || [];

  const addEffect = (type: Effect["type"]) => {
    const newEffect: Effect =
      type === "dropShadow"
        ? {
            type: "dropShadow",
            offsetX: 4,
            offsetY: 4,
            blur: 8,
            color: "#000000",
            opacity: 0.5,
          }
        : type === "innerShadow"
        ? {
            type: "innerShadow",
            offsetX: 2,
            offsetY: 2,
            blur: 4,
            color: "#000000",
            opacity: 0.3,
          }
        : type === "outerGlow"
        ? {
            type: "outerGlow",
            blur: 10,
            color: "#FFD700",
            opacity: 0.6,
          }
        : type === "innerGlow"
        ? {
            type: "innerGlow",
            blur: 8,
            color: "#FFFFFF",
            opacity: 0.5,
          }
        : {
            type: "blur",
            radius: 5,
          };

    onObjectUpdate(obj.id, { effects: [...effects, newEffect] });
  };

  const updateEffect = (index: number, updates: Partial<Effect>) => {
    const newEffects = effects.map((e, i) => (i === index ? { ...e, ...updates } : e));
    onObjectUpdate(obj.id, { effects: newEffects });
  };

  const removeEffect = (index: number) => {
    const newEffects = effects.filter((_, i) => i !== index);
    onObjectUpdate(obj.id, { effects: newEffects });
  };

  return (
    <div className="border-b border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:bg-slate-700/30"
      >
        <span>Effects</span>
        <span className="text-slate-500">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="space-y-3 px-3 py-3">
          {/* Add effect buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => addEffect("dropShadow")}
              className="rounded bg-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-600"
            >
              + Drop Shadow
            </button>
            <button
              onClick={() => addEffect("outerGlow")}
              className="rounded bg-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-600"
            >
              + Outer Glow
            </button>
            <button
              onClick={() => addEffect("innerShadow")}
              className="rounded bg-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-600"
            >
              + Inner Shadow
            </button>
            <button
              onClick={() => addEffect("innerGlow")}
              className="rounded bg-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-600"
            >
              + Inner Glow
            </button>
            <button
              onClick={() => addEffect("blur")}
              className="col-span-2 rounded bg-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-600"
            >
              + Blur
            </button>
          </div>

          {/* Effect list */}
          {effects.length > 0 && (
            <div className="space-y-2">
              {effects.map((effect, index) => (
                <div key={index} className="rounded bg-slate-700/50 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium capitalize text-slate-300">
                      {effect.type.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <button
                      onClick={() => removeEffect(index)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Effect controls */}
                  <div className="mt-2 space-y-1.5">
                    {(effect.type === "dropShadow" || effect.type === "innerShadow") && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-[10px] text-slate-400">X</span>
                          <input
                            type="number"
                            value={effect.offsetX}
                            onChange={(e) =>
                              updateEffect(index, { offsetX: parseInt(e.target.value) })
                            }
                            className="w-14 rounded bg-slate-600 px-1.5 py-0.5 text-xs text-slate-200"
                          />
                          <span className="w-8 text-[10px] text-slate-400">Y</span>
                          <input
                            type="number"
                            value={effect.offsetY}
                            onChange={(e) =>
                              updateEffect(index, { offsetY: parseInt(e.target.value) })
                            }
                            className="w-14 rounded bg-slate-600 px-1.5 py-0.5 text-xs text-slate-200"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-[10px] text-slate-400">Blur</span>
                          <input
                            type="number"
                            value={effect.blur}
                            onChange={(e) =>
                              updateEffect(index, { blur: parseInt(e.target.value) })
                            }
                            className="flex-1 rounded bg-slate-600 px-1.5 py-0.5 text-xs text-slate-200"
                          />
                        </div>
                      </>
                    )}

                    {(effect.type === "outerGlow" || effect.type === "innerGlow") && (
                      <div className="flex items-center gap-2">
                        <span className="w-8 text-[10px] text-slate-400">Blur</span>
                        <input
                          type="number"
                          value={effect.blur}
                          onChange={(e) =>
                            updateEffect(index, { blur: parseInt(e.target.value) })
                          }
                          className="flex-1 rounded bg-slate-600 px-1.5 py-0.5 text-xs text-slate-200"
                        />
                      </div>
                    )}

                    {effect.type === "blur" && (
                      <div className="flex items-center gap-2">
                        <span className="w-8 text-[10px] text-slate-400">Radius</span>
                        <input
                          type="number"
                          value={effect.radius}
                          onChange={(e) =>
                            updateEffect(index, { radius: parseInt(e.target.value) })
                          }
                          className="flex-1 rounded bg-slate-600 px-1.5 py-0.5 text-xs text-slate-200"
                        />
                      </div>
                    )}

                    {/* Color picker for effects with color */}
                    {"color" in effect && (
                      <div className="flex items-center gap-2">
                        <span className="w-8 text-[10px] text-slate-400">Color</span>
                        <input
                          type="color"
                          value={effect.color}
                          onChange={(e) => updateEffect(index, { color: e.target.value })}
                          className="h-6 w-10 rounded bg-transparent"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={Math.round((effect.opacity || 0.5) * 100)}
                          onChange={(e) =>
                            updateEffect(index, { opacity: parseInt(e.target.value) / 100 })
                          }
                          className="w-14 rounded bg-slate-600 px-1.5 py-0.5 text-xs text-slate-200"
                        />
                        <span className="text-[10px] text-slate-500">%</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {effects.length === 0 && (
            <p className="text-center text-xs text-slate-500">No effects applied</p>
          )}
        </div>
      )}
    </div>
  );
}
