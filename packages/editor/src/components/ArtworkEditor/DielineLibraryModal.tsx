// Dieline Library Modal - Select dieline templates
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import type { DielineTemplate } from "@artworkpdf/document-model";

interface DielineLibraryModalProps {
  templates: DielineTemplate[];
  onSelect: (template: DielineTemplate) => void;
  onClose: () => void;
}

export function DielineLibraryModal({ templates, onSelect, onClose }: DielineLibraryModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<DielineTemplate | null>(null);

  const categories = ["all", ...new Set(templates.map((t) => t.category))];

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      searchTerm === "" ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex h-[600px] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-slate-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Dieline Library</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 border-b border-slate-700 px-6 py-3">
          <input
            type="text"
            placeholder="Search dielines..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 rounded-md bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-md bg-slate-700 px-3 py-2 text-sm text-white"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Template grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`group flex flex-col rounded-lg border-2 p-3 text-left transition-all ${
                    selectedTemplate?.id === template.id
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-slate-600 bg-slate-700/50 hover:border-slate-500"
                  }`}
                >
                  {/* Preview SVG */}
                  <div
                    className="mb-3 aspect-square w-full rounded bg-slate-600/50"
                    dangerouslySetInnerHTML={{ __html: template.previewSvg || "" }}
                  />
                  
                  {/* Info */}
                  <h3 className="text-sm font-medium text-white">{template.name}</h3>
                  <p className="text-xs text-slate-400">
                    {template.dimensions.widthMm}×{template.dimensions.heightMm}mm
                  </p>
                  
                  {/* Tags */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {template.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-slate-600 px-1.5 py-0.5 text-[10px] text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected details */}
          {selectedTemplate && (
            <div className="w-64 border-l border-slate-700 bg-slate-700/30 p-4">
              <h3 className="font-semibold text-white">{selectedTemplate.name}</h3>
              <p className="mt-1 text-xs text-slate-400">{selectedTemplate.description}</p>
              
              <div className="mt-4 space-y-2 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Category:</span>
                  <span>{selectedTemplate.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dimensions:</span>
                  <span>
                    {selectedTemplate.dimensions.widthMm}×{selectedTemplate.dimensions.heightMm}mm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bleed:</span>
                  <span>{selectedTemplate.bleedMm}mm</span>
                </div>
              </div>

              <button
                onClick={() => onSelect(selectedTemplate)}
                className="mt-6 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
              >
                Select This Dieline
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
