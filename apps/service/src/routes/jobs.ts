// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { JobSubmitRequest } from "@artworkpdf/document-model";

export const jobsRouter = new Hono();

jobsRouter.post("/", async (c) => {
  const body = await c.req.json<JobSubmitRequest>();
  // TODO: enqueue via pg-boss
  const jobId = crypto.randomUUID();
  return c.json({ id: jobId, status: "queued" }, 202);
});

jobsRouter.get("/:id", async (c) => {
  const { id } = c.req.param();
  // TODO: query pg-boss job state from DB
  return c.json({ id, status: "pending" });
});

jobsRouter.get("/:id/events", (c) => {
  const { id } = c.req.param();
  const heartbeatMs = Number(process.env["SSE_HEARTBEAT_MS"] ?? 15000);
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ data: JSON.stringify({ id, status: "pending" }), event: "status" });
    // Heartbeat to keep connection alive through proxies
    const timer = setInterval(() => {
      stream.writeSSE({ data: "ping", event: "heartbeat" }).catch(() => clearInterval(timer));
    }, heartbeatMs);
    stream.onAbort(() => clearInterval(timer));
    // TODO: subscribe to pg-boss job events and stream updates
  });
});

jobsRouter.get("/:id/result", async (c) => {
  const { id } = c.req.param();
  // TODO: retrieve result artifact from storage
  return c.json({ id, error: "not_found" }, 404);
});
