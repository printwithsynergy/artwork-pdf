// SPDX-License-Identifier: AGPL-3.0-or-later
import type { JobSubmitRequest } from "@artworkpdf/document-model";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getBoss } from "../db/boss.js";
import { getDb } from "../db/client.js";
import { jobs } from "../db/schema.js";

/**
 * `/jobs` — the render-orchestration HTTP surface.
 *
 * Four endpoints make up the job lifecycle:
 *
 * - `POST /jobs` — submit a {@link JobSubmitRequest}; returns
 *   `202 { id, status: "queued" }`. Inserts a `jobs` row and enqueues
 *   onto the queue matching `output.format`
 *   (`thumbnail` → `artwork.thumbnail`,
 *    `preview-separations` → `artwork.preview-separations`,
 *    else → `artwork.render`).
 * - `GET /jobs/:id` — poll status. Returns `{ id, status }` or
 *   `404 { error: "not_found" }`.
 * - `GET /jobs/:id/events` — SSE stream emitting `status` events
 *   only when the status *changes* (deduped against `lastStatus`),
 *   plus heartbeats every `SSE_HEARTBEAT_MS` (default 5000) to keep
 *   intermediaries from closing the connection. Stream closes on
 *   terminal status (`done` | `failed`) or client abort.
 * - `GET /jobs/:id/result` — fetch the job result. `404` if the row
 *   doesn't exist, `202 { status }` if not yet `done`, else the
 *   result JSON. For render jobs that's
 *   `{ format, pdfBase64, filename, cacheKey }`.
 *
 * All four degrade gracefully when `DATABASE_URL` is unset —
 * `POST` returns a synthetic queued response, `GET` calls return
 * `not_found` / `pending`. This lets `/healthz`-only deployments
 * boot and pass smoke tests without Postgres.
 */
export const jobsRouter = new Hono();

jobsRouter.post("/", async (c) => {
  const body = await c.req.json<JobSubmitRequest>();
  const db = getDb();

  if (!db) {
    return c.json({ id: crypto.randomUUID(), status: "queued" }, 202);
  }

  const [row] = await db
    .insert(jobs)
    .values({ status: "queued", request: body as unknown as Record<string, unknown> })
    .returning({ id: jobs.id });

  const queueName =
    body.output.format === "thumbnail"
      ? "artwork.thumbnail"
      : body.output.format === "preview-separations"
        ? "artwork.preview-separations"
        : "artwork.render";

  if (!row) {
    return c.json({ error: "insert_failed" }, 500);
  }

  const boss = await getBoss();
  if (boss) {
    await boss.send(queueName, { dbJobId: row.id, ...body } as Record<string, unknown>);
  }

  return c.json({ id: row.id, status: "queued" }, 202);
});

jobsRouter.get("/:id", async (c) => {
  const { id } = c.req.param();
  const db = getDb();

  if (!db) return c.json({ id, status: "pending" });

  const [row] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!row) return c.json({ error: "not_found" }, 404);

  return c.json({ id: row.id, status: row.status });
});

jobsRouter.get("/:id/events", (c) => {
  const { id } = c.req.param();
  const heartbeatMs = Number(process.env.SSE_HEARTBEAT_MS ?? 5000);

  return streamSSE(c, async (stream) => {
    let lastStatus = "";
    const db = getDb();

    const emit = async () => {
      if (!db) {
        await stream.writeSSE({ data: JSON.stringify({ id, status: "pending" }), event: "status" });
        return false;
      }
      const [row] = await db.select({ status: jobs.status }).from(jobs).where(eq(jobs.id, id));
      const status = row?.status ?? "pending";
      if (status !== lastStatus) {
        lastStatus = status;
        await stream.writeSSE({ data: JSON.stringify({ id, status }), event: "status" });
      }
      return status === "done" || status === "failed";
    };

    const done = await emit();
    if (done) return;

    const timer = setInterval(async () => {
      try {
        const finished = await emit();
        if (finished) clearInterval(timer);
      } catch {
        clearInterval(timer);
      }
    }, heartbeatMs);

    stream.onAbort(() => clearInterval(timer));
  });
});

jobsRouter.get("/:id/result", async (c) => {
  const { id } = c.req.param();
  const db = getDb();

  if (!db) return c.json({ error: "not_found" }, 404);

  const [row] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.status !== "done") return c.json({ error: "not_ready", status: row.status }, 202);

  return c.json(row.result);
});
