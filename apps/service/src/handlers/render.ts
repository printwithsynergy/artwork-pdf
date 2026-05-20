// SPDX-License-Identifier: AGPL-3.0-or-later
import { renderDocument } from "@artworkpdf/pdf-writer";
import { eq } from "drizzle-orm";
import type { Job } from "pg-boss";
import { getDb } from "../db/client.js";
import { jobs } from "../db/schema.js";

export async function renderJob(batch: Job<Record<string, unknown>>[]): Promise<void> {
  for (const job of batch) {
    const { dbJobId, ...data } = job.data as Record<string, unknown> & { dbJobId?: string };
    const db = getDb();

    try {
      const pdfBuffer = await renderDocument(data);
      const result = {
        format: "pdf-x4",
        pdfBase64: pdfBuffer.toString("base64"),
        filename: "artwork.pdf",
      };

      if (db && dbJobId) {
        await db
          .update(jobs)
          .set({ status: "done", result, updatedAt: new Date() })
          .where(eq(jobs.id, dbJobId));
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : "render failed";
      console.error(`render job ${job.id} failed:`, error);

      if (db && dbJobId) {
        await db
          .update(jobs)
          .set({ status: "failed", result: { error }, updatedAt: new Date() })
          .where(eq(jobs.id, dbJobId));
      }
    }
  }
}
