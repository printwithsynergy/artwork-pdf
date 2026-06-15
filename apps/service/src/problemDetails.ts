// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * RFC 7807 Problem Details for the artwork-pdf HTTP service.
 *
 * Org convention (cross-stack audit): every HTTP service emits errors as
 * `application/problem+json` with `{ type, title, status, detail, instance }`
 * rather than ad-hoc `{ error }` JSON, so a single client error-handler works
 * across codex / lint / lens / compile / artwork. Canonical `type` URIs point
 * at the shared docs host (matching lens-server / synergy). artwork has no
 * dependency on `@printwithsynergy/codex-client`, so this is a small local
 * builder rather than a re-use of that package's shared module.
 */
export const PROBLEM_CONTENT_TYPE = "application/problem+json";

const TYPE_BASE = "https://docs.printwithsynergy.com/problems";

/** Emit an RFC 7807 Problem Details response from a Hono context. */
export function problem(
  c: Context,
  status: ContentfulStatusCode,
  slug: string,
  title: string,
  detail: string,
): Response {
  return c.body(
    JSON.stringify({
      type: `${TYPE_BASE}/${slug}`,
      title,
      status,
      detail,
      instance: new URL(c.req.url).pathname,
    }),
    status,
    { "content-type": PROBLEM_CONTENT_TYPE },
  );
}

/** `401 Unauthorized`. */
export function unauthorized(c: Context, detail = "Authentication required."): Response {
  return problem(c, 401, "unauthorized", "Unauthorized", detail);
}

/** `404 Not Found`. */
export function notFound(c: Context, detail = "Resource not found."): Response {
  return problem(c, 404, "not-found", "Not Found", detail);
}

/** `500 Internal Server Error` — the `app.onError` fallback. */
export function internalError(c: Context, detail = "Internal error."): Response {
  return problem(c, 500, "internal-error", "Internal Server Error", detail);
}
