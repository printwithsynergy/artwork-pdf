// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 B2 — Brand-consistency findings panel.
 *
 * Companion to the B1 {@link BrandAssetsPanel} (Wave 4 PR-5). The
 * brand-assets panel lists the registry the designer is supposed to
 * pull from; this one surfaces a host-loader-supplied list of
 * violations against that registry — logo placed too small, fill
 * color outside the swatches set, typography pairing off the brand
 * kit, etc.
 *
 * Findings reference a `brandAssetId` so the host can jump to the
 * matching asset in the registry / focus the offending object on the
 * canvas. The loader is the same shape as the rest of the Wave 4
 * panel family: one call per mount resolves the full finding set.
 *
 * Pairs with lint-pdf's brand-consistency profile when one is
 * deployed (cross-repo, deferred); hosts running purely client-side
 * heuristics can wire a local loader in the meantime.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import type { BrandAssetKind } from "./BrandAssetsPanel";

/**
 * Severity of a brand-consistency finding. Mirrors lint-pdf's three
 * tiers so the two systems agree on the wire shape.
 *
 * @public
 */
export type BrandConsistencySeverity = "error" | "warn" | "info";

/**
 * One brand-consistency finding. `brandAssetId` is the foreign key
 * into the host's brand-asset registry (the same id surfaced by the
 * B1 {@link BrandAssetsPanel}); `assetKind` is duplicated for fast
 * grouping without a lookup. The optional `objectId` lets the host
 * focus the violating canvas object.
 *
 * @public
 */
export type BrandConsistencyFinding = {
  /** Stable identifier — the panel uses it as the React key and
   *  exposes it through `onSelect`. */
  id: string;
  /** Foreign key into the host's brand-asset registry. */
  brandAssetId: string;
  /** Duplicated from the asset for fast grouping; saves a registry
   *  lookup per row. */
  assetKind: BrandAssetKind;
  severity: BrandConsistencySeverity;
  summary: string;
  description?: string;
  /** Optional id of the canvas object that violates the rule. Hosts
   *  wire this to a focus / scroll-into-view affordance. */
  objectId?: string;
};

/**
 * Host adapter — resolves the full finding list for the active
 * document. Rejects on transport / validation errors and the panel
 * surfaces the message inline. Hosts should memoize the function
 * with `useCallback` so an unrelated parent re-render doesn't
 * trigger a spurious refetch.
 *
 * @public
 */
export type BrandConsistencyLoaderFn = () => Promise<readonly BrandConsistencyFinding[]>;

/**
 * Filter spec accepted by {@link filterBrandConsistencyFindings}.
 *
 * @public
 */
export type BrandConsistencyFilter = {
  /** Pre-filter to a single severity. Absent → all severities. */
  severity?: BrandConsistencySeverity;
  /** Pre-filter to a single asset kind. Absent → all kinds. */
  assetKind?: BrandAssetKind;
};

/**
 * Result row from {@link groupBrandConsistencyFindingsBySeverity}.
 *
 * @public
 */
export type BrandConsistencyGroup = {
  severity: BrandConsistencySeverity;
  findings: readonly BrandConsistencyFinding[];
};

/**
 * Canonical severity order — errors first so press-blocking issues
 * surface at the top.
 *
 * @public
 */
export const BRAND_CONSISTENCY_SEVERITY_ORDER: readonly BrandConsistencySeverity[] = [
  "error",
  "warn",
  "info",
];

const SEVERITY_LABELS: Record<BrandConsistencySeverity, string> = {
  error: "Errors",
  warn: "Warnings",
  info: "Info",
};

const SEVERITY_COLORS: Record<BrandConsistencySeverity, string> = {
  error: "#a00",
  warn: "#a60",
  info: "#06a",
};

/**
 * Pure helper — filters findings by severity / asset kind. Returns a
 * new array; preserves input order. Pure function.
 *
 * @public
 */
export function filterBrandConsistencyFindings(
  findings: readonly BrandConsistencyFinding[],
  filter: BrandConsistencyFilter,
): readonly BrandConsistencyFinding[] {
  return findings.filter((f) => {
    if (filter.severity && f.severity !== filter.severity) return false;
    if (filter.assetKind && f.assetKind !== filter.assetKind) return false;
    return true;
  });
}

/**
 * Pure helper — groups findings by severity in
 * {@link BRAND_CONSISTENCY_SEVERITY_ORDER}. Returns a stable
 * three-bucket shape so renderers iterate without absent-key checks.
 *
 * Pure function.
 *
 * @public
 */
export function groupBrandConsistencyFindingsBySeverity(
  findings: readonly BrandConsistencyFinding[],
): readonly BrandConsistencyGroup[] {
  const buckets = new Map<BrandConsistencySeverity, BrandConsistencyFinding[]>(
    BRAND_CONSISTENCY_SEVERITY_ORDER.map((s) => [s, []]),
  );
  for (const f of findings) {
    buckets.get(f.severity)?.push(f);
  }
  return BRAND_CONSISTENCY_SEVERITY_ORDER.map((severity) => ({
    severity,
    findings: buckets.get(severity) ?? [],
  }));
}

/**
 * Configuration for the {@link BrandConsistencyPanel}. The host
 * always supplies the {@link BrandConsistencyLoaderFn}; the optional
 * `onSelect` callback lets the host wire a focus affordance (jump to
 * the violating object on the canvas, scroll the brand-assets panel
 * to the matching registry entry, etc.).
 *
 * @public
 */
export type BrandConsistencyPanelProps = {
  loader: BrandConsistencyLoaderFn;
  /** Optional severity pre-filter applied before grouping. */
  filterSeverity?: BrandConsistencySeverity;
  /** Optional asset-kind pre-filter applied before grouping. */
  filterAssetKind?: BrandAssetKind;
  /** Id of the currently active finding — the matching row renders
   *  in the "active" style. Hosts wire this to whichever surface
   *  drives selection. */
  activeFindingId?: string;
  /** Fired when the user clicks a row. */
  onSelect?: (finding: BrandConsistencyFinding) => void;
};

/**
 * Stateful panel — loads the finding stream on mount, surfaces the
 * filtered + grouped list, and emits `onSelect` on row click.
 * Handles loading / error / empty states inline.
 *
 * @public
 */
export function BrandConsistencyPanel({
  loader,
  filterSeverity,
  filterAssetKind,
  activeFindingId,
  onSelect,
}: BrandConsistencyPanelProps): ReactElement {
  const [findings, setFindings] = useState<readonly BrandConsistencyFinding[] | null>(null);
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
    const filtered = filterBrandConsistencyFindings(findings, {
      ...(filterSeverity && { severity: filterSeverity }),
      ...(filterAssetKind && { assetKind: filterAssetKind }),
    });
    return groupBrandConsistencyFindingsBySeverity(filtered);
  }, [findings, filterSeverity, filterAssetKind]);

  if (loading) {
    return (
      <output
        data-testid="brand-consistency-panel"
        aria-live="polite"
        style={{ display: "block", padding: "0.5rem", opacity: 0.6 }}
      >
        Loading brand findings…
      </output>
    );
  }
  if (error) {
    return (
      <div
        data-testid="brand-consistency-panel"
        role="alert"
        style={{ padding: "0.5rem", color: "#a00" }}
      >
        Couldn't load brand findings: {error}
      </div>
    );
  }
  if (!visibleGroups) return <div data-testid="brand-consistency-panel" />;

  const totalVisible = visibleGroups.reduce((s, g) => s + g.findings.length, 0);
  return (
    <div data-testid="brand-consistency-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Brand consistency ({totalVisible})</h3>
      </header>
      {totalVisible === 0 && (
        <div
          data-testid="brand-consistency-panel-empty"
          style={{ opacity: 0.6, fontSize: "0.875rem" }}
        >
          {findings && findings.length > 0
            ? "No findings match the current filter."
            : "On-brand — no findings."}
        </div>
      )}
      {visibleGroups.map((group) => {
        if (group.findings.length === 0) return null;
        return (
          <section
            key={group.severity}
            data-testid={`brand-consistency-group-${group.severity}`}
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
                <BrandConsistencyRow
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
 * Renders one finding row. Intra-package helper — the row's surface
 * (asset-kind chip, summary, optional description, optional jump
 * affordance) is intentionally minimal so {@link BrandConsistencyPanel}
 * can swap it without downstream consumers depending on the shape.
 */
function BrandConsistencyRow({
  finding,
  isActive,
  onSelect,
}: {
  finding: BrandConsistencyFinding;
  isActive: boolean;
  onSelect: ((f: BrandConsistencyFinding) => void) | undefined;
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
          {finding.assetKind}
        </span>
        {finding.summary}
      </div>
      {finding.description && (
        <div style={{ fontSize: "0.75rem", color: "#595959", marginTop: "0.125rem" }}>
          {finding.description}
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
