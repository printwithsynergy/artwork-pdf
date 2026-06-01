// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 2 P3 — Compliance findings panel.
 *
 * Surfaces the substrate / market / regulation findings produced by
 * lint-pdf's `P3_compliance_v1` profile (PR-D) separately from the
 * existing generic preflight panel. Generic preflight stays for "does
 * this PDF render" findings; this panel is for "is this artwork *
 * allowed* on the chosen substrate / market". The split keeps the two
 * audiences scannable: a press operator only wants to see render
 * blockers, a brand compliance lead only wants to see substrate /
 * regulation issues.
 *
 * Adapter pattern: hosts wire an async function that POSTs the
 * document + process / substrate to lint-pdf's
 * `/v1/preflight/process` endpoint (PR-E). This keeps the editor
 * package free of a runtime dep on lint-pdf's HTTP client.
 *
 * @public
 */
import { useEffect, useState } from "react";

/**
 * One compliance finding — mirrors lint-pdf's `Finding` wire shape
 * but is duplicated here so the editor stays consumable without the
 * lint-pdf SDK (same pattern as `EditorSeparation`).
 *
 * @public
 */
export type ComplianceFinding = {
  ruleId: string;
  severity: "error" | "warn" | "info";
  message: string;
  /** 0-indexed page reference, if the finding is scoped to one. */
  pageIndex?: number;
  /** Optional id of the offending object on `pageIndex`. */
  objectId?: string;
};

/**
 * Host-supplied adapter. Receives the document + the process /
 * substrate context the host has collected (typically from the
 * Job-Setup panel) and returns the compliance findings. Rejects on
 * transport errors; the panel surfaces the message inline.
 *
 * `documentB64` is required — the panel never invokes the loader
 * without a rendered PDF in hand, so hosts shouldn't have to handle
 * a `undefined`-input case.
 *
 * **Identity matters.** The panel re-fetches whenever the `loader`
 * reference changes (the standard React-effect dependency rule);
 * hosts that build the adapter inline should memoize it with
 * `useCallback` so an unrelated parent re-render doesn't trigger a
 * spurious `POST /v1/preflight/process` round-trip.
 *
 * @public
 */
export type ComplianceLoaderFn = (input: {
  documentB64: string;
  process: string;
  substrate: string;
}) => Promise<readonly ComplianceFinding[]>;

/**
 * @public
 */
export type ComplianceFindingsPanelProps = {
  /** Latest rendered document — base64 PDF or `undefined` for an
   *  "export first" affordance. */
  documentB64: string | undefined;
  /** Process class from `PrintContext.process` — drives the
   *  process_is matcher in lint-pdf's conditional rule engine. */
  process: string | undefined;
  /** Substrate class — drives the substrate_is matcher. */
  substrate: string | undefined;
  /** Adapter that resolves to the compliance findings. */
  loader: ComplianceLoaderFn;
  /** Optional callback fired when a finding row is clicked — hosts
   *  wire this to highlight the offending object on canvas. */
  onSelect?: (finding: ComplianceFinding) => void;
};

const SEVERITY_COLORS: Record<ComplianceFinding["severity"], string> = {
  error: "#a00",
  warn: "#a60",
  info: "#06a",
};

/**
 * @public
 */
export function ComplianceFindingsPanel({
  documentB64,
  process,
  substrate,
  loader,
  onSelect,
}: ComplianceFindingsPanelProps) {
  const [findings, setFindings] = useState<readonly ComplianceFinding[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!documentB64 || !process || !substrate) {
      setFindings(null);
      setError(null);
      return;
    }
    let disposed = false;
    setLoading(true);
    setError(null);
    // Wrap the loader call in an async IIFE so a *synchronous*
    // throw from the adapter (e.g. a host that validates inputs
    // before constructing the fetch Promise) flows through the
    // same `setError` path as a rejected Promise — otherwise the
    // throw would escape the effect and leave the panel stuck on
    // "Checking compliance…".
    void (async () => {
      try {
        const next = await loader({ documentB64, process, substrate });
        if (disposed) return;
        setFindings(next);
      } catch (err: unknown) {
        if (disposed) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [documentB64, process, substrate, loader]);

  if (!documentB64 || !process || !substrate) {
    return (
      <div data-testid="compliance-findings-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        Set process + substrate in Job Setup, then export to see compliance findings.
      </div>
    );
  }
  if (loading) {
    return (
      <div data-testid="compliance-findings-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        Checking compliance…
      </div>
    );
  }
  if (error) {
    return (
      <div
        data-testid="compliance-findings-panel"
        role="alert"
        style={{ padding: "0.5rem", color: "#a00" }}
      >
        Couldn't load compliance findings: {error}
      </div>
    );
  }
  if (!findings || findings.length === 0) {
    return (
      <div data-testid="compliance-findings-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        No compliance issues for {process} on {substrate}.
      </div>
    );
  }
  return (
    <div data-testid="compliance-findings-panel" style={{ padding: "0.5rem" }}>
      <h3 style={{ margin: "0 0 0.5rem 0" }}>Compliance ({findings.length})</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {findings.map((f, i) => {
          // Append the array index so duplicate (ruleId, pageIndex,
          // objectId) tuples — which the lint-pdf wire format allows
          // when the same rule fires twice on the same target with
          // different messages — still get unique React keys.
          const key = `${f.ruleId}-${f.pageIndex ?? "doc"}-${f.objectId ?? ""}-${i}`;
          const rowContents = (
            <>
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: "0.5rem",
                  height: "0.5rem",
                  borderRadius: "50%",
                  background: SEVERITY_COLORS[f.severity],
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1 }}>{f.message}</span>
              <small style={{ opacity: 0.6, fontFamily: "monospace" }}>
                {f.ruleId}
                {f.pageIndex !== undefined ? ` · p${f.pageIndex + 1}` : ""}
              </small>
            </>
          );
          const rowStyle = {
            display: "flex",
            alignItems: "baseline",
            gap: "0.5rem",
            width: "100%",
            padding: "0.25rem 0.5rem",
          } as const;
          // When the host wires no `onSelect`, rendering a `<button>`
          // would announce an interactive control to screen-reader
          // users that does nothing on activation — render a plain
          // div instead so the finding is read as static content.
          return (
            <li key={key}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(f)}
                  aria-label={`Compliance finding: ${f.message} (${f.ruleId}${
                    f.pageIndex !== undefined ? `, page ${f.pageIndex + 1}` : ""
                  })`}
                  style={{
                    ...rowStyle,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {rowContents}
                </button>
              ) : (
                <div style={rowStyle}>{rowContents}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
