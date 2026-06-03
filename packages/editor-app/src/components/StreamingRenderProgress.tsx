// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 3 O3 — Streaming render progress panel.
 *
 * Shows live per-page progress for a long render that returns
 * `text/event-stream` via `POST /v1/compose/stream`. The host wires
 * a {@link StreamingRenderConnectFn} adapter (typically backed by an
 * `EventSource` or a stubbed `AsyncIterable` for tests); the panel
 * owns the event accumulator and renders the summary returned by
 * {@link summarizeStreamingProgress}.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import {
  type StreamingProgress,
  type StreamingRenderEvent,
  summarizeStreamingProgress,
} from "../lib/streaming-render";

/**
 * Host adapter — opens a stream and returns an async iterable of
 * events plus a `close()` to abort. The shape lets a host wire an
 * `EventSource` over `/v1/compose/stream`, a `fetch()` with
 * `ReadableStream`, or a test mock interchangeably.
 *
 * The panel iterates events until the stream ends; on unmount it
 * calls `close()` to abort.
 *
 * @public
 */
export type StreamingRenderConnectFn = () => {
  events: AsyncIterable<StreamingRenderEvent>;
  close: () => void;
};

/**
 * Configuration for the {@link StreamingRenderProgress}.
 *
 * @public
 */
export type StreamingRenderProgressProps = {
  /** Connect adapter. When absent the panel renders in
   *  "ready to connect" mode and never opens a stream. */
  connect?: StreamingRenderConnectFn;
  /** Fires when the stream's `done` event lands — typically used
   *  to redirect to the rendered PDF or refresh the job list. */
  onDone?: (info: { pdfSha256: string; cacheKey: string }) => void;
  /** Fires when the stream emits an error event — typically used
   *  for telemetry / fallback to non-streaming render. */
  onError?: (info: { message: string; code: string }) => void;
};

/**
 * Stateful streaming-progress panel. Connects on mount when
 * `connect` is supplied, accumulates events, surfaces summary +
 * per-page badge list, and calls `onDone` / `onError` once.
 *
 * @public
 */
export function StreamingRenderProgress({
  connect,
  onDone,
  onError,
}: StreamingRenderProgressProps): ReactElement {
  const [events, setEvents] = useState<readonly StreamingRenderEvent[]>([]);
  const handlersRef = useRef({ onDone, onError });
  handlersRef.current = { onDone, onError };

  useEffect(() => {
    if (!connect) return;
    const handle = connect();
    let disposed = false;
    void (async () => {
      try {
        for await (const ev of handle.events) {
          if (disposed) return;
          setEvents((prev) => [...prev, ev]);
          if (ev.kind === "done") {
            handlersRef.current.onDone?.({
              pdfSha256: ev.pdfSha256,
              cacheKey: ev.cacheKey,
            });
          } else if (ev.kind === "error") {
            handlersRef.current.onError?.({ message: ev.message, code: ev.code });
          }
        }
      } catch {
        // Stream tear-down — surface as a synthetic error event so
        // the summarizer flips to "error" status without the
        // consumer having to special-case missing events.
        if (!disposed) {
          setEvents((prev) => [
            ...prev,
            { kind: "error", message: "Stream closed unexpectedly.", code: "E_STREAM_ABORTED" },
          ]);
        }
      }
    })();
    return () => {
      disposed = true;
      handle.close();
    };
  }, [connect]);

  const summary: StreamingProgress = summarizeStreamingProgress(events);
  return (
    <div data-testid="streaming-render-progress" style={{ padding: "0.5rem" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "0.375rem",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Render progress</h3>
        <span style={{ fontSize: "0.75rem", color: "#595959" }}>
          {summary.percent}% · {summary.completedPages}/{summary.totalPages || "?"}
        </span>
      </header>
      <div
        aria-label="Render progress"
        role="progressbar"
        aria-valuenow={summary.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          background: "#eee",
          height: 6,
          borderRadius: 3,
          overflow: "hidden",
          marginBottom: "0.5rem",
        }}
      >
        <div
          style={{
            width: `${summary.percent}%`,
            height: "100%",
            background:
              summary.status === "error" ? "#a00" : summary.status === "done" ? "#080" : "#06a",
            transition: "width 200ms linear",
          }}
        />
      </div>
      {summary.status === "error" && summary.errorMessage && (
        <div role="alert" style={{ fontSize: "0.75rem", color: "#a00", marginBottom: "0.375rem" }}>
          {summary.errorMessage}
        </div>
      )}
      {summary.status !== "error" && summary.totalPages > 0 && (
        <ul
          aria-label="Per-page status"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.25rem",
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {Array.from({ length: summary.totalPages }, (_, i) => {
            // O(1) lookup against the pre-computed Set so we don't
            // re-scan the raw events array on every badge.
            const done = summary.completedPageIndices.has(i);
            const active = summary.currentPage === i;
            const bg = done ? "#080" : active ? "#06a" : "#ccc";
            return (
              <li
                key={i}
                title={`Page ${i + 1}: ${done ? "done" : active ? "rendering" : "pending"}`}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 2,
                  background: bg,
                  border: "1px solid #999",
                }}
              />
            );
          })}
        </ul>
      )}
      {summary.receivedBytes > 0 && (
        <div style={{ fontSize: "0.6875rem", color: "#595959", marginTop: "0.375rem" }}>
          {(summary.receivedBytes / 1024).toFixed(1)} KB received
        </div>
      )}
      {!connect && (
        <div style={{ fontSize: "0.75rem", color: "#595959" }}>Streaming adapter not wired.</div>
      )}
    </div>
  );
}
