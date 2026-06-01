// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Compose-producer entry point. Takes a `DocumentModel` (v2) or
// `DocumentV3` and emits PDF bytes via pdf-lib.
//
// Current state: geometry skeleton. Emits one blank PDF page per
// `PageV3` at the correct size (unit-aware). Layer drawing,
// separation color spaces, dieline overlay, and flexo distortion
// compensation land in follow-up PRs without changing this API.

import { type DocumentModel, type DocumentV3, ensureV3 } from "@artworkpdf/document-model";
import { PDFDocument } from "pdf-lib";
import { toPoints } from "./units.js";

/**
 * Render a document to PDF bytes.
 *
 * Accepts either v2 or v3 — v2 documents are auto-lifted via
 * `ensureV3` so ingress points (apps/service render handler, host
 * integrations) can call this without first migrating their stored
 * documents.
 *
 * Each `PageV3` becomes one PDF page at `width × height` in the
 * page's declared unit, converted to PDF points via {@link toPoints}.
 * The returned `Uint8Array` is the encoded PDF; callers handle the
 * IO boundary (HTTP response body, file write, base64-encode for
 * the queue result, etc.).
 */
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
