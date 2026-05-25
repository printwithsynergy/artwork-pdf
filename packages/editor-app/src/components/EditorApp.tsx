// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import type { PreflightReport } from "../lib/preflight/types";
import { useEffect, useState } from "react";
import { type EditorMode, useEditorMode } from "../hooks/useEditorMode";
import { useIsMobile } from "../hooks/useIsMobile";
import { usePreflight } from "../hooks/usePreflight";
import { DEFAULT_BLEED_MM } from "../lib/bleed";
import { type EditorConfig, resolveConfig } from "../lib/editor-config";
import { type CanvasObj, EditorCanvas } from "./EditorCanvas";
import { FileDropZone } from "./FileDropZone";
import { PreflightPanel } from "./PreflightPanel";
import { TopBar, type TopBarProps } from "./TopBar";

type Phase = "upload" | "checking" | "preflight" | "editor";

/**
 * Props accepted by the top-level editor component. Hosts pass these
 * to mount the editor in their page (Next.js route, Astro
 * `client:only`, plain React app, etc.).
 *
 * @public
 */
export type EditorAppProps = {
  /** Strips destructive actions and routes export through the
   *  client-only path. The `/demo` route flips this on. */
  demo?: boolean;
  /** Starting phase. Set `"editor"` to skip the upload step. */
  initialPhase?: Phase;
  /** Seed objects for the canvas — typically from `templateToInitialState`. */
  initialObjects?: CanvasObj[];
  /** Seed page size for the canvas — typically from `templateToInitialState`. */
  initialPageSize?: { width: number; height: number };
  /** Initial mode preference. `"auto"` resolves by viewport. */
  preferMode?: EditorMode | "auto";
  /** Per-instance flag overrides. Merged into mode + global defaults. */
  config?: Partial<EditorConfig>;
  /** Bleed margin in millimetres. Defaults to {@link DEFAULT_BLEED_MM} (0.125 in). */
  bleedMm?: number;
  /** Host-supplied top bar configuration (logo, extra CTAs, etc.). */
  topBar?: Partial<TopBarProps>;
};

export function EditorApp({
  demo = false,
  initialPhase = "upload",
  initialObjects,
  initialPageSize,
  preferMode = "auto",
  config: configOverrides,
  bleedMm = DEFAULT_BLEED_MM,
  topBar,
}: EditorAppProps) {
  const { mode, setMode } = useEditorMode(preferMode);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<PreflightReport | null>(null);
  const { state: preflightState, run: runPreflight } = usePreflight();
  const [menuOpen, setMenuOpen] = useState(false);

  const isMobile = useIsMobile();
  const config = resolveConfig(mode, configOverrides);

  async function handleFile(f: File) {
    setFile(f);
    setPhase("checking");
    const r = await runPreflight(f, { demoMode: demo });
    if (r) {
      setReport(r);
      setPhase("preflight");
    } else {
      setPhase("upload");
    }
  }

  function handleSendToLint() {
    alert("Job queued for lint node analysis.");
  }

  return (
    <main
      style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#ffffff" }}
    >
      <TopBar
        {...topBar}
        showDemoBadge={(topBar?.showDemoBadge ?? (demo && config.enable_demo_badge)) || false}
        onMenuToggle={() => setMenuOpen((v) => !v)}
        showMenuButton={isMobile && phase === "editor"}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background: "#ffffff",
        }}
      >
        {phase === "upload" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.25rem",
            }}
          >
            <FileDropZone onFile={handleFile} />
            {!demo && (
              <a
                href="/demo"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "0.85rem",
                  color: "#fc5102",
                  fontWeight: 600,
                  textDecoration: "none",
                  opacity: 0.85,
                }}
              >
                Try the demo editor (no file needed) →
              </a>
            )}
          </div>
        )}

        {phase === "checking" && (
          <p style={{ color: "#995b30" }}>Running preflight checks&hellip;</p>
        )}

        {phase === "preflight" && report && config.enable_preflight_banner && (
          <PreflightPanel
            report={report}
            onProceed={() => setPhase("editor")}
            onSendToLint={handleSendToLint}
          />
        )}
        {phase === "preflight" && report && !config.enable_preflight_banner && (
          <AutoAdvance onContinue={() => setPhase("editor")} />
        )}

        {phase === "editor" && (
          <EditorCanvas
            file={file}
            report={report}
            demo={demo}
            mode={mode}
            onModeChange={setMode}
            config={config}
            bleedMm={bleedMm}
            isMobile={isMobile}
            menuOpen={menuOpen}
            onMenuOpenChange={setMenuOpen}
            {...(initialObjects ? { initialObjects } : {})}
            {...(initialPageSize ? { initialPageSize } : {})}
          />
        )}
      </div>

      {demo && phase !== "editor" && (
        <footer
          style={{
            background: "#1a0f08",
            borderTop: "1px solid #3d1a00",
            padding: "0.5rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "0.78rem", color: "#666" }}>
            Demo — client-side checks &amp; export only. Self-host for full PDF/X-4 + lint.
          </span>
        </footer>
      )}

      {preflightState.phase === "error" && (
        <div
          style={{
            position: "fixed",
            bottom: "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#f44336",
            color: "#fff",
            padding: "0.5rem 1rem",
            borderRadius: 4,
            fontSize: "0.82rem",
          }}
        >
          {preflightState.message}
        </div>
      )}
    </main>
  );
}

function AutoAdvance({ onContinue }: { onContinue: () => void }) {
  // Host disabled the preflight banner; skip straight into the editor.
  // Runs once via effect so React's render cycle stays clean.
  useAutoAdvance(onContinue);
  return null;
}

function useAutoAdvance(fn: () => void) {
  // Inline single-use helper — avoids polluting hooks/ for one effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire-once
  useEffect(() => {
    fn();
  }, []);
}
