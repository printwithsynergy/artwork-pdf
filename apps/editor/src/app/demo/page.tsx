// SPDX-License-Identifier: AGPL-3.0-or-later
import { EditorApp } from "../../components/EditorApp";
import type { CanvasObj } from "../../components/EditorCanvas";

export const metadata = {
  title: "artworkPDF — Demo Editor",
  description:
    "Try the artworkPDF canvas editor on a stand-up pouch dieline — no account required.",
};

// Stand-Up Pouch 4×6 from the dieline library — 1 mm ≈ 2.83465 pt.
// Page: 107.6 × 158.4 mm (with 3 mm bleed) → 305 × 449 pt.
// Trim box: at (3, 3) mm with size 101.6 × 152.4 mm → at (8.5, 8.5) pt, size 288 × 432 pt.
const DEMO_PAGE = { width: 305, height: 449 };

const DEMO_DIELINE: CanvasObj[] = [
  {
    id: "demo-dieline-trim",
    type: "rect",
    x: 8.5,
    y: 8.5,
    width: 288,
    height: 432,
    fill: "transparent",
    stroke: "#fc5102",
    strokeWidth: 1,
    opacity: 1,
  },
  {
    id: "demo-label-title",
    type: "text",
    x: 30,
    y: 80,
    width: 250,
    height: 40,
    fill: "#1a0a00",
    stroke: "transparent",
    strokeWidth: 0,
    opacity: 1,
    text: "Stand-Up Pouch 4×6",
    fontSize: 22,
  },
  {
    id: "demo-label-hint",
    type: "text",
    x: 30,
    y: 120,
    width: 250,
    height: 30,
    fill: "#666",
    stroke: "transparent",
    strokeWidth: 0,
    opacity: 1,
    text: "Drag, draw, or import to start your artwork. The orange box is the trim/dieline.",
    fontSize: 11,
  },
];

export default function DemoPage() {
  return (
    <EditorApp
      demo
      initialPhase="editor"
      initialObjects={DEMO_DIELINE}
      initialPageSize={DEMO_PAGE}
    />
  );
}
