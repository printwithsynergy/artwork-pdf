// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DocumentModel } from "@artworkpdf/document-model";
import { eq } from "drizzle-orm";
import type { Job } from "pg-boss";
import type { CompilePdfClient } from "../compile-pdf-client.js";
import { getDb } from "../db/client.js";
import { jobs } from "../db/schema.js";

type RenderJobData = Record<string, unknown> & {
  dbJobId?: string;
  document?: DocumentModel;
};

export function makeRenderJob(
  client: CompilePdfClient,
): (batch: Job<Record<string, unknown>>[]) => Promise<void> {
  return async (batch) => {
    for (const job of batch) {
      const { dbJobId, document } = job.data as RenderJobData;
      const db = getDb();

      try {
        if (!document) {
          throw new Error("render job missing 'document' field");
        }

        const { bytes, cacheKey } = await client.compose(document);
        const result = {
          format: "pdf-x4",
          pdfBase64: Buffer.from(bytes).toString("base64"),
          filename: "artwork.pdf",
          cacheKey,
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
  };
}
