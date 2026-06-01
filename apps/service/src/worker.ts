// SPDX-License-Identifier: AGPL-3.0-or-later
import { CompilePdfClient } from "./compile-pdf-client.js";
import { getBoss } from "./db/boss.js";
import { makeRenderJob } from "./handlers/render.js";

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

  const renderJob = makeRenderJob(new CompilePdfClient());
  await boss.work<Record<string, unknown>>("artwork.render", renderJob);
  await boss.work<Record<string, unknown>>("artwork.thumbnail", renderJob);
  await boss.work<Record<string, unknown>>("artwork.preview-separations", renderJob);
  console.log("artworkPDF worker started — listening on artwork.* queues");
}
