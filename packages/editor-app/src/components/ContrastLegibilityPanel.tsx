// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 P4 — Print contrast / legibility panel.
 *
 * Print contrast and screen contrast are different problems —
 * what passes WCAG digital can fail on uncoated kraft. P4
 * surfaces ink-vs-substrate Lab ΔE / neutral-density contrast,
 * min legible text size, and reverse-on-busy-image warnings
 * sourced from a host-supplied loader (typically lint-pdf's
 * print-contrast analyzer).
 *
 * @public
 */

import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";

/** @public */
export type ContrastLegibilitySeverity = "error" | "warn" | "info";
/** @public */
export type ContrastLegibilityCategory =
  | "contrast"
  | "text-size"
  | "reverse-on-image"
  | "neutral-density"
  | "other";
/** @public */
export type ContrastLegibilityFinding = {
  id: string;
  category: ContrastLegibilityCategory;
  severity: ContrastLegibilitySeverity;
  summary: string;
  recommendation?: string;
  objectId?: string;
  deltaE?: number;
};
/** @public */
export type ContrastLegibilityLoaderFn = () => Promise<readonly ContrastLegibilityFinding[]>;
/** @public */
export type ContrastLegibilityFilter = {
  severity?: ContrastLegibilitySeverity;
  category?: ContrastLegibilityCategory;
};
/** @public */
export type ContrastLegibilityGroup = {
  severity: ContrastLegibilitySeverity;
  findings: readonly ContrastLegibilityFinding[];
};

/** @public */
export const CONTRAST_LEGIBILITY_SEVERITY_ORDER: readonly ContrastLegibilitySeverity[] = [
  "error",
  "warn",
  "info",
];

const SEVERITY_COLORS: Record<ContrastLegibilitySeverity, string> = {
  error: "#a00",
  warn: "#a60",
  info: "#06a",
};

/**
 * Pure helper — filters by severity / category. Returns a new
 * array preserving input order. Pure function.
 *
 * @public
 */
export function filterContrastLegibilityFindings(
  findings: readonly ContrastLegibilityFinding[],
  filter: ContrastLegibilityFilter,
): readonly ContrastLegibilityFinding[] {
  return findings.filter((f) => {
    if (filter.severity && f.severity !== filter.severity) return false;
    if (filter.category && f.category !== filter.category) return false;
    return true;
  });
}

/**
 * Pure helper — groups findings by severity in
 * {@link CONTRAST_LEGIBILITY_SEVERITY_ORDER}. Always returns a
 * stable three-bucket shape. Pure function.
 *
 * @public
 */
export function groupContrastLegibilityFindingsBySeverity(
  findings: readonly ContrastLegibilityFinding[],
): readonly ContrastLegibilityGroup[] {
  const buckets = new Map<ContrastLegibilitySeverity, ContrastLegibilityFinding[]>(
    CONTRAST_LEGIBILITY_SEVERITY_ORDER.map((s) => [s, []]),
  );
  for (const f of findings) buckets.get(f.severity)?.push(f);
  return CONTRAST_LEGIBILITY_SEVERITY_ORDER.map((severity) => ({
    severity,
    findings: buckets.get(severity) ?? [],
  }));
}

/** @public */
export type ContrastLegibilityPanelProps = {
  loader: ContrastLegibilityLoaderFn;
  filterSeverity?: ContrastLegibilitySeverity;
  filterCategory?: ContrastLegibilityCategory;
  onSelect?: (finding: ContrastLegibilityFinding) => void;
};

/**
 * Stateful panel — loads finding stream, surfaces filtered +
 * grouped list, emits onSelect on row click.
 *
 * @public
 */
export function ContrastLegibilityPanel({
  loader,
  filterSeverity,
  filterCategory,
  onSelect,
}: ContrastLegibilityPanelProps): ReactElement {
  const [findings, setFindings] = useState<readonly ContrastLegibilityFinding[] | null>(null);
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
        if (!disposed) setFindings(next);
      } catch (err: unknown) {
        if (!disposed) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [loader]);

  const groups = useMemo(() => {
    if (!findings) return null;
    const filtered = filterContrastLegibilityFindings(findings, {
      ...(filterSeverity && { severity: filterSeverity }),
      ...(filterCategory && { category: filterCategory }),
    });
    return groupContrastLegibilityFindingsBySeverity(filtered);
  }, [findings, filterSeverity, filterCategory]);

  if (loading) {
    return (
      <output
        data-testid="contrast-legibility-panel"
        aria-live="polite"
        style={{ display: "block", padding: "0.5rem", opacity: 0.6 }}
      >
        Loading contrast / legibility findings…
      </output>
    );
  }
  if (error) {
    return (
      <div
        data-testid="contrast-legibility-panel"
        role="alert"
        style={{ padding: "0.5rem", color: "#a00" }}
      >
        Couldn't load contrast / legibility findings: {error}
      </div>
    );
  }
  if (!groups) return <div data-testid="contrast-legibility-panel" />;
  const total = groups.reduce((s, g) => s + g.findings.length, 0);
  return (
    <div data-testid="contrast-legibility-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Contrast & legibility ({total})</h3>
      </header>
      {total === 0 && (
        <div style={{ opacity: 0.6, fontSize: "0.875rem" }}>
          {findings && findings.length > 0
            ? "No findings match the current filter."
            : "No contrast or legibility issues detected."}
        </div>
      )}
      {groups.map((group) => {
        if (group.findings.length === 0) return null;
        return (
          <section
            key={group.severity}
            data-testid={`contrast-legibility-group-${group.severity}`}
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
              {group.severity} ({group.findings.length})
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {group.findings.map((finding) => (
                <li key={finding.id} style={{ marginBottom: "0.25rem" }}>
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(finding)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "0.375rem 0.5rem",
                        background: "transparent",
                        border: "1px solid #ddd",
                        borderRadius: 4,
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: "0.8125rem",
                      }}
                    >
                      {finding.summary}
                      {finding.deltaE !== undefined && (
                        <span style={{ color: "#595959", marginLeft: "0.375rem" }}>
                          (ΔE {finding.deltaE.toFixed(2)})
                        </span>
                      )}
                    </button>
                  ) : (
                    <div style={{ padding: "0.375rem 0.5rem", fontSize: "0.8125rem" }}>
                      {finding.summary}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
