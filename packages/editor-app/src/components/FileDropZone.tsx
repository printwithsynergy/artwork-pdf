// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { type Dieline, parseARD, parseCF2, parseDDES } from "@artworkpdf/dieline-parser";
import { useCallback, useRef, useState } from "react";

type Props = {
  /** Called when a PDF or raster image is dropped — the existing
   *  preflight → editor flow takes over. */
  onFile: (file: File) => void;
  /** Called when a structural dieline file (CF2 / DDES / ARD) is
   *  dropped. Hosts that want to bypass preflight and seed the
   *  canvas directly from the parsed `Dieline` should provide this.
   *  Absent → dieline files are rejected. */
  onDieline?: (dieline: Dieline) => void;
};

/**
 * Detect which dieline-parser to invoke for a given filename.
 * Returns `null` for non-dieline files (caller falls back to the
 * normal PDF / image path).
 */
function dielineParserFor(name: string): ((text: string) => Dieline) | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".cf2")) return parseCF2;
  if (lower.endsWith(".ddes")) return parseDDES;
  if (lower.endsWith(".ard")) return parseARD;
  return null;
}

export function FileDropZone({ onFile, onDieline }: Props) {
  const [dragging, setDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    async (file: File) => {
      setParseError(null);
      // Try the dieline-parser path first — these formats are
      // text-based ASCII; we read as text and route to the matching
      // parser. PDF / image still flows through the legacy `onFile`
      // → preflight path.
      const dielineParser = dielineParserFor(file.name);
      if (dielineParser) {
        if (!onDieline) {
          setParseError("Dieline files aren't supported by this editor instance.");
          return;
        }
        try {
          const text = await file.text();
          const dieline = dielineParser(text);
          if (dieline.paths.length === 0) {
            setParseError(`${file.name}: no recognizable paths in this dieline file.`);
            return;
          }
          onDieline(dieline);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setParseError(`${file.name}: ${msg}`);
        }
        return;
      }

      if (
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf") ||
        file.type.startsWith("image/")
      ) {
        onFile(file);
      }
    },
    [onFile, onDieline],
  );

  return (
    <button
      type="button"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handle(file);
      }}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? "#fc5102" : "#3d1a00"}`,
        borderRadius: 12,
        padding: "3rem 2rem",
        textAlign: "center",
        cursor: "pointer",
        background: dragging ? "rgba(252,81,2,0.05)" : "transparent",
        transition: "border-color 0.15s, background 0.15s",
        maxWidth: 480,
        width: "100%",
        fontFamily: "inherit",
        display: "block",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.cf2,.ddes,.ard,image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handle(file);
        }}
      />
      <span
        style={{
          display: "block",
          color: "#e8a87c",
          fontWeight: 600,
          marginBottom: "0.5rem",
          fontSize: "1rem",
        }}
      >
        Drop artwork or dieline file here
      </span>
      <span style={{ display: "block", color: "#666", fontSize: "0.82rem" }}>
        PDF / raster image (runs preflight) — or CF2 / DDES / ARD (seeds the canvas directly)
      </span>
      {parseError && (
        <span
          style={{
            display: "block",
            color: "#ef4444",
            marginTop: "0.65rem",
            fontSize: "0.8rem",
          }}
        >
          {parseError}
        </span>
      )}
    </button>
  );
}
