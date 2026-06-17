// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { CORRECTION_CONTRACT, correctRouter } from "./correct.js";

function reqBody(operations: unknown[], document?: unknown) {
  return {
    document: document ?? {
      version: "2",
      width: 100,
      height: 50,
      unit: "mm",
      separations: [
        { name: "Cyan", colorSpace: "CMYK" },
        { name: "Black", colorSpace: "CMYK" },
        { name: "Spot1", colorSpace: "Spot" },
      ],
      layers: [{ id: "art", type: "artwork", name: "Artwork", visible: true, objects: [] }],
    },
    operations,
  };
}

async function post(body: unknown): Promise<Response> {
  return correctRouter.request("/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /v1/correct — happy path", () => {
  it("applies a correction and returns the corrected v3 document + hash", async () => {
    const res = await post(reqBody([{ op: "set.page.bleed", bleedMm: 5 }]));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      document: { version: string; pages: { bleedMm: number }[] };
      applied: { op: string; changed: boolean }[];
      contentHash: string;
      schemaVersion: string;
    };
    expect(body.document.version).toBe("3");
    expect(body.document.pages[0]?.bleedMm).toBe(5);
    expect(body.applied[0]?.changed).toBe(true);
    expect(body.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(body.schemaVersion).toBe(CORRECTION_CONTRACT.schemaVersion);
  });

  it("is deterministic — identical requests yield identical hashes", async () => {
    const a = (await (
      await post(reqBody([{ op: "rename.separation", from: "Spot1", to: "PANTONE 185 C" }]))
    ).json()) as {
      contentHash: string;
    };
    const b = (await (
      await post(reqBody([{ op: "rename.separation", from: "Spot1", to: "PANTONE 185 C" }]))
    ).json()) as {
      contentHash: string;
    };
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("records an idempotent no-op without error", async () => {
    const res = await post(reqBody([{ op: "set.page.bleed", bleedMm: 0 }]));
    // v2 → v3 migration sets bleed to 0, so this is a no-op.
    expect(res.status).toBe(200);
    const body = (await res.json()) as { applied: { changed: boolean }[] };
    expect(body.applied[0]?.changed).toBe(false);
  });

  it("applies multiple ops in order", async () => {
    const res = await post(
      reqBody([
        { op: "set.separation.overprint", separation: "Black", overprint: true },
        { op: "remove.separation", separation: "Spot1" },
      ]),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      document: { pages: { separations: { name: string; overprint?: boolean }[] }[] };
    };
    const seps = body.document.pages[0]?.separations ?? [];
    expect(seps.find((s) => s.name === "Black")?.overprint).toBe(true);
    expect(seps.map((s) => s.name)).not.toContain("Spot1");
  });
});

describe("POST /v1/correct — request validation (400)", () => {
  it("rejects non-JSON body", async () => {
    const res = await correctRouter.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json{",
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });

  it("rejects a missing document", async () => {
    const res = await post({ operations: [] });
    expect(res.status).toBe(400);
  });

  it("rejects a non-array operations field", async () => {
    const res = await post({ document: {}, operations: "nope" });
    expect(res.status).toBe(400);
  });

  it("rejects an op missing its discriminator", async () => {
    const res = await post(reqBody([{ bleedMm: 5 }]));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown op discriminator", async () => {
    const res = await post(reqBody([{ op: "set.page.colour", bleedMm: 5 }]));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toContain("unknown op");
  });
});

describe("POST /v1/correct — field/target errors (422)", () => {
  it("returns 422 with pointer for a bad field value", async () => {
    const res = await post(reqBody([{ op: "set.page.bleed", bleedMm: -1 }]));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string; pointer: string; type: string };
    expect(body.type).toContain("unprocessable-entity");
    expect(body.code).toBe("invalid_operation");
    expect(body.pointer).toBe("operations/0");
  });

  it("returns 422 + target_not_found for a missing separation", async () => {
    const res = await post(reqBody([{ op: "remove.separation", separation: "Ghost" }]));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("target_not_found");
  });

  it("returns 422 for a missing pageId", async () => {
    const res = await post(reqBody([{ op: "set.page.bleed", pageId: "nope", bleedMm: 3 }]));
    expect(res.status).toBe(422);
  });
});

describe("POST /v1/correct — conflict (409)", () => {
  it("returns 409 when renaming onto an existing distinct ink", async () => {
    const res = await post(reqBody([{ op: "rename.separation", from: "Spot1", to: "Cyan" }]));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string; pointer: string };
    expect(body.code).toBe("conflict");
    expect(body.pointer).toBe("operations/0");
  });
});

describe("CORRECTION_CONTRACT", () => {
  it("advertises the op vocabulary + schema version", () => {
    expect(CORRECTION_CONTRACT.endpoint).toBe("POST /v1/correct");
    expect(CORRECTION_CONTRACT.operations).toContain("set.page.bleed");
    expect(typeof CORRECTION_CONTRACT.schemaVersion).toBe("string");
  });
});
