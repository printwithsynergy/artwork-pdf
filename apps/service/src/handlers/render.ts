// SPDX-License-Identifier: AGPL-3.0-or-later
import { composeDocument } from "@artworkpdf/compose";
import type {
  DocumentModel,
  ImposeTemplate,
  MarksPlan,
  TrapPolicy,
} from "@artworkpdf/document-model";
import { eq } from "drizzle-orm";
import type { Job } from "pg-boss";
import { CodexClient, type CodexFinding } from "../codex-client.js";
import type { CompilePdfClient } from "../compile-pdf-client.js";
import { getDb } from "../db/client.js";
import { jobs } from "../db/schema.js";

/**
 * pg-boss job payload for the `artwork.render` / `artwork.thumbnail` /
 * `artwork.preview-separations` queues.
 *
 * - `document` is the {@link DocumentModel} to compose. Required at
 *   runtime even though typed as optional — the handler rejects jobs
 *   that omit it.
 * - `dbJobId` correlates the pg-boss job back to a row in the `jobs`
 *   table (inserted by `POST /jobs`). When present, the handler
 *   writes `status: done | failed` and the result/error back to that
 *   row on completion.
 * - `marksTemplate` / `trapPolicy` / `imposeTemplate` request the
 *   corresponding producers downstream of compose. Absent fields
 *   skip the producer; present fields chain in declaration order:
 *   compose → marks → trap → impose.
 *
 * Producers (the `/jobs` route, the synergy engine worker) put the
 * caller's full submit request on the queue spread into this shape.
 */
type RenderJobData = Record<string, unknown> & {
  dbJobId?: string;
  document?: DocumentModel;
  marksTemplate?: MarksPlan;
  trapPolicy?: TrapPolicy;
  imposeTemplate?: ImposeTemplate;
};

/**
 * Build the pg-boss batch handler for artwork render queues.
 *
 * Returns a function with the `(batch) => Promise<void>` signature
 * pg-boss `work()` expects. The handler iterates the batch and, per
 * job, runs the producer chain (compose → marks → trap → impose,
 * conditional on the corresponding request fields), then writes the
 * base64-encoded final PDF + the *last producer's* lineage cache key
 * to the correlated `jobs` row (if a DB is configured and `dbJobId`
 * is set).
 *
 * **Cache-key threading:** the `cacheKey` written to the host is
 * the *last wire producer's* lineage key — marks's if marks ran
 * last, impose's when impose ran last, etc. **Compose-only runs**
 * (no marks / trap / impose field on the request) leave `cacheKey`
 * as an empty string `""` because compose now runs in-process via
 * `@artworkpdf/compose` and has no Lineage backend to issue a key.
 * Downstream consumers must not assume a compose cache entry
 * exists for those rows; a real key materializes the moment a
 * wire producer chains onto compose's output.
 *
 * Error handling is per-job and intentionally swallowing: a single
 * failure does not abort the batch — pg-boss expects no throw, so we
 * log the failure, write `status: "failed"` to the DB row, and move
 * on to the next job. The same handler is registered against three
 * queues (render, thumbnail, preview-separations); the producer
 * chain covers all three.
 *
 * `client` is taken as a parameter (rather than module-level) so
 * tests can inject a stub via {@link CompilePdfClient}'s `fetch`
 * seam without a running compile-pdf instance.
 */
export function makeRenderJob(
  client: CompilePdfClient,
  codexClient: CodexClient = new CodexClient(),
): (batch: Job<Record<string, unknown>>[]) => Promise<void> {
  return async (batch) => {
    for (const job of batch) {
      const { dbJobId, document, marksTemplate, trapPolicy, imposeTemplate } =
        job.data as RenderJobData;
      const db = getDb();

      try {
        if (!document) {
          throw new Error("render job missing 'document' field");
        }

        // Chain: compose → marks → trap → impose. Each step only
        // runs when its request field is present; absent fields fall
        // through with the previous step's output unchanged.
        //
        // Compose runs in-process via `@artworkpdf/compose` — the
        // reference TypeScript implementation. Marks / trap / impose
        // still cross the wire to compile-pdf because those producers
        // ship Python-only engines today. When compile-pdf grows a
        // `/v1/compose/apply` endpoint we can flip the local call
        // back to `client.compose(document)` without changing the
        // chain shape.
        const composed = await composeDocument(document);
        let bytes: ArrayBuffer = composed.buffer.slice(
          composed.byteOffset,
          composed.byteOffset + composed.byteLength,
        ) as ArrayBuffer;
        // Local compose has no producer cache — initial cacheKey is
        // empty until the first wire-call producer overwrites it.
        // Downstream consumers that depend on cacheKey identity get
        // a stable empty string for compose-only runs (deterministic
        // input → deterministic empty key) and a real key the moment
        // a wire producer chains onto it.
        let cacheKey = "";

        if (marksTemplate) {
          ({ bytes, cacheKey } = await client.marks(marksTemplate, bytes));
        }
        if (trapPolicy) {
          ({ bytes, cacheKey } = await client.trap(trapPolicy, bytes));
        }
        if (imposeTemplate) {
          ({ bytes, cacheKey } = await client.impose(imposeTemplate, bytes));
        }

        // After render, extract located findings from the produced PDF via
        // codex — the ecosystem-canonical `CodexFinding[]` (1-indexed page +
        // PDF-point bbox), which hosts feed straight to lens-pdf's
        // `fromCodexFindings()`. Service-skip: an unwired or failing codex must
        // degrade to "no findings", never fail the writer path.
        let codexFindings: CodexFinding[] = [];
        if (codexClient.isConfigured()) {
          try {
            codexFindings = await codexClient.extractFindings(bytes);
          } catch (err) {
            const reason = err instanceof Error ? err.message : "codex extract failed";
            console.warn(`codex findings extraction failed for job ${job.id}: ${reason}`);
          }
        }

        const result = {
          format: "pdf-x4",
          pdfBase64: Buffer.from(bytes).toString("base64"),
          filename: "artwork.pdf",
          cacheKey,
          codexFindings,
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
