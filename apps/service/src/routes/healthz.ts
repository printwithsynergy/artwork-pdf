// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";

export const healthzRouter = new Hono();

healthzRouter.get("/", (c) => {
  return c.json({ status: "ok", service: "artwork-pdf" });
});
