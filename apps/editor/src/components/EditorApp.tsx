// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import type { PreflightReport } from "@artworkpdf/document-model";
import { useState } from "react";
import { type EditorMode, useEditorMode } from "../hooks/useEditorMode.js";
import { usePreflight } from "../hooks/usePreflight.js";
import { type CanvasObj, EditorCanvas } from "./EditorCanvas";
import { FileDropZone } from "./FileDropZone";
import { ModeToggle } from "./ModeToggle";
import { PreflightPanel } from "./PreflightPanel";

type Phase = "upload" | "checking" | "preflight" | "editor";

type Props = {
  demo?: boolean;
  initialPhase?: Phase;
  initialObjects?: CanvasObj[];
  initialPageSize?: { width: number; height: number };
  preferMode?: EditorMode | "auto";
};

export function EditorApp({
  demo = false,
  initialPhase = "upload",
  initialObjects,
  initialPageSize,
  preferMode = "auto",
}: Props) {
  const { mode, setMode } = useEditorMode(preferMode);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<PreflightReport | null>(null);
  const { state: preflightState, run: runPreflight } = usePreflight();

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
      style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#120a04" }}
    >
      <header
        style={{
          padding: "0.6rem 0.85rem",
          background: "#1a0f08",
          borderBottom: "1px solid #3d1a00",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          gap: "0.6rem",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600, color: "#fc5102" }}>
          artworkPDF
          {demo && (
            <span
              style={{
                marginLeft: "0.5rem",
                fontSize: "0.65rem",
                background: "#2a1200",
                border: "1px solid #fc5102",
                color: "#fc5102",
                padding: "0.1rem 0.35rem",
                borderRadius: 3,
                verticalAlign: "middle",
                letterSpacing: "0.08em",
              }}
            >
              DEMO
            </span>
          )}
        </span>
        {file && (
          <span style={{ fontSize: "0.8rem", color: "#888" }}>{file.name}</span>
        )}
        <div
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.75rem" }}
        >
          {phase === "editor" && <ModeToggle mode={mode} onChange={setMode} />}
          {phase !== "upload" && (
            <button
              type="button"
              onClick={() => {
                setPhase("upload");
                setFile(null);
                setReport(null);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#666",
                cursor: "pointer",
                fontSize: "0.8rem",
              }}
            >
              New file
            </button>
          )}
          {phase === "editor" && !demo && (
            <a
              href="/source"
              style={{ fontSize: "0.75rem", color: "#555" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              Source (AGPL-3.0)
            </a>
          )}
          {demo && (
            <a
              href="/"
              style={{
                fontSize: "0.8rem",
                color: "#fc5102",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              ← Home
            </a>
          )}
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {phase === "upload" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem" }}>
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
          <p style={{ color: "#e8a87c" }}>Running preflight checks&hellip;</p>
        )}

        {phase === "preflight" && report && (
          <PreflightPanel
            report={report}
            onProceed={() => setPhase("editor")}
            onSendToLint={handleSendToLint}
          />
        )}

        {phase === "editor" && (
          <EditorCanvas
            file={file}
            report={report}
            demo={demo}
            mode={mode}
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
