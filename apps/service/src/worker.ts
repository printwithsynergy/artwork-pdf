// SPDX-License-Identifier: AGPL-3.0-or-later
import { CompilePdfClient } from "./compile-pdf-client.js";
import { getBoss } from "./db/boss.js";
import { makeRenderJob } from "./handlers/render.js";

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
