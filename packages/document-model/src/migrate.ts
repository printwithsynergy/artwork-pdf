// SPDX-License-Identifier: AGPL-3.0-or-later
// v2 → v3 document migration. Pure, deterministic, side-effect-free.
// Ingress points (apps/service render handler, compile-pdf compose producer,
// host integrations) should call this for any v2 document before downstream
// consumers that only speak v3.

import type { DocumentModel } from "./extended.js";
import type { DocumentV3, PageV3 } from "./v3.js";

export function upgradeV2ToV3(doc: DocumentModel): DocumentV3 {
  const page: PageV3 = {
    id: "page-1",
    width: doc.width,
    height: doc.height,
    unit: doc.unit,
    bleedMm: 0,
    separations: doc.separations,
    layers: doc.layers,
    ...(doc.dielineTemplateId ? { dielineTemplateId: doc.dielineTemplateId } : {}),
    ...(doc.flexoDistortion ? { flexoDistortion: doc.flexoDistortion } : {}),
  };

  return {
    version: "3",
    pages: [page],
    ...(doc.swatches ? { swatches: doc.swatches } : {}),
    ...(doc.graphicStyles ? { graphicStyles: doc.graphicStyles } : {}),
    ...(doc.variableData ? { variableData: doc.variableData } : {}),
  };
}

export function isV3(
  doc: DocumentModel | DocumentV3,
): doc is DocumentV3 {
  return doc.version === "3";
}

export function ensureV3(
  doc: DocumentModel | DocumentV3,
): DocumentV3 {
  return isV3(doc) ? doc : upgradeV2ToV3(doc);
}
