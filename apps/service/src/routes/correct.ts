// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from "node:crypto";
import {
  applyCorrections,
  CORRECTION_OPS,
  CORRECTION_SCHEMA_VERSION,
  type CorrectionOp,
  CorrectionError,
} from "@artworkpdf/document-model";
import { Hono } from "hono";
import { badRequest, conflict, unprocessable } from "../problemDetails.js";

/**
 * `/v1/correct` — the headless deterministic document-correction API.
 *
 * This is the surface synergy drives to apply **deterministic corrections**
 * to an artwork document (the `atlas`/`lint`-style "auto-fix" lane in node
 * form): set bleed, normalize an ink name, force black overprint, drop a
 * stray separation, hide a layer, set the color profile. It is the
 * **intent** half of the artwork ↔ compile boundary — it returns a
 * corrected {@link import("@artworkpdf/document-model").DocumentV3}, never a
 * PDF and never a pass/fail policy verdict (those stay in compile-pdf and
 * lint-pdf respectively).
 *
 * Determinism contract: identical `(document, operations)` in →
 * byte-identical corrected document + `contentHash` out. The hash is a
 * `sha256:<hex>` content address over a canonical (sorted-key) JSON
 * encoding, so a synergy correction node can cache on it. The endpoint is
 * pure: no DB writes, no queue, no wall-clock in the response — a single
 * synchronous request/response so synergy gets a deterministic answer in
 * one call (unlike the async `/jobs` render lane).
 *
 * Error semantics (RFC 7807):
 * - `400 bad-request` — the body isn't `{ document, operations: [...] }`,
 *   or an op is missing its `op` discriminator / uses an unknown one.
 * - `422 unprocessable-entity` — an op is well-formed but invalid (bad
 *   field value) or targets a missing page/layer/separation. Carries a
 *   `pointer` (e.g. `operations/2/bleedMm`) + `code`.
 * - `409 conflict` — an op conflicts with current state (e.g. a rename
 *   onto an existing distinct ink). Carries `pointer` + `code`.
 *
 * The endpoint is mounted under the auth-guarded `/v1/correct` base (see
 * `index.ts`) since it accepts tenant document content.
 */
export const correctRouter = new Hono();

/** Request body shape for `POST /v1/correct`. */
type CorrectRequest = {
  document?: unknown;
  operations?: unknown;
};

correctRouter.post("/", async (c) => {
  let body: CorrectRequest;
  try {
    body = await c.req.json<CorrectRequest>();
  } catch {
    return badRequest(c, "Request body must be valid JSON.");
  }

  if (body === null || typeof body !== "object") {
    return badRequest(c, "Request body must be a JSON object.");
  }
  if (body.document === null || typeof body.document !== "object") {
    return badRequest(c, "Field 'document' is required and must be an object.");
  }
  if (!Array.isArray(body.operations)) {
    return badRequest(c, "Field 'operations' is required and must be an array.");
  }

  // Validate each op's discriminator up front so a bad `op` is a clean
  // 400 (structural error) rather than reaching the engine's
  // defend-in-depth `invalid_operation` throw. Field-level validation
  // (types, ranges) is the engine's job and maps to 422.
  for (let i = 0; i < body.operations.length; i++) {
    const op = body.operations[i] as { op?: unknown };
    if (op === null || typeof op !== "object" || typeof op.op !== "string") {
      return badRequest(c, `operations/${i} must be an object with a string 'op' field.`);
    }
    if (!(CORRECTION_OPS as readonly string[]).includes(op.op)) {
      return badRequest(
        c,
        `operations/${i} has unknown op "${op.op}". Known ops: ${CORRECTION_OPS.join(", ")}.`,
      );
    }
  }

  try {
    const result = applyCorrections(
      body.document as Parameters<typeof applyCorrections>[0],
      body.operations as CorrectionOp[],
      { sha256: (input) => createHash("sha256").update(input).digest("hex") },
    );
    return c.json({
      document: result.document,
      applied: result.applied,
      contentHash: result.contentHash,
      schemaVersion: result.schemaVersion,
    });
  } catch (err) {
    if (err instanceof CorrectionError) {
      const extensions = { code: err.code, pointer: err.pointer };
      if (err.code === "conflict") return conflict(c, err.message, extensions);
      // invalid_operation / target_not_found / invalid_document → 422.
      return unprocessable(c, err.message, extensions);
    }
    throw err; // unexpected → app.onError → 500
  }
});

/**
 * Static descriptor for the correction surface — folded into
 * `/v1/contract` so synergy can discover the op vocabulary + schema
 * version without a probe request.
 */
export const CORRECTION_CONTRACT = {
  endpoint: "POST /v1/correct",
  schemaVersion: CORRECTION_SCHEMA_VERSION,
  operations: CORRECTION_OPS,
} as const;
