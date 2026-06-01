// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DocumentModel } from "@artworkpdf/document-model";
import type { Job } from "pg-boss";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompilePdfClient } from "../compile-pdf-client.js";
import { makeRenderJob } from "./render.js";

const DUMMY_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const DUMMY_PDF_B64 = btoa(String.fromCharCode(...DUMMY_PDF_BYTES));

const SAMPLE_DOC: DocumentModel = {
  version: "2",
  width: 105,
  height: 148,
  unit: "mm",
  separations: [],
  layers: [],
};

function makeJob(data: Record<string, unknown>, id = "job-1"): Job<Record<string, unknown>> {
  return { id, data } as Job<Record<string, unknown>>;
}

type FetchCall = { url: string; body: Record<string, unknown> };

function makeClient(
  respond: (call: FetchCall) => Response | Promise<Response>,
  calls: FetchCall[] = [],
): CompilePdfClient {
  const fetcher = (async (input: unknown, init?: RequestInit) => {
    const call: FetchCall = {
      url: String(input),
      body: JSON.parse(String(init?.body ?? "{}")),
    };
    calls.push(call);
    return respond(call);
  }) as typeof globalThis.fetch;
  return new CompilePdfClient({ baseUrl: "http://test.local", fetch: fetcher });
}

describe("makeRenderJob", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the job's document to compile-pdf and produces base64 PDF bytes", async () => {
    const calls: FetchCall[] = [];
    const client = makeClient(
      () =>
        new Response(JSON.stringify({ output_pdf_b64: DUMMY_PDF_B64, cache_key: "cache-xyz" }), {
          status: 200,
        }),
      calls,
    );
    const renderJob = makeRenderJob(client);

    await renderJob([makeJob({ document: SAMPLE_DOC })]);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://test.local/v1/compose/apply");
    expect(calls[0]?.body).toMatchObject({
      document: { version: "2", width: 105, height: 148 },
      options: { embed_fonts: true, color_profile: "ISOcoated_v2_eci" },
    });
  });

  it("calls compile-pdf once per job in the batch", async () => {
    const calls: FetchCall[] = [];
    const client = makeClient(
      () =>
        new Response(JSON.stringify({ output_pdf_b64: DUMMY_PDF_B64, cache_key: "k" }), {
          status: 200,
        }),
      calls,
    );
    const renderJob = makeRenderJob(client);

    await renderJob([
      makeJob({ document: SAMPLE_DOC }, "j1"),
      makeJob({ document: SAMPLE_DOC }, "j2"),
      makeJob({ document: SAMPLE_DOC }, "j3"),
    ]);

    expect(calls).toHaveLength(3);
  });

  it("logs and swallows errors when compile-pdf returns non-2xx (so the batch loop survives)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = makeClient(
      () => new Response("schema mismatch", { status: 422, statusText: "Unprocessable" }),
    );
    const renderJob = makeRenderJob(client);

    await expect(
      renderJob([makeJob({ document: SAMPLE_DOC }, "job-fail")]),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("render job job-fail failed:"),
      expect.stringContaining("/v1/compose/apply"),
    );
  });

  it("logs and swallows when the job payload has no 'document' field", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: FetchCall[] = [];
    const client = makeClient(
      () => new Response(JSON.stringify({ output_pdf_b64: DUMMY_PDF_B64 }), { status: 200 }),
      calls,
    );
    const renderJob = makeRenderJob(client);

    await renderJob([makeJob({ dbJobId: "x" }, "job-missing-doc")]);

    expect(calls).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("render job job-missing-doc failed:"),
      expect.stringContaining("missing 'document' field"),
    );
  });

  it("continues processing remaining jobs after one fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let nthCall = 0;
    const client = makeClient(() => {
      nthCall++;
      if (nthCall === 2) {
        return new Response("boom", { status: 500 });
      }
      return new Response(JSON.stringify({ output_pdf_b64: DUMMY_PDF_B64, cache_key: "k" }), {
        status: 200,
      });
    });
    const renderJob = makeRenderJob(client);

    await renderJob([
      makeJob({ document: SAMPLE_DOC }, "ok-1"),
      makeJob({ document: SAMPLE_DOC }, "fail"),
      makeJob({ document: SAMPLE_DOC }, "ok-3"),
    ]);

    expect(nthCall).toBe(3);
  });
});
