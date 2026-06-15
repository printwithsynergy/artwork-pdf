// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { contractRouter } from "./contract.js";
import { readyzRouter } from "./healthz.js";

describe("GET /v1/contract", () => {
  it("returns the artwork-pdf service descriptor", async () => {
    const res = await contractRouter.request("/contract");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.service).toBe("artwork-pdf");
    expect(typeof body.version).toBe("string");
    const caps = body.capabilities as Array<{ type: string; outputFormat: string }>;
    expect(caps.map((c) => c.type)).toContain("artwork.render");
    expect(caps.find((c) => c.type === "artwork.render")?.outputFormat).toBe("pdf-x4");
    const endpoints = body.endpoints as Record<string, string>;
    expect(endpoints.result).toBe("GET /jobs/:id/result");
  });
});

describe("GET /readyz", () => {
  it("returns ready", async () => {
    const res = await readyzRouter.request("/");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ready");
  });
});
