// SPDX-License-Identifier: AGPL-3.0-or-later
// AGPL §13: running instances must expose source for the running commit.
import { Hono } from "hono";

export const sourceRouter = new Hono();

sourceRouter.get("/", (c) => {
  const sha = process.env.GIT_SHA ?? "main";
  const repo = process.env.SOURCE_URL ?? "https://github.com/printwithsynergy/artwork-pdf";
  return c.redirect(`${repo}/archive/${sha}.tar.gz`, 302);
});
