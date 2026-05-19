// SPDX-License-Identifier: AGPL-3.0-or-later
import { EditorCanvas } from "../components/EditorCanvas.js";

export default function HomePage() {
  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header style={{ padding: "0.75rem 1rem", background: "#1a0f08", borderBottom: "1px solid #3d1a00" }}>
        <span style={{ fontWeight: 600, color: "var(--color-brand-400)" }}>artworkPDF</span>
        <a
          href="/source"
          style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#888", float: "right" }}
          target="_blank"
          rel="noopener noreferrer"
        >
          Source (AGPL-3.0)
        </a>
      </header>
      <EditorCanvas />
    </main>
  );
}
