// SPDX-License-Identifier: AGPL-3.0-or-later
//
// v2 → v3 document migration.
//
// Pure, deterministic, and structurally independent of the input:
// array/object mutations on the result do not reach back into the
// source v2 document (every array and nested object is cloned at
// the leaf). Ingress points (apps/service render handler,
// compile-pdf compose producer, host integrations) should call
// `ensureV3()` for any incoming document before downstream code
// that only speaks v3.

import type { DocumentModel } from "./extended.js";
import type { DocumentV3, PageV3 } from "./v3.js";

/**
 * Lift a v2 {@link DocumentModel} into a single-page {@link DocumentV3}.
 *
 * A v2 document is by construction single-page (flat `layers` plus
 * doc-level dimensions), so the migration always emits exactly one
 * page with the stable id `"page-1"`. Multi-page documents must be
 * authored as v3 directly — there is no v2 shape that carries
 * multiple pages.
 *
 * `bleedMm` is set to `0` because v2 did not carry bleed at the
 * document level. Hosts that need a non-zero bleed after migration
 * should patch it on the returned page.
 */
export function upgradeV2ToV3(doc: DocumentModel): DocumentV3 {
  const page: PageV3 = {
    id: "page-1",
    width: doc.width,
    height: doc.height,
    unit: doc.unit,
    bleedMm: 0,
    separations: [...doc.separations],
    layers: [...doc.layers],
    ...(doc.dielineTemplateId ? { dielineTemplateId: doc.dielineTemplateId } : {}),
    ...(doc.flexoDistortion ? { flexoDistortion: { ...doc.flexoDistortion } } : {}),
  };

  return {
    version: "3",
    pages: [page],
    ...(doc.swatches ? { swatches: [...doc.swatches] } : {}),
    ...(doc.graphicStyles ? { graphicStyles: [...doc.graphicStyles] } : {}),
    ...(doc.variableData ? { variableData: { ...doc.variableData } } : {}),
  };
}

/**
 * Discriminator narrowing: returns true iff `doc` is a v3 document.
 *
 * Use as a TypeScript type guard:
 *
 * ```ts
 * if (isV3(doc)) {
 *   doc.pages.forEach(...);  // narrowed to DocumentV3
 * }
 * ```
 */
export function isV3(doc: DocumentModel | DocumentV3): doc is DocumentV3 {
  return doc.version === "3";
}

/**
 * Idempotent v3 coercion — pass through if already v3, else migrate.
 *
 * Cheap when already v3 (single discriminator check, no allocation).
 * The canonical "always speak v3" boundary helper for HTTP ingress
 * points and producers.
 */
export function ensureV3(doc: DocumentModel | DocumentV3): DocumentV3 {
  return isV3(doc) ? doc : upgradeV2ToV3(doc);
}
