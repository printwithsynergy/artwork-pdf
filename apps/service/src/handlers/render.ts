// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Job } from "pg-boss";
import { renderDocument } from "@artworkpdf/pdf-writer";

export async function renderJob(job: Job<Record<string, unknown>>) {
  // TODO: full render pipeline
  await renderDocument(job.data);
}
