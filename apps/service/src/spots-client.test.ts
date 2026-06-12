// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  CompilePdfClient,
  CompilePdfError,
  type SpotEntry,
  type SpotLibrariesResponse,
  type SpotSearchResponse,
} from "./compile-pdf-client.js";

const BASE = "http://test.local";

function makeFetcher(
  respond: (url: string) => Response | Promise<Response>,
): typeof globalThis.fetch {
  return (async (input: unknown) => respond(String(input))) as typeof globalThis.fetch;
}

describe("CompilePdfClient.spotSearch", () => {
  it("posts to /v1/spots/search with the URL-encoded query params", async () => {
    let captured: string | null = null;
    const fetcher = makeFetcher((url) => {
      captured = url;
      return new Response(
        JSON.stringify({ results: [], total: 0, limit: 25 } satisfies SpotSearchResponse),
        { status: 200 },
      );
    });
    const client = new CompilePdfClient({ baseUrl: BASE, fetch: fetcher });
    await client.spotSearch({ q: "185 C", library: "Formula Guide Coated", limit: 25 });
    // q + library get URL-encoded; spaces become %20+/-.
    expect(captured).toContain("/v1/spots/search?");
    // URLSearchParams encodes spaces as `+`.
    expect(captured).toContain("q=185+C");
    expect(captured).toContain("library=Formula+Guide+Coated");
    expect(captured).toContain("limit=25");
  });

  it("omits absent options from the query string", async () => {
    let captured: string | null = null;
    const fetcher = makeFetcher((url) => {
      captured = url;
      return new Response(JSON.stringify({ results: [], total: 0, limit: 50 }), { status: 200 });
    });
    const client = new CompilePdfClient({ baseUrl: BASE, fetch: fetcher });
    await client.spotSearch({});
    expect(captured).toBe(`${BASE}/v1/spots/search?`);
  });

  it("returns the typed SpotSearchResponse shape", async () => {
    const wire: SpotSearchResponse = {
      results: [{ name: "PANTONE 185 C", library: "Formula Guide Coated", lab: [52, 75, 49] }],
      total: 1,
      limit: 50,
    };
    const client = new CompilePdfClient({
      baseUrl: BASE,
      fetch: makeFetcher(() => new Response(JSON.stringify(wire), { status: 200 })),
    });
    const res = await client.spotSearch({ q: "185" });
    expect(res.total).toBe(1);
    expect(res.results[0]?.name).toBe("PANTONE 185 C");
  });
});

describe("CompilePdfClient.spotLookup", () => {
  it("returns the SpotEntry on 200", async () => {
    const entry: SpotEntry = { name: "PANTONE 185 C", library: "Formula Guide Coated" };
    const client = new CompilePdfClient({
      baseUrl: BASE,
      fetch: makeFetcher(() => new Response(JSON.stringify(entry), { status: 200 })),
    });
    const res = await client.spotLookup("PANTONE 185 C");
    expect(res?.name).toBe("PANTONE 185 C");
  });

  it("URL-encodes the name", async () => {
    let captured: string | null = null;
    const fetcher = makeFetcher((url) => {
      captured = url;
      return new Response(JSON.stringify({ name: "x" }), { status: 200 });
    });
    const client = new CompilePdfClient({ baseUrl: BASE, fetch: fetcher });
    await client.spotLookup("PANTONE 185 C");
    expect(captured).toBe(`${BASE}/v1/spots/lookup?name=PANTONE%20185%20C`);
  });

  it("returns null on 404 (unknown name — not an error)", async () => {
    const client = new CompilePdfClient({
      baseUrl: BASE,
      fetch: makeFetcher(() => new Response("not found", { status: 404 })),
    });
    const res = await client.spotLookup("DEFINITELY NOT REAL");
    expect(res).toBeNull();
  });

  it("throws CompilePdfError on non-2xx non-404 responses", async () => {
    const client = new CompilePdfClient({
      baseUrl: BASE,
      fetch: makeFetcher(() => new Response("boom", { status: 500 })),
    });
    await expect(client.spotLookup("anything")).rejects.toBeInstanceOf(CompilePdfError);
  });
});

describe("CompilePdfClient.spotLibraries", () => {
  it("returns the SpotLibrariesResponse shape", async () => {
    const wire: SpotLibrariesResponse = {
      libraries: [
        { id: "Formula Guide Coated", count: 2000 },
        { id: "Color Bridge Coated", count: 1500 },
      ],
    };
    const client = new CompilePdfClient({
      baseUrl: BASE,
      fetch: makeFetcher(() => new Response(JSON.stringify(wire), { status: 200 })),
    });
    const res = await client.spotLibraries();
    expect(res.libraries).toHaveLength(2);
    expect(res.libraries[0]?.id).toBe("Formula Guide Coated");
  });

  it("throws CompilePdfError on non-2xx", async () => {
    const client = new CompilePdfClient({
      baseUrl: BASE,
      fetch: makeFetcher(() => new Response("boom", { status: 500 })),
    });
    await expect(client.spotLibraries()).rejects.toBeInstanceOf(CompilePdfError);
  });
});
