// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";

/**
 * Liveness probe — `GET /healthz`.
 *
 * Always returns `200 { status: "ok", service: "artwork-pdf" }`.
 * Intentionally does *not* check the DB or pg-boss: this is a
 * liveness check (process alive?), not a readiness check. The
 * synergy engine and platform both poll this. If you need a
 * readiness check that asserts dependencies, add a separate
 * `/readyz` rather than overloading this endpoint — load balancers
 * use liveness to decide whether to restart the pod, and a transient
 * DB outage shouldn't trigger restarts.
 */
export const healthzRouter = new Hono();

healthzRouter.get("/", (c) => {
  return c.json({ status: "ok", service: "artwork-pdf" });
});
