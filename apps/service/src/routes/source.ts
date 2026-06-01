// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";

/**
 * AGPL §13 source-disclosure endpoint — `GET /source`.
 *
 * Network-interactive operators of AGPL software must offer source
 * for the *exact running commit*. This route 302s to a GitHub
 * archive tarball pinned to `GIT_SHA` (set at build/deploy time via
 * the CI pipeline), or falls back to `main` if unset. Override the
 * source host with `SOURCE_URL` for forks.
 *
 * Do **not** simplify this to a static link to `main` — the §13
 * obligation is for *the version running*, not the latest tip.
 */
export const sourceRouter = new Hono();

sourceRouter.get("/", (c) => {
  const sha = process.env.GIT_SHA ?? "main";
  const repo = process.env.SOURCE_URL ?? "https://github.com/printwithsynergy/artwork-pdf";
  return c.redirect(`${repo}/archive/${sha}.tar.gz`, 302);
});
