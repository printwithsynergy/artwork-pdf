// SPDX-License-Identifier: AGPL-3.0-or-later
import { EditorApp } from "../../components/EditorApp";

export const metadata = {
  title: "artworkPDF — Demo Editor",
  description: "Try the artworkPDF canvas editor — no account required.",
};

export default function DemoPage() {
  return <EditorApp demo initialPhase="editor" />;
}
