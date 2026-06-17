// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";
import { CORRECTION_CONTRACT } from "./correct.js";

/**
 * Contract descriptor — `GET /v1/contract`.
 *
 * Completes the org `/healthz` + `/readyz` + `/v1/contract` convention
 * for the artwork-pdf service. Machine-readable surface descriptor: the
 * service version, the `artwork.*` capabilities (each with the
 * `output.format` that selects its render queue), the job endpoints
 * a caller integrates against (submit → poll → fetch result), and the
 * synchronous deterministic-correction surface (`correction`) synergy
 * drives for auto-fix. No auth — synergy/platform poll it unauthenticated
 * to discover the surface, same as `/healthz` + `/readyz`.
 *
 * Keep the capability list in sync with `worker.ts`'s registered queues
 * and `/.well-known/synergy-node.json` — if you add an `artwork.foo`
 * queue, add it in all three places. The `correction` block's op
 * vocabulary + schema version come straight from
 * {@link CORRECTION_CONTRACT} so they can't drift from the engine.
 */
export const contractRouter = new Hono();

/** Service version, surfaced in `/v1/contract` (mirrors `/healthz`). */
const SERVICE_VERSION = process.env.npm_package_version ?? "0.0.0";

contractRouter.get("/contract", (c) => {
  return c.json({
    service: "artwork-pdf",
    version: SERVICE_VERSION,
    capabilities: [
      { type: "artwork.render", outputFormat: "pdf-x4" },
      { type: "artwork.thumbnail", outputFormat: "thumbnail" },
      { type: "artwork.preview-separations", outputFormat: "preview-separations" },
      { type: "artwork.correct", outputFormat: "document" },
    ],
    endpoints: {
      submit: "POST /jobs",
      status: "GET /jobs/:id",
      result: "GET /jobs/:id/result",
      correct: "POST /v1/correct",
    },
    correction: CORRECTION_CONTRACT,
  });
});
