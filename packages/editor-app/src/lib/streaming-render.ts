// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Wave 3 O3 — Streaming render: shared types + pure helpers.
 *
 * The compile-pdf side ships a `POST /v1/compose/stream` SSE
 * endpoint that emits one event per page-start, page-done,
 * output-chunk (chunked PDF bytes for progressive download), and a
 * terminal `done` or `error`. The editor side wires an
 * EventSource-style adapter (or a mock for tests) and surfaces
 * progress.
 *
 * This module owns:
 * - The discriminated-union event shape.
 * - `parseStreamingRenderEvent` — pure parser. Returns null on
 *   malformed input rather than throwing; the consumer is free to
 *   drop unrecognised events.
 * - `summarizeStreamingProgress` — folds an event sequence into a
 *   summary suitable for a progress bar.
 *
 * @public
 */

/**
 * Per-event payload shapes emitted by the streaming compose
 * endpoint. The discriminator is `kind`. `event` exists on the SSE
 * envelope; we lift it onto the parsed type for ergonomics.
 *
 * @public
 */
export type StreamingRenderEvent =
  | {
      kind: "page-start";
      pageIndex: number;
      totalPages: number;
    }
  | {
      kind: "page-done";
      pageIndex: number;
      totalPages: number;
      /** Wall-clock duration of the page render, in milliseconds. */
      ms: number;
    }
  | {
      kind: "output-chunk";
      /** Base64-encoded PDF bytes for this chunk. The consumer
       *  concatenates chunks to form the final PDF. */
      chunkB64: string;
      /** Cumulative bytes emitted so far (sum of decoded chunks). */
      bytesEmitted: number;
    }
  | {
      kind: "done";
      pdfSha256: string;
      cacheKey: string;
    }
  | {
      kind: "error";
      message: string;
      code: string;
    };

/**
 * Pure parser — converts one SSE event (raw `event` field name +
 * raw `data` JSON string) into a typed {@link StreamingRenderEvent}.
 * Returns `null` for malformed input (bad JSON, unknown event kind,
 * missing required fields). The consumer is free to drop nulls
 * rather than abort the stream.
 *
 * Pure function.
 *
 * @public
 */
export function parseStreamingRenderEvent(
  eventName: string,
  data: string,
): StreamingRenderEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  switch (eventName) {
    case "page-start": {
      const pageIndex = p.pageIndex;
      const totalPages = p.totalPages;
      if (typeof pageIndex !== "number" || typeof totalPages !== "number") return null;
      return { kind: "page-start", pageIndex, totalPages };
    }
    case "page-done": {
      const pageIndex = p.pageIndex;
      const totalPages = p.totalPages;
      const ms = p.ms;
      if (typeof pageIndex !== "number" || typeof totalPages !== "number") return null;
      if (typeof ms !== "number") return null;
      return { kind: "page-done", pageIndex, totalPages, ms };
    }
    case "output-chunk": {
      const chunkB64 = p.chunkB64;
      const bytesEmitted = p.bytesEmitted;
      if (typeof chunkB64 !== "string" || typeof bytesEmitted !== "number") return null;
      return { kind: "output-chunk", chunkB64, bytesEmitted };
    }
    case "done": {
      const pdfSha256 = p.pdf_sha256 ?? p.pdfSha256;
      const cacheKey = p.cache_key ?? p.cacheKey;
      if (typeof pdfSha256 !== "string" || typeof cacheKey !== "string") return null;
      return { kind: "done", pdfSha256, cacheKey };
    }
    case "error": {
      const message = p.message;
      const code = p.code;
      if (typeof message !== "string" || typeof code !== "string") return null;
      return { kind: "error", message, code };
    }
    default:
      return null;
  }
}

/**
 * Aggregate progress summary computed from an event sequence.
 * Suitable for driving a progress bar, percentage chip, or
 * per-page badge list.
 *
 * @public
 */
export type StreamingProgress = {
  /** 0..100. 100 when status is "done". */
  percent: number;
  completedPages: number;
  totalPages: number;
  /** Index of the page currently in-flight, or null when none. */
  currentPage: number | null;
  /** Cumulative decoded bytes received. */
  receivedBytes: number;
  status: "running" | "done" | "error";
  /** Populated when status is "error". */
  errorMessage?: string;
};

/**
 * Pure helper — folds an event sequence into a single
 * {@link StreamingProgress}. Idempotent and order-tolerant beyond
 * the obvious page-start-before-page-done constraint.
 *
 * Pure function.
 *
 * @public
 */
export function summarizeStreamingProgress(
  events: readonly StreamingRenderEvent[],
): StreamingProgress {
  let completedPages = 0;
  let totalPages = 0;
  let currentPage: number | null = null;
  let receivedBytes = 0;
  let status: "running" | "done" | "error" = "running";
  let errorMessage: string | undefined;

  for (const ev of events) {
    switch (ev.kind) {
      case "page-start":
        totalPages = Math.max(totalPages, ev.totalPages);
        currentPage = ev.pageIndex;
        break;
      case "page-done":
        totalPages = Math.max(totalPages, ev.totalPages);
        completedPages++;
        if (currentPage === ev.pageIndex) currentPage = null;
        break;
      case "output-chunk":
        receivedBytes = Math.max(receivedBytes, ev.bytesEmitted);
        break;
      case "done":
        status = "done";
        currentPage = null;
        break;
      case "error":
        status = "error";
        errorMessage = ev.message;
        currentPage = null;
        break;
    }
  }

  const percent =
    status === "done"
      ? 100
      : totalPages > 0
        ? Math.min(100, Math.round((completedPages / totalPages) * 100))
        : 0;

  return {
    percent,
    completedPages,
    totalPages,
    currentPage,
    receivedBytes,
    status,
    ...(errorMessage !== undefined && { errorMessage }),
  };
}
