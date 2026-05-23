// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { useCallback, useEffect, useState } from "react";

export type EditorMode = "basic" | "pro";

const STORAGE_KEY = "artworkpdf:editor-mode";

/**
 * Resolves the editor mode with this precedence:
 *  1. Explicit user choice persisted in localStorage
 *  2. `prefer` prop (set by the page — e.g. demo passes "auto")
 *  3. Viewport heuristic: pro on >= 900 CSS px, basic otherwise
 *
 * `setMode(null)` clears the saved preference and returns to auto.
 */
export function useEditorMode(prefer: EditorMode | "auto" = "auto"): {
  mode: EditorMode;
  setMode: (next: EditorMode | null) => void;
  isAuto: boolean;
} {
  const [stored, setStored] = useState<EditorMode | null>(null);
  const [viewportPro, setViewportPro] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "basic" || raw === "pro") setStored(raw);
    } catch {
      // localStorage may be unavailable (Safari private mode, etc.)
    }

    const mq = window.matchMedia("(min-width: 900px)");
    const sync = () => setViewportPro(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    setHydrated(true);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const setMode = useCallback((next: EditorMode | null) => {
    setStored(next);
    try {
      if (next === null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  // Until hydration completes, render in `prefer` to avoid SSR flash.
  const auto: EditorMode = viewportPro ? "pro" : "basic";
  const fallback: EditorMode = prefer === "auto" ? auto : prefer;
  const mode = stored ?? (hydrated ? auto : fallback);

  return { mode, setMode, isAuto: stored === null };
}
