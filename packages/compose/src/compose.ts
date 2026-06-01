// SPDX-License-Identifier: AGPL-3.0-or-later
// Compose-producer entry point. Takes a DocumentModel (v2) or DocumentV3 and
// emits PDF bytes. This skeleton renders one blank PDF page per PageV3 at the
// correct geometry (page size in points, accounting for unit). Layer drawing,
// separation color spaces, dieline overlay, and flexo distortion compensation
// land in follow-up PRs that consumers can adopt without changing the API.
//
// The function accepts either shape — v2 documents are lifted via ensureV3 so
// ingress points (apps/service render handler, host integrations) can call
// this without first migrating their stored documents.

import { type DocumentModel, type DocumentV3, ensureV3 } from "@artworkpdf/document-model";
import { PDFDocument } from "pdf-lib";
import { toPoints } from "./units.js";

export async function composeDocument(doc: DocumentModel | DocumentV3): Promise<Uint8Array> {
  const v3 = ensureV3(doc);
  const pdf = await PDFDocument.create();

  for (const page of v3.pages) {
    const widthPt = toPoints(page.width, page.unit);
    const heightPt = toPoints(page.height, page.unit);
    pdf.addPage([widthPt, heightPt]);
  }

  return pdf.save();
}
