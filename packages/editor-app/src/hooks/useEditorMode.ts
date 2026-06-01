// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Editor UI complexity tier. `"basic"` strips advanced controls and
 * is the touch/mobile default; `"pro"` shows the full toolset.
 * Resolved via {@link useEditorMode}.
 *
 * @public
 */
export type EditorMode = "basic" | "pro";

const STORAGE_KEY = "artworkpdf:editor-mode";

/**
 * Resolve the active editor mode and expose a setter that persists
 * the choice across reloads.
 *
 * Precedence (later wins):
 *
 *   1. Explicit user choice persisted in `localStorage`
 *      (`"artworkpdf:editor-mode"`)
 *   2. The `prefer` arg (typically threaded from the host page —
 *      `/demo` passes `"auto"` so the viewport heuristic picks)
 *   3. Viewport heuristic: `"pro"` on wider viewports, `"basic"`
 *      on narrower ones
 *
 * `setMode(null)` clears the persisted preference and falls back to
 * the heuristic; `isAuto` is true while no explicit choice is saved.
 *
 * SSR-safe: returns the resolved fallback until hydration completes,
 * so the server render matches the first client paint.
 *
 * @public
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
