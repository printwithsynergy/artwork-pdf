// SPDX-License-Identifier: AGPL-3.0-or-later
import { CodexClient } from "./codex-client.js";
import { CompilePdfClient } from "./compile-pdf-client.js";
import { getBoss } from "./db/boss.js";
import { makeRenderJob } from "./handlers/render.js";

/**
 * The pg-boss queues the render handler serves. `POST /jobs` routes a submit to
 * exactly one of these by `output.format`. Exported so the submit route can
 * `createQueue` its target before `send` (pg-boss v10+ rejects sends to a queue
 * that doesn't exist yet).
 */
export const ARTWORK_QUEUES = [
  "artwork.render",
  "artwork.thumbnail",
  "artwork.preview-separations",
] as const;

/**
 * Boot the artwork-pdf pg-boss worker.
 *
 * Constructs a single shared {@link CompilePdfClient} and registers
 * the same render handler against three queues:
 *
 * - `artwork.render` — compose a `DocumentModel` to PDF/X-4
 * - `artwork.thumbnail` — rasterize a preview
 * - `artwork.preview-separations` — emit per-separation PNGs
 *
 * All three currently route through compile-pdf's `compose` producer;
 * the queue split exists so the synergy engine can prioritize render
 * vs. thumbnail batches independently and so future producers
 * (thumbnail-specific, separations-specific) can attach without a
 * queue migration.
 *
 * Resolves with no-op (warning logged) when `DATABASE_URL` is unset —
 * apps/service can boot HTTP-only in environments without a database
 * for `/healthz` and synergy-node descriptor checks.
 */
export async function startWorker(): Promise<void> {
  const boss = await getBoss();
  if (!boss) {
    console.warn("DATABASE_URL not set — worker disabled");
    return;
  }

  // Codex runs after render to emit CodexFinding[]; unconfigured (no
  // CODEX_API_BASE_URL) → the handler self-skips findings.
  const renderJob = makeRenderJob(new CompilePdfClient(), new CodexClient());
  // pg-boss v10+ requires a queue to exist before work()/send(); create them
  // up front (idempotent) so a fresh database doesn't crash the worker.
  for (const queue of ARTWORK_QUEUES) {
    await boss.createQueue(queue);
    await boss.work<Record<string, unknown>>(queue, renderJob);
  }
  console.log("artworkPDF worker started — listening on artwork.* queues");
}
