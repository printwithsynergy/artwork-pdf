// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 P2 — Process-specific preflight panel.
 *
 * Surfaces process-physics findings — flexo white-knockout, gravure
 * max line frequency, screen-print halftone limits, offset overprint
 * traps — separately from generic preflight (which covers
 * "does this PDF parse / render") and from {@link ComplianceFindingsPanel}
 * (which covers "is this artwork *allowed* on the chosen substrate /
 * market"). The three-way split keeps the audiences focused: a press
 * operator wants the physics, a brand lead wants the compliance, a
 * support engineer wants the parse errors.
 *
 * Adapter pattern: hosts wire an async function that POSTs the
 * document + active process to lint-pdf's `/v1/preflight/process`
 * endpoint and filters to process-physics rules. The editor stays
 * free of any runtime dep on lint-pdf's HTTP client; same approach
 * as {@link ComplianceFindingsPanel}, {@link InksPanel}, etc.
 *
 * @public
 */

import { useEffect, useState } from "react";

/**
 * One process-specific preflight finding — mirrors lint-pdf's
 * `Finding` wire shape with an explicit `process` discriminator the
 * panel groups by. Duplicated here so the editor stays consumable
 * without the lint-pdf SDK (same pattern as `ComplianceFinding`).
 *
 * @public
 */
export type ProcessRule = {
  ruleId: string;
  severity: "error" | "warn" | "info";
  message: string;
  /** The process class this rule fires under — matches the
   *  `process_is` matcher in lint-pdf's conditional rule engine. */
  process: string;
  /** 0-indexed page reference, if the finding is scoped to one. */
  pageIndex?: number;
  /** Optional id of the offending object on `pageIndex`. */
  objectId?: string;
};

/**
 * Host-supplied adapter. Receives the document + active process and
 * returns the process-physics findings. Rejects on transport errors;
 * the panel surfaces the message inline.
 *
 * **Identity matters.** The panel re-fetches whenever the `loader`
 * reference changes — hosts that build the adapter inline should
 * memoize it with `useCallback` so an unrelated parent re-render
 * doesn't trigger a spurious round-trip.
 *
 * @public
 */
export type ProcessRulesLoaderFn = (input: {
  documentB64: string;
  process: string;
}) => Promise<readonly ProcessRule[]>;

/**
 * Result row from {@link groupRulesByProcess}. The panel renders one
 * heading per group when `groupByProcess` is set.
 *
 * @public
 */
export type ProcessRuleGroup = {
  process: string;
  rules: readonly ProcessRule[];
};

/**
 * @public
 */
export type ProcessRulesPanelProps = {
  /** Latest rendered document — base64 PDF or `undefined` for an
   *  "export first" affordance. */
  documentB64: string | undefined;
  /** Active process class from `PrintContext.process`. Drives the
   *  `process_is` matcher in lint-pdf's conditional rule engine. */
  process: string | undefined;
  /** Adapter that resolves to the process-physics findings. */
  loader: ProcessRulesLoaderFn;
  /** Optional callback fired when a finding row is clicked — hosts
   *  wire this to highlight the offending object on canvas. */
  onSelect?: (rule: ProcessRule) => void;
  /** When `true`, the panel renders one collapsible group per
   *  process class (useful when the loader is allowed to surface
   *  findings for *adjacent* processes — e.g. an offset job with
   *  flexo-compatible warnings for downstream re-printing). Absent
   *  or `false`: flat list. */
  groupByProcess?: boolean;
};

/**
 * Group a flat list of findings by `process` key in first-occurrence
 * order. Pure function; exposed for hosts that want their own
 * rendering on top of the same grouping.
 *
 * @public
 */
export function groupRulesByProcess(rules: readonly ProcessRule[]): readonly ProcessRuleGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, ProcessRule[]>();
  for (const r of rules) {
    let bucket = buckets.get(r.process);
    if (!bucket) {
      bucket = [];
      buckets.set(r.process, bucket);
      order.push(r.process);
    }
    bucket.push(r);
  }
  return order.map((process) => ({ process, rules: buckets.get(process) ?? [] }));
}

const SEVERITY_COLORS: Record<ProcessRule["severity"], string> = {
  error: "#a00",
  warn: "#a60",
  info: "#06a",
};

/**
 * @public
 */
export function ProcessRulesPanel({
  documentB64,
  process,
  loader,
  onSelect,
  groupByProcess,
}: ProcessRulesPanelProps) {
  const [rules, setRules] = useState<readonly ProcessRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!documentB64 || !process) {
      setRules(null);
      setError(null);
      return;
    }
    let disposed = false;
    setLoading(true);
    setError(null);
    // Clear stale findings while the next fetch is in flight — if a
    // caller ever bypasses the `loading` guard, we don't want the
    // previous process's rules to flash through.
    setRules(null);
    // Wrap in an async IIFE so a *synchronous* throw from the adapter
    // (e.g. a host validating inputs before constructing fetch) flows
    // through the same `setError` path as a rejected Promise.
    void (async () => {
      try {
        const next = await loader({ documentB64, process });
        if (disposed) return;
        setRules(next);
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
  }, [documentB64, process, loader]);

  if (!documentB64 || !process) {
    return (
      <div data-testid="process-rules-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        Set process in Job Setup, then export to see process-specific findings.
      </div>
    );
  }
  if (loading) {
    return (
      <div data-testid="process-rules-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        Checking process rules…
      </div>
    );
  }
  if (error) {
    return (
      <div
        data-testid="process-rules-panel"
        role="alert"
        style={{ padding: "0.5rem", color: "#a00" }}
      >
        Couldn't load process rules: {error}
      </div>
    );
  }
  if (!rules || rules.length === 0) {
    return (
      <div data-testid="process-rules-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        No process-specific issues for {process}.
      </div>
    );
  }

  const groups = groupByProcess ? groupRulesByProcess(rules) : null;
  return (
    <div data-testid="process-rules-panel" style={{ padding: "0.5rem" }}>
      <h3 style={{ margin: "0 0 0.5rem 0" }}>Process rules ({rules.length})</h3>
      {groups ? (
        groups.map((g) => (
          <section key={g.process} style={{ marginBottom: "0.75rem" }}>
            <h4
              style={{
                margin: "0 0 0.25rem 0",
                fontSize: "0.875rem",
                textTransform: "capitalize",
              }}
            >
              {g.process} ({g.rules.length})
            </h4>
            <ProcessRulesList rules={g.rules} onSelect={onSelect} />
          </section>
        ))
      ) : (
        <ProcessRulesList rules={rules} onSelect={onSelect} />
      )}
    </div>
  );
}

function ProcessRulesList({
  rules,
  onSelect,
}: {
  rules: readonly ProcessRule[];
  onSelect: ((rule: ProcessRule) => void) | undefined;
}) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {rules.map((r, i) => {
        // Append the array index so duplicate (ruleId, pageIndex,
        // objectId, process) tuples still get unique React keys.
        const key = `${r.ruleId}-${r.process}-${r.pageIndex ?? "doc"}-${r.objectId ?? ""}-${i}`;
        const rowContents = (
          <>
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: "0.5rem",
                height: "0.5rem",
                borderRadius: "50%",
                background: SEVERITY_COLORS[r.severity],
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1 }}>{r.message}</span>
            <small style={{ opacity: 0.6, fontFamily: "monospace" }}>
              {r.ruleId}
              {r.pageIndex !== undefined ? ` · p${r.pageIndex + 1}` : ""}
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
        return (
          <li key={key}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(r)}
                aria-label={`Process rule: ${r.message} (${r.ruleId}${
                  r.pageIndex !== undefined ? `, page ${r.pageIndex + 1}` : ""
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
  );
}
