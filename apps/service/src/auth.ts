// SPDX-License-Identifier: AGPL-3.0-or-later
import { timingSafeEqual } from "node:crypto";
import { createMiddleware } from "hono/factory";

/**
 * Optional bearer-token auth for the service's data routes.
 *
 * Gated by the `ARTWORK_SERVICE_TOKEN` env var (or `ARTWORK_AUTH_TOKEN`
 * as an alias — synergy's gateway sends the credential under that name,
 * so accepting both lets an operator use one consistent var name across
 * the seam; `ARTWORK_SERVICE_TOKEN` wins when both are set):
 *
 * - **set** — every guarded request must present
 *   `Authorization: Bearer <token>` matching it (constant-time compare);
 *   anything else gets `401`. Use this when the service is reachable
 *   beyond a trusted private network.
 * - **unset** — auth is disabled and requests pass through, preserving
 *   the original behaviour for deployments where the service only sits
 *   behind synergy on a private network. A single warning is logged at
 *   first use so the open posture is visible in the logs.
 *
 * Liveness (`/healthz`), readiness (`/readyz`), the contract descriptor
 * (`/v1/contract`), AGPL source (`/source`), and the synergy capability
 * descriptor (`/.well-known/...`) are intentionally left unguarded —
 * they expose no tenant data and synergy/platform poll them unauthenticated.
 */

let warnedOpen = false;

function timingSafeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const optionalBearerAuth = createMiddleware(async (c, next) => {
  const expected = process.env.ARTWORK_SERVICE_TOKEN ?? process.env.ARTWORK_AUTH_TOKEN;
  if (!expected) {
    if (!warnedOpen) {
      warnedOpen = true;
      console.warn(
        "[auth] ARTWORK_SERVICE_TOKEN (or ARTWORK_AUTH_TOKEN) is unset — data routes " +
          "are unauthenticated. Set it to require a bearer token when the service is " +
          "publicly reachable.",
      );
    }
    return next();
  }

  const presented = (c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!presented || !timingSafeEq(presented, expected)) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return next();
});
