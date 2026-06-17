// SPDX-License-Identifier: AGPL-3.0-or-later
//
// apps/service boot entry. Wires the Hono app, starts pg-boss, and
// listens on `PORT` (default 3001). The boot order matters:
//
//   1. runMigrations()  — `CREATE TABLE IF NOT EXISTS` for jobs,
//      preflight_rules, assets. Idempotent; safe across restarts.
//   2. getBoss()        — open the pg-boss connection BEFORE the
//      worker registers handlers, so the `boss.work(...)` calls in
//      startWorker() attach to an already-started instance instead
//      of triggering a double-start race.
//   3. startWorker()    — register the artwork.* render handler
//      against all three queues.
//   4. serve(...)       — accept HTTP traffic.
//
// All four steps no-op gracefully when DATABASE_URL is unset — the
// service can boot HTTP-only for `/healthz`-only environments.

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { optionalBearerAuth } from "./auth.js";
import { getBoss } from "./db/boss.js";
import { runMigrations } from "./db/migrate.js";
import { internalError, notFound } from "./problemDetails.js";
import { assetsRouter } from "./routes/assets.js";
import { contractRouter } from "./routes/contract.js";
import { correctRouter } from "./routes/correct.js";
import { healthzRouter, readyzRouter } from "./routes/healthz.js";
import { jobsRouter } from "./routes/jobs.js";
import { preflightRulesRouter } from "./routes/preflight-rules.js";
import { sourceRouter } from "./routes/source.js";
import { synergyNodeRouter } from "./routes/synergy-node.js";
import { startWorker } from "./worker.js";

const app = new Hono();

// Guard the data routes with optional bearer auth (no-op unless
// ARTWORK_SERVICE_TOKEN is configured). healthz / readyz / contract /
// source / well-known stay public — synergy and platform poll them
// unauthenticated. Both the bare base (e.g. POST /assets) and sub-paths
// (GET /assets/:id) are covered — Hono's `/x/*` wildcard does not match
// the bare `/x`. `/v1/correct` accepts tenant document content, so it is
// guarded; `/v1/contract` (mounted via `contractRouter` at `/v1`) is the
// only `/v1/*` path that stays public.
for (const base of ["/assets", "/jobs", "/preflight-rules", "/v1/correct"]) {
  app.use(base, optionalBearerAuth);
  app.use(`${base}/*`, optionalBearerAuth);
}

app.route("/assets", assetsRouter);
app.route("/jobs", jobsRouter);
app.route("/preflight-rules", preflightRulesRouter);
app.route("/healthz", healthzRouter);
app.route("/readyz", readyzRouter);
app.route("/v1", contractRouter);
app.route("/v1/correct", correctRouter);
app.route("/source", sourceRouter);
app.route("/.well-known", synergyNodeRouter);

// RFC 7807 error envelopes (org convention) — an unmatched route and any
// unhandled throw emit `application/problem+json` instead of Hono's default
// text/JSON, so a single client error-handler works across the stack.
app.notFound((c) => notFound(c, "Route not found."));
app.onError((err, c) => {
  // Log the full error server-side; return a generic detail to the client so an
  // unhandled error can't leak internal implementation details / stack traces.
  console.error("[artwork] unhandled error", err);
  return internalError(c);
});

const port = Number(process.env.PORT ?? 3001);

async function main() {
  await runMigrations();
  await getBoss();
  await startWorker();
  serve({ fetch: app.fetch, port }, () => {
    console.log(`artworkPDF service listening on :${port}`);
  });
}

main().catch(console.error);
