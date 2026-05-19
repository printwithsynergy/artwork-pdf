// SPDX-License-Identifier: AGPL-3.0-or-later
import { renderDocument } from "@artworkpdf/pdf-writer";
import type { Job } from "pg-boss";

export async function renderJob(job: Job<Record<string, unknown>>): Promise<void> {
  await renderDocument(job.data);
}
