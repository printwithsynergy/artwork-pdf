// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 AI3 — Preflight auto-fix suggestions panel.
 *
 * Surfaces host-loader-supplied fix suggestions next to each live
 * preflight finding so a designer can act on a hint without leaving
 * the editor. Typical suggestion sources: a synergy `preflight.fix`
 * AI node, a tenant-trained model behind the host's auth, or a
 * rules-engine that maps `ruleId` → canned remediation.
 *
 * Loader-adapter shape (batched: one call resolves suggestions for
 * every visible finding) matches the rest of the Wave 4 panel family
 * — `ComplianceFindingsPanel`, `MarkLibraryPanel`, etc. — so hosts
 * wire one fetch per mount, not one per row.
 *
 * Hosts wire `onApply` to apply the `applyHint` (e.g. update a fill,
 * adjust TAC, swap a font) — the editor stays runtime-free of the
 * remediation logic.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import type { PreflightFinding } from "./PreflightDiffPanel";

/**
 * One AI / rules-engine-suggested fix for a preflight finding.
 *
 * `applyHint` is an opaque bag forwarded to `onApply` — its shape is
 * a contract between the host's loader and its `onApply` handler.
 * The panel never inspects it.
 *
 * @public
 */
export type PreflightFixSuggestion = {
  /** Stable identifier — the panel uses it as the React key for the
   *  suggestion row and exposes it through `onApply`. */
  id: string;
  /** One-line headline shown in the row (e.g. "Lower TAC by
   *  switching rich black to B=100 K=100"). */
  summary: string;
  /** Optional long-form rationale rendered under the summary. */
  description?: string;
  /** Optional opaque bag describing the change to apply. */
  applyHint?: Record<string, unknown>;
};

/**
 * One batched loader result row — pairs a finding's stable
 * {@link findingKey} with the suggestions the loader returned for it.
 * Keyed (rather than indexed) so loaders can re-order findings
 * defensively without the panel mis-pairing rows.
 *
 * @public
 */
export type PreflightFixSet = {
  findingKey: string;
  suggestions: readonly PreflightFixSuggestion[];
};

/**
 * Host adapter — batched: the panel calls it once with every visible
 * finding and the loader resolves a fix set per finding (or an empty
 * set for findings the host can't help with). Hosts should memoize
 * the function with `useCallback` so an unrelated parent re-render
 * doesn't trigger a spurious refetch.
 *
 * @public
 */
export type PreflightFixLoaderFn = (
  findings: readonly PreflightFinding[],
) => Promise<readonly PreflightFixSet[]>;

/**
 * Pure helper — derives the stable key the diff and the panel pivot
 * findings on. Matches `PreflightDiffPanel`'s internal keying so the
 * two panels can be wired to a shared `Set<string>` of focused
 * findings.
 *
 * Pure function.
 *
 * @public
 */
export function findingKey(finding: PreflightFinding): string {
  return `${finding.ruleId}|${finding.severity}|${finding.pageIndex ?? "-"}`;
}

/**
 * Pure helper — flattens a {@link PreflightFixSet} list into a
 * `Map<findingKey, suggestions>` for O(1) row lookup. Returns a fresh
 * `Map` (safe to mutate downstream).
 *
 * @public
 */
export function indexFixSetsByFinding(
  sets: readonly PreflightFixSet[],
): Map<string, readonly PreflightFixSuggestion[]> {
  const out = new Map<string, readonly PreflightFixSuggestion[]>();
  for (const s of sets) out.set(s.findingKey, s.suggestions);
  return out;
}

/**
 * @public
 */
export type PreflightAutoFixPanelProps = {
  /** The live preflight findings the panel surfaces. Empty array →
   *  "preflight is clean" empty state. */
  findings: readonly PreflightFinding[];
  /** Host adapter, see {@link PreflightFixLoaderFn}. */
  loader: PreflightFixLoaderFn;
  /** Fired when the user clicks "Apply" on a suggestion. The host
   *  inspects `suggestion.applyHint` and mutates the document. */
  onApply?: (suggestion: PreflightFixSuggestion, finding: PreflightFinding) => void;
  /** Optional active-finding highlight — the matching row renders in
   *  the "active" style so hosts can sync the panel selection with
   *  the canvas / preflight banner. */
  activeFindingKey?: string;
};

/**
 * Stateful panel — loads the suggestion catalogue on mount, surfaces
 * each finding with the matching suggestions, and emits `onApply`.
 * Handles loading / error / empty states inline.
 *
 * @public
 */
export function PreflightAutoFixPanel({
  findings,
  loader,
  onApply,
  activeFindingKey,
}: PreflightAutoFixPanelProps): ReactElement {
  const [sets, setSets] = useState<readonly PreflightFixSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError(null);
    setSets(null);
    if (findings.length === 0) {
      setLoading(false);
      setSets([]);
      return () => {
        disposed = true;
      };
    }
    void (async () => {
      try {
        const next = await loader(findings);
        if (disposed) return;
        setSets(next);
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
  }, [loader, findings]);

  const index = useMemo(() => (sets ? indexFixSetsByFinding(sets) : null), [sets]);

  if (loading) {
    return (
      <div data-testid="preflight-autofix-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        Loading suggestions…
      </div>
    );
  }
  if (error) {
    return (
      <div
        data-testid="preflight-autofix-panel"
        role="alert"
        style={{ padding: "0.5rem", color: "#a00" }}
      >
        Couldn't load suggestions: {error}
      </div>
    );
  }
  if (!index) return <div data-testid="preflight-autofix-panel" />;

  if (findings.length === 0) {
    return (
      <div
        data-testid="preflight-autofix-panel"
        style={{ padding: "0.5rem", fontSize: "0.875rem", opacity: 0.6 }}
      >
        Preflight is clean — no findings to fix.
      </div>
    );
  }

  return (
    <div data-testid="preflight-autofix-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>
          Auto-fix ({findings.length} finding{findings.length === 1 ? "" : "s"})
        </h3>
      </header>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {findings.map((f) => {
          const key = findingKey(f);
          const suggestions = index.get(key) ?? [];
          const isActive = key === activeFindingKey;
          return (
            <li
              key={key}
              data-testid={`preflight-autofix-finding-${key}`}
              style={{
                marginBottom: "0.5rem",
                padding: "0.375rem 0.5rem",
                border: `1px solid ${isActive ? "#2563eb" : "#ddd"}`,
                borderRadius: 4,
                background: isActive ? "#e0ecff" : "transparent",
              }}
            >
              <div style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                {f.ruleId} <span style={{ color: severityColor(f.severity) }}>({f.severity})</span>
                {typeof f.pageIndex === "number" && (
                  <span style={{ color: "#666" }}> · page {f.pageIndex + 1}</span>
                )}
              </div>
              {suggestions.length === 0 ? (
                <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.25rem" }}>
                  No suggestions available.
                </div>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: "0.25rem 0 0 0" }}>
                  {suggestions.map((s) => (
                    <PreflightAutoFixSuggestionRow
                      key={s.id}
                      suggestion={s}
                      finding={f}
                      onApply={onApply}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function severityColor(severity: PreflightFinding["severity"]): string {
  switch (severity) {
    case "error":
      return "#a00";
    case "warn":
      return "#a60";
    case "info":
      return "#06a";
  }
}

function PreflightAutoFixSuggestionRow({
  suggestion,
  finding,
  onApply,
}: {
  suggestion: PreflightFixSuggestion;
  finding: PreflightFinding;
  onApply: ((s: PreflightFixSuggestion, f: PreflightFinding) => void) | undefined;
}): ReactElement {
  return (
    <li
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "flex-start",
        padding: "0.25rem 0",
        borderTop: "1px dashed #eee",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "0.8125rem" }}>{suggestion.summary}</div>
        {suggestion.description && (
          <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.125rem" }}>
            {suggestion.description}
          </div>
        )}
      </div>
      {onApply && (
        <button
          type="button"
          onClick={() => onApply(suggestion, finding)}
          style={{ fontSize: "0.75rem", padding: "0.125rem 0.5rem" }}
        >
          Apply
        </button>
      )}
    </li>
  );
}
