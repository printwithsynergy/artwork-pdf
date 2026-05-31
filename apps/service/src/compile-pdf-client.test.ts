// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { CompilePdfClient, CompilePdfError } from "./compile-pdf-client.js";

const DUMMY_PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
const DUMMY_RESPONSE_B64 = btoa(String.fromCharCode(...DUMMY_PDF));

function makeFetcher(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
): typeof globalThis.fetch {
  return (async (input: unknown, init?: RequestInit) =>
    handler(String(input), init ?? {})) as typeof globalThis.fetch;
}

describe("CompilePdfClient", () => {
  it("compose posts to /v1/compose/apply with the document + options", async () => {
    let capturedUrl = "";
    let capturedBody: unknown = null;
    const client = new CompilePdfClient({
      baseUrl: "http://example.test",
      fetch: makeFetcher(async (url, init) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init.body as string);
        return new Response(
          JSON.stringify({ output_pdf_b64: DUMMY_RESPONSE_B64, cache_key: "abc123" }),
          { status: 200 },
        );
      }),
    });

    const result = await client.compose({ version: "2", layers: [] } as never);
    expect(capturedUrl).toBe("http://example.test/v1/compose/apply");
    const body = capturedBody as {
      document: { version: string };
      options: { embed_fonts: boolean; color_profile: string };
    };
    expect(body.document.version).toBe("2");
    expect(body.options.embed_fonts).toBe(true);
    expect(body.options.color_profile).toBe("ISOcoated_v2_eci");
    expect(result.cacheKey).toBe("abc123");
    expect(new Uint8Array(result.bytes)).toEqual(DUMMY_PDF);
  });

  it("marks / trap / impose / rewrite each base64-encode the input PDF and post the producer-specific payload", async () => {
    const seen: Array<{ url: string; body: Record<string, unknown> }> = [];
    const client = new CompilePdfClient({
      baseUrl: "http://example.test",
      fetch: makeFetcher(async (url, init) => {
        seen.push({ url, body: JSON.parse(init.body as string) });
        return new Response(
          JSON.stringify({ output_pdf_b64: DUMMY_RESPONSE_B64, cache_key: "k" }),
          { status: 200 },
        );
      }),
    });

    await client.marks({ trim: true, bleed: true }, DUMMY_PDF);
    await client.trap({ widthMm: 0.1 }, DUMMY_PDF);
    await client.impose(
      { sheetWidth: 1000, sheetHeight: 1500, rows: 2, cols: 2 },
      DUMMY_PDF,
    );
    await client.rewrite({ metadata: { Title: "x" } }, DUMMY_PDF);

    expect(seen.map((s) => s.url)).toEqual([
      "http://example.test/v1/marks/apply",
      "http://example.test/v1/trap/apply",
      "http://example.test/v1/impose/apply",
      "http://example.test/v1/rewrite/apply",
    ]);
    for (const { body } of seen) {
      expect(body.input_pdf_b64).toBe(DUMMY_RESPONSE_B64);
    }
    expect(seen[0]?.body.plan).toEqual({ trim: true, bleed: true });
    expect(seen[1]?.body.policy).toEqual({ widthMm: 0.1 });
    expect(seen[2]?.body.template).toMatchObject({ rows: 2, cols: 2 });
    expect(seen[3]?.body.plan).toEqual({ metadata: { Title: "x" } });
  });

  it("throws CompilePdfError with status + path on a non-2xx response", async () => {
    const client = new CompilePdfClient({
      baseUrl: "http://example.test",
      fetch: makeFetcher(
        async () => new Response("schema mismatch", { status: 422, statusText: "Unprocessable" }),
      ),
    });
    await expect(client.compose({ version: "2", layers: [] } as never)).rejects.toMatchObject({
      name: "CompilePdfError",
      status: 422,
      path: "/v1/compose/apply",
    });
  });

  it("throws CompilePdfError when output_pdf_b64 is missing from the 2xx body", async () => {
    const client = new CompilePdfClient({
      baseUrl: "http://example.test",
      fetch: makeFetcher(
        async () => new Response(JSON.stringify({ cache_key: "x" }), { status: 200 }),
      ),
    });
    await expect(client.compose({ version: "2", layers: [] } as never)).rejects.toBeInstanceOf(
      CompilePdfError,
    );
  });

  it("strips a trailing slash from the base URL", () => {
    const client = new CompilePdfClient({ baseUrl: "http://example.test/" });
    expect(client.baseUrl).toBe("http://example.test");
  });
});
