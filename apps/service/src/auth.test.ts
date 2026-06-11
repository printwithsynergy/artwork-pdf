// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { optionalBearerAuth } from "./auth.js";

function appWith(): Hono {
  const app = new Hono();
  app.use("/guarded", optionalBearerAuth);
  app.get("/guarded", (c) => c.json({ ok: true }));
  return app;
}

const PRIOR = process.env.ARTWORK_SERVICE_TOKEN;

afterEach(() => {
  // Restore exactly: remove the key when it was originally absent rather
  // than coercing it to "". Reflect.deleteProperty avoids the `delete`
  // operator that biome's lint flags.
  if (PRIOR === undefined) Reflect.deleteProperty(process.env, "ARTWORK_SERVICE_TOKEN");
  else process.env.ARTWORK_SERVICE_TOKEN = PRIOR;
});

describe("optionalBearerAuth", () => {
  describe("when ARTWORK_SERVICE_TOKEN is unset", () => {
    beforeEach(() => {
      Reflect.deleteProperty(process.env, "ARTWORK_SERVICE_TOKEN");
    });

    it("passes requests through (open posture)", async () => {
      const res = await appWith().request("/guarded");
      expect(res.status).toBe(200);
    });
  });

  describe("when ARTWORK_SERVICE_TOKEN is set", () => {
    beforeEach(() => {
      process.env.ARTWORK_SERVICE_TOKEN = "s3cret-token";
    });

    it("rejects a request with no Authorization header", async () => {
      const res = await appWith().request("/guarded");
      expect(res.status).toBe(401);
    });

    it("rejects a wrong token", async () => {
      const res = await appWith().request("/guarded", {
        headers: { authorization: "Bearer nope" },
      });
      expect(res.status).toBe(401);
    });

    it("accepts the correct bearer token", async () => {
      const res = await appWith().request("/guarded", {
        headers: { authorization: "Bearer s3cret-token" },
      });
      expect(res.status).toBe(200);
    });
  });
});
