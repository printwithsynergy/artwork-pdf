// SPDX-License-Identifier: AGPL-3.0-or-later
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getBoss } from "./db/boss.js";
import { runMigrations } from "./db/migrate.js";
import { assetsRouter } from "./routes/assets.js";
import { healthzRouter } from "./routes/healthz.js";
import { jobsRouter } from "./routes/jobs.js";
import { preflightRulesRouter } from "./routes/preflight-rules.js";
import { sourceRouter } from "./routes/source.js";
import { synergyNodeRouter } from "./routes/synergy-node.js";
import { startWorker } from "./worker.js";

const app = new Hono();

app.route("/assets", assetsRouter);
app.route("/jobs", jobsRouter);
app.route("/preflight-rules", preflightRulesRouter);
app.route("/healthz", healthzRouter);
app.route("/source", sourceRouter);
app.route("/.well-known", synergyNodeRouter);

const port = Number(process.env.PORT ?? 3001);

async function main() {
  await runMigrations();
  await getBoss(); // initialise connection before worker registers handlers
  await startWorker();
  serve({ fetch: app.fetch, port }, () => {
    console.log(`artworkPDF service listening on :${port}`);
  });
}

main().catch(console.error);
