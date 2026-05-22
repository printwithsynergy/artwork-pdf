// Tools Panel - Left sidebar tool selection
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactElement } from "react";
import type { ToolType } from "./index";

interface ToolsPanelProps {
  selectedTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

const TOOLS: { id: ToolType; label: string; icon: string; shortcut?: string }[] = [
  { id: "select", label: "Selection", icon: "cursor", shortcut: "V" },
  { id: "directSelect", label: "Direct Selection", icon: "cursor-arrow", shortcut: "A" },
  { id: "pen", label: "Pen", icon: "pen", shortcut: "P" },
  { id: "curvature", label: "Curvature", icon: "wave", shortcut: "Shift+~" },
  { id: "rectangle", label: "Rectangle", icon: "square", shortcut: "M" },
  { id: "ellipse", label: "Ellipse", icon: "circle", shortcut: "L" },
  { id: "polygon", label: "Polygon", icon: "hexagon", shortcut: "" },
  { id: "star", label: "Star", icon: "star", shortcut: "" },
  { id: "line", label: "Line", icon: "line", shortcut: "\\" },
  { id: "text", label: "Text", icon: "T", shortcut: "T" },
  { id: "dielineLibrary", label: "Dieline Library", icon: "package", shortcut: "" },
  { id: "zoom", label: "Zoom", icon: "magnifier", shortcut: "Z" },
  { id: "hand", label: "Hand", icon: "hand", shortcut: "H" },
];

export function ToolsPanel({ selectedTool, onToolChange }: ToolsPanelProps) {
  return (
    <div className="flex w-14 flex-col items-center border-r border-slate-700 bg-slate-800 py-2">
      <div className="flex flex-col gap-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            className={`group relative flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
              selectedTool === tool.id
                ? "bg-brand-600 text-white"
                : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
            title={`${tool.label} ${tool.shortcut ? `(${tool.shortcut})` : ""}`}
          >
            <ToolIcon name={tool.icon} />
            
            {/* Tooltip */}
            <span className="absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
              {tool.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Simple icon component
function ToolIcon({ name }: { name: string }) {
  const icons: Record<string, ReactElement> = {
    cursor: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
    ),
    "cursor-arrow": (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    pen: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    wave: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    square: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" strokeWidth={1.5} />
      </svg>
    ),
    circle: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8" strokeWidth={1.5} />
      </svg>
    ),
    hexagon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" />
      </svg>
    ),
    star: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    line: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <line x1="4" y1="20" x2="20" y2="4" strokeWidth={1.5} />
      </svg>
    ),
    T: (
      <span className="text-sm font-bold">T</span>
    ),
    package: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    magnifier: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
      </svg>
    ),
    hand: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0v.5" />
      </svg>
    ),
  };

  return icons[name] || <span className="text-xs">?</span>;
}
