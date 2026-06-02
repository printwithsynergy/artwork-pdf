// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DocumentModel } from "@artworkpdf/document-model";
import type { Job } from "pg-boss";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompilePdfClient } from "../compile-pdf-client.js";
import { makeRenderJob } from "./render.js";

// Compose runs in-process via `@artworkpdf/compose` since the Wave 3
// triage; the remaining producers (marks / trap / impose) still
// cross the wire to compile-pdf. The tests below pin the chain
// invariants — order, fall-through when a producer field is absent,
// per-job error handling — and the compose-local invariant that
// no `/v1/compose/apply` request is ever emitted.

const DUMMY_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const DUMMY_PDF_B64 = btoa(String.fromCharCode(...DUMMY_PDF_BYTES));
const BASE = "http://test.local";
const ENDPOINT = {
  marks: `${BASE}/v1/marks/apply`,
  trap: `${BASE}/v1/trap/apply`,
  impose: `${BASE}/v1/impose/apply`,
} as const;

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
  return new CompilePdfClient({ baseUrl: BASE, fetch: fetcher });
}

describe("makeRenderJob", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("composes locally — no /v1/compose/apply request is ever issued", async () => {
    const calls: FetchCall[] = [];
    const client = makeClient(
      () =>
        new Response(JSON.stringify({ output_pdf_b64: DUMMY_PDF_B64, cache_key: "k" }), {
          status: 200,
        }),
      calls,
    );
    const renderJob = makeRenderJob(client);

    await renderJob([makeJob({ document: SAMPLE_DOC })]);

    // No wire producer ran (marks/trap/impose all absent), and
    // compose is in-process, so the fetch call log should be empty.
    expect(calls).toHaveLength(0);
  });

  it("processes every job in the batch even when none chain to a wire producer", async () => {
    const calls: FetchCall[] = [];
    const client = makeClient(
      () =>
        new Response(JSON.stringify({ output_pdf_b64: DUMMY_PDF_B64, cache_key: "k" }), {
          status: 200,
        }),
      calls,
    );
    const renderJob = makeRenderJob(client);

    // Three jobs, none with marks/trap/impose — compose alone is
    // enough. We don't assert call count (zero) here; the previous
    // test pins that. We just confirm the batch loop completes
    // without throwing.
    await expect(
      renderJob([
        makeJob({ document: SAMPLE_DOC }, "j1"),
        makeJob({ document: SAMPLE_DOC }, "j2"),
        makeJob({ document: SAMPLE_DOC }, "j3"),
      ]),
    ).resolves.toBeUndefined();
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

  it("continues processing remaining jobs after one wire producer fails", async () => {
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

    // Each job adds a marks step so the wire producer runs and the
    // second job's failure can fire — without a wire producer the
    // batch never touches the fetcher.
    await renderJob([
      makeJob({ document: SAMPLE_DOC, marksTemplate: { trim: true } }, "ok-1"),
      makeJob({ document: SAMPLE_DOC, marksTemplate: { trim: true } }, "fail"),
      makeJob({ document: SAMPLE_DOC, marksTemplate: { trim: true } }, "ok-3"),
    ]);

    expect(nthCall).toBe(3);
  });
});

describe("makeRenderJob — producer chaining", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function okResponse(cacheKey: string): Response {
    return new Response(JSON.stringify({ output_pdf_b64: DUMMY_PDF_B64, cache_key: cacheKey }), {
      status: 200,
    });
  }

  it("chains compose-local → marks when marksTemplate is present", async () => {
    const calls: FetchCall[] = [];
    let n = 0;
    const client = makeClient(() => okResponse(`step-${++n}`), calls);
    const renderJob = makeRenderJob(client);

    await renderJob([
      makeJob({ document: SAMPLE_DOC, marksTemplate: { trim: true, bleed: true } }),
    ]);

    // Only marks crosses the wire; compose is in-process.
    expect(calls.map((c) => c.url)).toEqual([ENDPOINT.marks]);
    expect(calls[0]?.body).toMatchObject({ plan: { trim: true, bleed: true } });
  });

  it("chains compose-local → trap when trapPolicy is present (skips marks)", async () => {
    const calls: FetchCall[] = [];
    let n = 0;
    const client = makeClient(() => okResponse(`step-${++n}`), calls);
    const renderJob = makeRenderJob(client);

    await renderJob([
      makeJob({ document: SAMPLE_DOC, trapPolicy: { widthMm: 0.15, mode: "spread" } }),
    ]);

    expect(calls.map((c) => c.url)).toEqual([ENDPOINT.trap]);
    expect(calls[0]?.body).toMatchObject({ policy: { widthMm: 0.15, mode: "spread" } });
  });

  it("chains compose-local → impose when imposeTemplate is present (skips marks + trap)", async () => {
    const calls: FetchCall[] = [];
    let n = 0;
    const client = makeClient(() => okResponse(`step-${++n}`), calls);
    const renderJob = makeRenderJob(client);

    await renderJob([
      makeJob({
        document: SAMPLE_DOC,
        imposeTemplate: { sheetWidthPt: 1684, sheetHeightPt: 2384, rows: 2, cols: 2 },
      }),
    ]);

    expect(calls.map((c) => c.url)).toEqual([ENDPOINT.impose]);
    expect(calls[0]?.body).toMatchObject({
      template: { sheetWidthPt: 1684, sheetHeightPt: 2384, rows: 2, cols: 2 },
    });
  });

  it("runs the full chain in order — marks → trap → impose — when all three fields are present", async () => {
    const calls: FetchCall[] = [];
    let n = 0;
    const client = makeClient(() => okResponse(`step-${++n}`), calls);
    const renderJob = makeRenderJob(client);

    await renderJob([
      makeJob({
        document: SAMPLE_DOC,
        marksTemplate: { trim: true },
        trapPolicy: { widthMm: 0.1 },
        imposeTemplate: { sheetWidthPt: 1000, sheetHeightPt: 1500, rows: 1, cols: 2 },
      }),
    ]);

    // Compose is in-process; marks/trap/impose stay on the wire.
    expect(calls.map((c) => c.url)).toEqual([ENDPOINT.marks, ENDPOINT.trap, ENDPOINT.impose]);
  });
});
