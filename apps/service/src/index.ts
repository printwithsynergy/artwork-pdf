// SPDX-License-Identifier: AGPL-3.0-or-later
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { jobsRouter } from "./routes/jobs.js";
import { healthzRouter } from "./routes/healthz.js";
import { sourceRouter } from "./routes/source.js";
import { synergyNodeRouter } from "./routes/synergy-node.js";
import { startWorker } from "./worker.js";

const app = new Hono();

app.route("/jobs", jobsRouter);
app.route("/healthz", healthzRouter);
app.route("/source", sourceRouter);
app.route("/.well-known", synergyNodeRouter);

const port = Number(process.env.PORT ?? 3001);

startWorker().catch(console.error);

serve({ fetch: app.fetch, port }, () => {
  console.log(`artworkPDF service listening on :${port}`);
});
