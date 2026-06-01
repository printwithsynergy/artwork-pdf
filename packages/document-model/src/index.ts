// SPDX-License-Identifier: AGPL-3.0-or-later
//
// `@artworkpdf/document-model` — the canonical TypeScript schema for
// artworkPDF documents, separations, layers, preflight, and the v2/v3
// migration.
//
// Public surface (everything re-exported below is part of the wire
// contract consumed by the editor, apps/service, and compile-pdf):
//
// - {@link "./extended"} — v2 DocumentModel + Illustrator-grade
//   authoring primitives (gradients, blend modes, effects, paths,
//   typography, dieline templates, graphic styles, view state).
// - {@link "./v3"} — pages-first canonical v3 wire shape.
// - {@link "./migrate"} — `upgradeV2ToV3`, `isV3`, `ensureV3`.
// - {@link "./preflight"} — preflight rule/issue/report types and
//   `DEFAULT_PREFLIGHT_RULES`.

export * from "./preflight.js";
export * from "./extended.js";
export * from "./v3.js";
export * from "./migrate.js";
