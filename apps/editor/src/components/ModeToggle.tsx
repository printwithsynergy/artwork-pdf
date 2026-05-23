// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import type { EditorMode } from "../hooks/useEditorMode.js";

type Props = {
  mode: EditorMode;
  onChange: (next: EditorMode) => void;
};

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Editor mode"
      style={{
        display: "inline-flex",
        border: "1px solid #3d1a00",
        borderRadius: 4,
        overflow: "hidden",
        background: "#120a04",
      }}
    >
      {(["basic", "pro"] as EditorMode[]).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={active}
            style={{
              background: active ? "#fc5102" : "transparent",
              color: active ? "#fff" : "#888",
              border: "none",
              padding: "0.3rem 0.7rem",
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: active ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}
