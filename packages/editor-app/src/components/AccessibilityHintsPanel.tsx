// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 AI5 — Accessibility hints panel.
 *
 * Fourth panel in the Wave 4 AI family alongside AI1
 * {@link DesignSuggestionsPanel} (proactive design hints), AI2
 * {@link SmartSpotMatchPanel} (ΔE-ranked PANTONE matcher), and AI3
 * {@link PreflightAutoFixPanel} (preflight remediation). AI5 surfaces
 * accessibility findings (low contrast, missing alt text, text-size
 * minimums, color-only signalling) sourced from a host-supplied
 * loader. Rules-engine, ML adapter, or a tenant-deployed lint-pdf
 * accessibility profile all fit the same loader contract.
 *
 * Findings carry an optional `objectId` so the host can scroll the
 * offending canvas object into view, and an optional `severity` for
 * triage. The same three-tier severity vocabulary as B2
 * BrandConsistencyPanel — kept identical on purpose so a single host
 * triage UI can render both panels' rows the same way.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";

/**
 * Severity of an accessibility finding. Mirrors B2's vocabulary
 * verbatim so hosts that surface both panels in one triage list get
 * consistent ordering and colors.
 *
 * @public
 */
export type AccessibilitySeverity = "error" | "warn" | "info";

/**
 * Category an accessibility finding belongs to. Hosts can render
 * category chips for quick scanning; the panel groups findings by
 * severity, not category.
 *
 * @public
 */
export type AccessibilityCategory =
  | "contrast"
  | "alt-text"
  | "text-size"
  | "color-only"
  | "structure"
  | "other";

/**
 * One accessibility finding. The optional `recommendation` is a
 * single short remediation hint surfaced as a secondary line in the
 * row; the optional `objectId` lets the host wire a focus / scroll
 * affordance to the offending canvas object.
 *
 * @public
 */
export type AccessibilityFinding = {
  /** Stable identifier — the panel uses it as the React key and
   *  exposes it through `onSelect`. */
  id: string;
  category: AccessibilityCategory;
  severity: AccessibilitySeverity;
  summary: string;
  /** Optional short remediation hint (one line). */
  recommendation?: string;
  /** Optional id of the canvas object the finding applies to. */
  objectId?: string;
};

/**
 * Host adapter — resolves the full accessibility finding list for the
 * active document. Rejects on transport / validation errors and the
 * panel surfaces the message inline. Hosts should memoize the
 * function with `useCallback` so an unrelated parent re-render doesn't
 * trigger a spurious refetch.
 *
 * @public
 */
export type AccessibilityHintsLoaderFn = () => Promise<readonly AccessibilityFinding[]>;

/**
 * Filter spec accepted by {@link filterAccessibilityFindings}.
 *
 * @public
 */
export type AccessibilityFilter = {
  /** Pre-filter to a single severity. Absent → all severities. */
  severity?: AccessibilitySeverity;
  /** Pre-filter to a single category. Absent → all categories. */
  category?: AccessibilityCategory;
};

/**
 * Result row from {@link groupAccessibilityFindingsBySeverity}.
 *
 * @public
 */
export type AccessibilityGroup = {
  severity: AccessibilitySeverity;
  findings: readonly AccessibilityFinding[];
};

/**
 * Canonical severity order — errors first so press-blocking issues
 * surface at the top. Identical to B2's order on purpose.
 *
 * @public
 */
export const ACCESSIBILITY_SEVERITY_ORDER: readonly AccessibilitySeverity[] = [
  "error",
  "warn",
  "info",
];

const SEVERITY_LABELS: Record<AccessibilitySeverity, string> = {
  error: "Errors",
  warn: "Warnings",
  info: "Info",
};

const SEVERITY_COLORS: Record<AccessibilitySeverity, string> = {
  error: "#a00",
  warn: "#a60",
  info: "#06a",
};

/**
 * Pure helper — filters findings by severity / category. Returns a
 * new array; preserves input order. Pure function.
 *
 * @public
 */
export function filterAccessibilityFindings(
  findings: readonly AccessibilityFinding[],
  filter: AccessibilityFilter,
): readonly AccessibilityFinding[] {
  return findings.filter((f) => {
    if (filter.severity && f.severity !== filter.severity) return false;
    if (filter.category && f.category !== filter.category) return false;
    return true;
  });
}

/**
 * Pure helper — groups findings by severity in
 * {@link ACCESSIBILITY_SEVERITY_ORDER}. Returns a stable three-bucket
 * shape so renderers iterate without absent-key checks.
 *
 * Pure function.
 *
 * @public
 */
export function groupAccessibilityFindingsBySeverity(
  findings: readonly AccessibilityFinding[],
): readonly AccessibilityGroup[] {
  const buckets = new Map<AccessibilitySeverity, AccessibilityFinding[]>(
    ACCESSIBILITY_SEVERITY_ORDER.map((s) => [s, []]),
  );
  for (const f of findings) {
    buckets.get(f.severity)?.push(f);
  }
  return ACCESSIBILITY_SEVERITY_ORDER.map((severity) => ({
    severity,
    findings: buckets.get(severity) ?? [],
  }));
}

/**
 * Configuration for the {@link AccessibilityHintsPanel}. The host
 * always supplies the {@link AccessibilityHintsLoaderFn}; the
 * optional `onSelect` callback lets the host wire a focus affordance
 * (jump to the offending canvas object, focus the matching property
 * editor row, etc.).
 *
 * @public
 */
export type AccessibilityHintsPanelProps = {
  loader: AccessibilityHintsLoaderFn;
  /** Optional severity pre-filter applied before grouping. */
  filterSeverity?: AccessibilitySeverity;
  /** Optional category pre-filter applied before grouping. */
  filterCategory?: AccessibilityCategory;
  /** Id of the currently active finding — the matching row renders
   *  in the "active" style. Hosts wire this to whichever surface
   *  drives selection. */
  activeFindingId?: string;
  /** Fired when the user clicks a row. */
  onSelect?: (finding: AccessibilityFinding) => void;
};

/**
 * Stateful panel — loads the finding stream on mount, surfaces the
 * filtered + grouped list, and emits `onSelect` on row click.
 * Handles loading / error / empty states inline.
 *
 * @public
 */
export function AccessibilityHintsPanel({
  loader,
  filterSeverity,
  filterCategory,
  activeFindingId,
  onSelect,
}: AccessibilityHintsPanelProps): ReactElement {
  const [findings, setFindings] = useState<readonly AccessibilityFinding[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError(null);
    setFindings(null);
    void (async () => {
      try {
        const next = await loader();
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
  }, [loader]);

  const visibleGroups = useMemo(() => {
    if (!findings) return null;
    const filtered = filterAccessibilityFindings(findings, {
      ...(filterSeverity && { severity: filterSeverity }),
      ...(filterCategory && { category: filterCategory }),
    });
    return groupAccessibilityFindingsBySeverity(filtered);
  }, [findings, filterSeverity, filterCategory]);

  if (loading) {
    return (
      <output
        data-testid="accessibility-hints-panel"
        aria-live="polite"
        style={{ display: "block", padding: "0.5rem", opacity: 0.6 }}
      >
        Loading accessibility hints…
      </output>
    );
  }
  if (error) {
    return (
      <div
        data-testid="accessibility-hints-panel"
        role="alert"
        style={{ padding: "0.5rem", color: "#a00" }}
      >
        Couldn't load accessibility hints: {error}
      </div>
    );
  }
  if (!visibleGroups) return <div data-testid="accessibility-hints-panel" />;

  const totalVisible = visibleGroups.reduce((s, g) => s + g.findings.length, 0);
  return (
    <div data-testid="accessibility-hints-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Accessibility hints ({totalVisible})</h3>
      </header>
      {totalVisible === 0 && (
        <div
          data-testid="accessibility-hints-panel-empty"
          style={{ opacity: 0.6, fontSize: "0.875rem" }}
        >
          {findings && findings.length > 0
            ? "No findings match the current filter."
            : "No accessibility issues detected."}
        </div>
      )}
      {visibleGroups.map((group) => {
        if (group.findings.length === 0) return null;
        return (
          <section
            key={group.severity}
            data-testid={`accessibility-hints-group-${group.severity}`}
            style={{ marginBottom: "0.75rem" }}
          >
            <h4
              style={{
                margin: "0 0 0.25rem 0",
                fontSize: "0.75rem",
                color: SEVERITY_COLORS[group.severity],
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {SEVERITY_LABELS[group.severity]} ({group.findings.length})
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {group.findings.map((finding) => (
                <AccessibilityRow
                  key={finding.id}
                  finding={finding}
                  isActive={finding.id === activeFindingId}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Renders one finding row. Intra-package helper — surface
 * (category chip, summary, optional recommendation) is intentionally
 * minimal so {@link AccessibilityHintsPanel} can swap it without
 * downstream consumers depending on the shape.
 */
function AccessibilityRow({
  finding,
  isActive,
  onSelect,
}: {
  finding: AccessibilityFinding;
  isActive: boolean;
  onSelect: ((f: AccessibilityFinding) => void) | undefined;
}): ReactElement {
  const rowStyle = {
    display: "block",
    width: "100%",
    padding: "0.375rem 0.5rem",
    background: isActive ? "#e0ecff" : "transparent",
    border: isActive ? "1px solid #2563eb" : "1px solid #ddd",
    borderRadius: 4,
    marginBottom: "0.25rem",
    textAlign: "left" as const,
    cursor: onSelect ? "pointer" : "default",
  };
  const contents = (
    <>
      <div style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
        <span
          style={{
            display: "inline-block",
            fontSize: "0.625rem",
            padding: "0.0625rem 0.375rem",
            borderRadius: 999,
            background: "#eee",
            color: "#595959",
            marginRight: "0.375rem",
          }}
        >
          {finding.category}
        </span>
        {finding.summary}
      </div>
      {finding.recommendation && (
        <div style={{ fontSize: "0.75rem", color: "#595959", marginTop: "0.125rem" }}>
          {finding.recommendation}
        </div>
      )}
    </>
  );
  return (
    <li>
      {onSelect ? (
        <button type="button" onClick={() => onSelect(finding)} style={rowStyle}>
          {contents}
        </button>
      ) : (
        <div style={rowStyle}>{contents}</div>
      )}
    </li>
  );
}
