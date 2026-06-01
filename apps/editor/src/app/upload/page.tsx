// SPDX-License-Identifier: AGPL-3.0-or-later
//
// `/upload` — full editor route for authenticated/self-hosted use.
//
// Mounts `EditorApp` with no demo flag, no initial dieline seed —
// `EditorApp` boots in its `"upload"` phase, prompting the user to
// drop a PDF/image. Hosts that want to skip the upload step should
// pass `initialPhase="editor"` (see /demo for an example).

import { EditorApp } from "@printwithsynergy/artwork-pdf-editor";

export const metadata = {
  title: "artworkPDF — Upload artwork",
  description: "Upload a PDF or image to preflight and edit.",
};

export default function UploadPage() {
  return <EditorApp />;
}
