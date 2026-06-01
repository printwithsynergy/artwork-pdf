// SPDX-License-Identifier: AGPL-3.0-or-later
//
// `@artworkpdf/compose` — the compose-producer renderer.
//
// Public surface:
//
// - {@link composeDocument} — DocumentV3 (or v2, auto-migrated) →
//   PDF bytes. Currently a geometry skeleton: it emits one blank
//   PDF page per `PageV3` at the correct size. Layer drawing,
//   separation colorspaces, dieline overlay, and flexo distortion
//   compensation land in follow-up PRs that won't change this API.
// - {@link toPoints} — length unit → PDF point conversion shared by
//   compose and downstream marks/imposition passes.
//
// Consumers: apps/service's render handler routes through compile-pdf
// for now; this package is the reference implementation for the
// compose producer (mirrors the FastAPI `/v1/compose/apply` route).

export { composeDocument } from "./compose.js";
export { toPoints } from "./units.js";
