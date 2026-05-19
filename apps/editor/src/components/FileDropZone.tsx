// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { useCallback, useRef, useState } from "react";

type Props = {
  onFile: (file: File) => void;
};

export function FileDropZone({ onFile }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (file: File) => {
      if (
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf") ||
        file.type.startsWith("image/")
      ) {
        onFile(file);
      }
    },
    [onFile],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
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
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handle(file);
        }}
      />
      <p style={{ color: "#e8a87c", fontWeight: 600, margin: "0 0 0.5rem", fontSize: "1rem" }}>
        Drop artwork file here
      </p>
      <p style={{ color: "#666", margin: 0, fontSize: "0.82rem" }}>
        PDF or raster image &mdash; preflight checks run before the canvas opens
      </p>
    </div>
  );
}
