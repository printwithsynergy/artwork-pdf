// SPDX-License-Identifier: AGPL-3.0-or-later
import { EditorApp } from "@artworkpdf/editor-app";

export const metadata = {
  title: "artworkPDF — Upload artwork",
  description: "Upload a PDF or image to preflight and edit.",
};

export default function UploadPage() {
  return <EditorApp />;
}
