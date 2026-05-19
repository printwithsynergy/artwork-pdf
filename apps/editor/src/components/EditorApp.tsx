// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import type { PreflightReport } from "@artworkpdf/document-model";
import { useState } from "react";
import { usePreflight } from "../hooks/usePreflight.js";
import { EditorCanvas } from "./EditorCanvas";
import { FileDropZone } from "./FileDropZone";
import { PreflightPanel } from "./PreflightPanel";

type Phase = "upload" | "checking" | "preflight" | "editor";

export function EditorApp() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<PreflightReport | null>(null);
  const { state: preflightState, run: runPreflight } = usePreflight();

  async function handleFile(f: File) {
    setFile(f);
    setPhase("checking");
    const r = await runPreflight(f);
    if (r) {
      setReport(r);
      setPhase("preflight");
    } else {
      setPhase("upload");
    }
  }

  function handleSendToLint() {
    // TODO: enqueue job with lint-only workflow via synergy client
    alert("Job queued for lint node analysis.");
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#120a04" }}>
      <header style={{
        padding: "0.75rem 1rem",
        background: "#1a0f08",
        borderBottom: "1px solid #3d1a00",
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, color: "#fc5102" }}>artworkPDF</span>
        {file && (
          <span style={{ marginLeft: "1rem", fontSize: "0.8rem", color: "#888" }}>
            {file.name}
          </span>
        )}
        {phase !== "upload" && (
          <button
            type="button"
            onClick={() => { setPhase("upload"); setFile(null); setReport(null); }}
            style={{
              marginLeft: "auto",
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
        {phase === "editor" && (
          <a
            href="/source"
            style={{ marginLeft: phase !== "upload" ? "1rem" : "auto", fontSize: "0.75rem", color: "#555" }}
            target="_blank"
            rel="noopener noreferrer"
          >
            Source (AGPL-3.0)
          </a>
        )}
      </header>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {phase === "upload" && <FileDropZone onFile={handleFile} />}

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

        {phase === "editor" && <EditorCanvas />}
      </div>

      {preflightState.phase === "error" && (
        <div style={{
          position: "fixed", bottom: "1rem", left: "50%", transform: "translateX(-50%)",
          background: "#f44336", color: "#fff", padding: "0.5rem 1rem", borderRadius: 4,
          fontSize: "0.82rem",
        }}>
          {preflightState.message}
        </div>
      )}
    </main>
  );
}
