// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  parseStreamingRenderEvent,
  type StreamingRenderEvent,
  summarizeStreamingProgress,
} from "./streaming-render";

describe("parseStreamingRenderEvent", () => {
  it("parses page-start", () => {
    const ev = parseStreamingRenderEvent(
      "page-start",
      JSON.stringify({ pageIndex: 0, totalPages: 3 }),
    );
    expect(ev).toEqual({ kind: "page-start", pageIndex: 0, totalPages: 3 });
  });

  it("parses page-done", () => {
    const ev = parseStreamingRenderEvent(
      "page-done",
      JSON.stringify({ pageIndex: 1, totalPages: 3, ms: 245 }),
    );
    expect(ev).toEqual({ kind: "page-done", pageIndex: 1, totalPages: 3, ms: 245 });
  });

  it("parses output-chunk", () => {
    const ev = parseStreamingRenderEvent(
      "output-chunk",
      JSON.stringify({ chunkB64: "JVBERi0", bytesEmitted: 1024 }),
    );
    expect(ev).toEqual({ kind: "output-chunk", chunkB64: "JVBERi0", bytesEmitted: 1024 });
  });

  it("parses done with snake_case keys", () => {
    const ev = parseStreamingRenderEvent(
      "done",
      JSON.stringify({ pdf_sha256: "abc", cache_key: "xyz" }),
    );
    expect(ev).toEqual({ kind: "done", pdfSha256: "abc", cacheKey: "xyz" });
  });

  it("parses done with camelCase keys", () => {
    const ev = parseStreamingRenderEvent(
      "done",
      JSON.stringify({ pdfSha256: "abc", cacheKey: "xyz" }),
    );
    expect(ev).toEqual({ kind: "done", pdfSha256: "abc", cacheKey: "xyz" });
  });

  it("parses error", () => {
    const ev = parseStreamingRenderEvent(
      "error",
      JSON.stringify({ message: "bad", code: "E_BAD" }),
    );
    expect(ev).toEqual({ kind: "error", message: "bad", code: "E_BAD" });
  });

  it("returns null on malformed JSON", () => {
    expect(parseStreamingRenderEvent("page-start", "not json")).toBeNull();
  });

  it("returns null on unknown event name", () => {
    expect(parseStreamingRenderEvent("noop", "{}")).toBeNull();
  });

  it("returns null on missing required fields", () => {
    expect(parseStreamingRenderEvent("page-start", JSON.stringify({ pageIndex: 0 }))).toBeNull();
    expect(parseStreamingRenderEvent("done", JSON.stringify({ pdf_sha256: "abc" }))).toBeNull();
    expect(parseStreamingRenderEvent("error", JSON.stringify({ message: "x" }))).toBeNull();
  });

  it("returns null on wrong-type fields", () => {
    expect(
      parseStreamingRenderEvent(
        "page-done",
        JSON.stringify({ pageIndex: "0", totalPages: 3, ms: 1 }),
      ),
    ).toBeNull();
  });
});

describe("summarizeStreamingProgress", () => {
  it("returns 0% for an empty event stream", () => {
    const s = summarizeStreamingProgress([]);
    expect(s.percent).toBe(0);
    expect(s.completedPages).toBe(0);
    expect(s.totalPages).toBe(0);
    expect(s.currentPage).toBeNull();
    expect(s.status).toBe("running");
  });

  it("tracks the in-flight page after page-start", () => {
    const events: StreamingRenderEvent[] = [
      { kind: "page-start", pageIndex: 0, totalPages: 3 },
    ];
    const s = summarizeStreamingProgress(events);
    expect(s.currentPage).toBe(0);
    expect(s.completedPages).toBe(0);
    expect(s.totalPages).toBe(3);
    expect(s.percent).toBe(0);
  });

  it("computes percent from completed/total", () => {
    const events: StreamingRenderEvent[] = [
      { kind: "page-start", pageIndex: 0, totalPages: 4 },
      { kind: "page-done", pageIndex: 0, totalPages: 4, ms: 100 },
      { kind: "page-start", pageIndex: 1, totalPages: 4 },
      { kind: "page-done", pageIndex: 1, totalPages: 4, ms: 100 },
    ];
    const s = summarizeStreamingProgress(events);
    expect(s.completedPages).toBe(2);
    expect(s.percent).toBe(50);
  });

  it("accumulates bytes received from output-chunk", () => {
    const events: StreamingRenderEvent[] = [
      { kind: "output-chunk", chunkB64: "x", bytesEmitted: 512 },
      { kind: "output-chunk", chunkB64: "y", bytesEmitted: 1024 },
    ];
    const s = summarizeStreamingProgress(events);
    expect(s.receivedBytes).toBe(1024);
  });

  it("flips status to done on the terminal event", () => {
    const events: StreamingRenderEvent[] = [
      { kind: "page-start", pageIndex: 0, totalPages: 1 },
      { kind: "page-done", pageIndex: 0, totalPages: 1, ms: 10 },
      { kind: "done", pdfSha256: "abc", cacheKey: "xyz" },
    ];
    const s = summarizeStreamingProgress(events);
    expect(s.status).toBe("done");
    expect(s.percent).toBe(100);
    expect(s.currentPage).toBeNull();
  });

  it("surfaces error status + message", () => {
    const events: StreamingRenderEvent[] = [
      { kind: "page-start", pageIndex: 0, totalPages: 2 },
      { kind: "error", message: "out of memory", code: "E_OOM" },
    ];
    const s = summarizeStreamingProgress(events);
    expect(s.status).toBe("error");
    expect(s.errorMessage).toBe("out of memory");
    expect(s.currentPage).toBeNull();
  });
});
