// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 V3 — versioned variant matrix viewer.
 *
 * Reads a list of historical {@link VariantMatrixSnapshot}s (typically
 * derived from `DocumentV3.variants.version` paired with snapshots
 * the host persists) and surfaces a "v1.2.0 vs v1.3.0" diff. Hosts
 * that ship variant-aware versioning land this in their MIS chrome
 * so a designer can answer "which row did the brand team add in the
 * last revision?" without a full table re-read.
 *
 * Pure controlled component — host owns history, baselineVersion,
 * and currentVersion. The diff helper {@link diffVariantMatrices}
 * is exported so hosts can drive custom rendering (sparkline,
 * change log, MIS audit row) over the same algorithm.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useMemo } from "react";
import type { VariantMatrixPanelValue, VariantMatrixPanelVariant } from "./VariantMatrixPanel";

/**
 * One historical variant-matrix snapshot. Structurally compatible
 * with `{ version, ...VariantMatrix }` from
 * `@artworkpdf/document-model` — hosts that carry their own
 * version-history list construct snapshots by stamping each
 * persisted `variants` payload with the matrix-level `version`.
 *
 * @public
 */
export type VariantMatrixSnapshot = {
  version: string;
  matrix: VariantMatrixPanelValue;
};

/**
 * Per-variant modification record produced by
 * {@link diffVariantMatrices}.
 *
 * `changedTokens` is the list of token keys whose value differs
 * between baseline and current; `nameChanged` is true when the
 * variant's human-readable `name` changed (with the `id` still
 * matching). Either being non-empty makes the variant "modified".
 *
 * @public
 */
export type VariantMatrixModifiedVariant = {
  id: string;
  name: string;
  changedTokens: readonly string[];
  nameChanged: boolean;
};

/**
 * Result of {@link diffVariantMatrices}.
 *
 * - `addedVariants` — present in `current` but not `baseline`.
 * - `removedVariants` — present in `baseline` but not `current`.
 * - `modifiedVariants` — present in both with at least one token
 *    override change or a name change.
 * - `addedTokenKeys` / `removedTokenKeys` — the diff of the column
 *    set (`matrix.tokenKeys`).
 *
 * @public
 */
export type VariantMatrixDiffResult = {
  addedVariants: readonly VariantMatrixPanelVariant[];
  removedVariants: readonly VariantMatrixPanelVariant[];
  modifiedVariants: readonly VariantMatrixModifiedVariant[];
  addedTokenKeys: readonly string[];
  removedTokenKeys: readonly string[];
};

/**
 * @public
 */
export type VariantMatrixVersionPanelProps = {
  /** Ordered version history, oldest → newest. Typically the host's
   *  matrix-snapshot ring buffer. Empty array surfaces a "no
   *  history yet" hint. */
  history: readonly VariantMatrixSnapshot[];
  /** Version to compare against. Absent → the second-to-latest
   *  snapshot when `history.length >= 2`, else the only snapshot. */
  baselineVersion?: string;
  /** Version to compare as "current". Absent → the most-recent
   *  snapshot. */
  currentVersion?: string;
  /** Fires when the user picks a different baseline from the panel's
   *  dropdown. */
  onBaselineChange?: (version: string) => void;
  /** Fires when the user picks a different current version. */
  onCurrentChange?: (version: string) => void;
};

/**
 * Resolve which snapshot the panel should pull from `history`.
 *
 * Behaviour matches `PreflightDiffPanel.resolveBaselineSnapshot`:
 * an explicit version wins when found, else falls back to the
 * most-recent snapshot. Returns `undefined` only when `history` is
 * empty. Falling back keeps the panel useful after a host trims
 * history below the user's saved selection.
 *
 * Pure function; exposed for hosts that mirror the panel's
 * selection in their own chrome.
 *
 * @public
 */
export function resolveSnapshot(
  history: readonly VariantMatrixSnapshot[],
  version: string | undefined,
): VariantMatrixSnapshot | undefined {
  if (history.length === 0) return undefined;
  if (version !== undefined) {
    const explicit = history.find((s) => s.version === version);
    if (explicit) return explicit;
  }
  return history[history.length - 1];
}

/**
 * Compute the variant-row + token-column diff between two matrices.
 *
 * Variants are matched by `id`; the human-readable `name` and token
 * `overrides` are compared per-id. Token keys are diffed as sets
 * (order-insensitive). Pure function — no React, no DOM.
 *
 * @public
 */
export function diffVariantMatrices(
  baseline: VariantMatrixPanelValue,
  current: VariantMatrixPanelValue,
): VariantMatrixDiffResult {
  const baselineById = new Map(baseline.variants.map((v) => [v.id, v]));
  const currentById = new Map(current.variants.map((v) => [v.id, v]));

  const addedVariants: VariantMatrixPanelVariant[] = [];
  const removedVariants: VariantMatrixPanelVariant[] = [];
  const modifiedVariants: VariantMatrixModifiedVariant[] = [];

  for (const v of current.variants) {
    const prior = baselineById.get(v.id);
    if (!prior) {
      addedVariants.push(v);
      continue;
    }
    const changedTokens = diffOverrideKeys(prior.overrides, v.overrides);
    const nameChanged = prior.name !== v.name;
    if (changedTokens.length > 0 || nameChanged) {
      modifiedVariants.push({
        id: v.id,
        name: v.name,
        changedTokens,
        nameChanged,
      });
    }
  }
  for (const v of baseline.variants) {
    if (!currentById.has(v.id)) removedVariants.push(v);
  }

  const baselineTokens = new Set(baseline.tokenKeys);
  const currentTokens = new Set(current.tokenKeys);
  const addedTokenKeys = current.tokenKeys.filter((k) => !baselineTokens.has(k));
  const removedTokenKeys = baseline.tokenKeys.filter((k) => !currentTokens.has(k));

  return { addedVariants, removedVariants, modifiedVariants, addedTokenKeys, removedTokenKeys };
}

/**
 * Diff two override maps and return the set of keys whose value
 * differs. Keys present in only one side count as changed (the
 * other side resolves to undefined). Uses `Object.hasOwn` so
 * inherited properties don't sneak in.
 */
function diffOverrideKeys(
  prior: Record<string, string>,
  next: Record<string, string>,
): readonly string[] {
  const keys = new Set<string>();
  for (const k of Object.keys(prior)) keys.add(k);
  for (const k of Object.keys(next)) keys.add(k);
  const changed: string[] = [];
  for (const k of keys) {
    const a = Object.hasOwn(prior, k) ? prior[k] : undefined;
    const b = Object.hasOwn(next, k) ? next[k] : undefined;
    if (a !== b) changed.push(k);
  }
  return changed.sort();
}

const COLORS = {
  added: "#070",
  removed: "#a00",
  modified: "#a60",
  tokenChange: "#06a",
} as const;

/**
 * Read-only viewer for a versioned variant matrix history. Picks
 * a baseline + current version (dropdowns) and renders a per-row
 * diff plus a token-column diff.
 *
 * @public
 */
export function VariantMatrixVersionPanel({
  history,
  baselineVersion,
  currentVersion,
  onBaselineChange,
  onCurrentChange,
}: VariantMatrixVersionPanelProps): ReactElement {
  // All hooks must run before any conditional return — toggling
  // `history` between empty and non-empty across renders would
  // otherwise change the hook count and trip
  // "Rendered fewer hooks than expected". The helpers tolerate
  // empty input (`resolveSnapshot` returns undefined,
  // `history[0]?.version` is undefined) so the work is cheap on
  // the empty path.
  const resolvedCurrent = resolveSnapshot(history, currentVersion);
  // Default baseline = the version *before* current; lets the panel
  // open with the most useful comparison ("what changed in the last
  // edit?") without the host wiring two selectors.
  const defaultBaselineVersion =
    history.length >= 2 ? history[history.length - 2]?.version : history[0]?.version;
  const resolvedBaseline = resolveSnapshot(history, baselineVersion ?? defaultBaselineVersion);

  const diff = useMemo(
    () =>
      resolvedBaseline && resolvedCurrent
        ? diffVariantMatrices(resolvedBaseline.matrix, resolvedCurrent.matrix)
        : null,
    [resolvedBaseline, resolvedCurrent],
  );

  if (history.length === 0) {
    return (
      <div data-testid="variant-matrix-version-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        No matrix history yet — save the matrix to capture the first version.
      </div>
    );
  }

  return (
    <div data-testid="variant-matrix-version-panel" style={{ padding: "0.5rem" }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.5rem",
          marginBottom: "0.5rem",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Variant matrix diff</h3>
        <VersionPicker
          dataTestId="variant-matrix-baseline"
          label="vs."
          value={resolvedBaseline?.version ?? ""}
          history={history}
          onChange={onBaselineChange}
        />
        <VersionPicker
          dataTestId="variant-matrix-current"
          label="→"
          value={resolvedCurrent?.version ?? ""}
          history={history}
          onChange={onCurrentChange}
        />
      </header>
      {diff && (
        <>
          <DiffSection
            label="Added variants"
            color={COLORS.added}
            entries={diff.addedVariants.map((v) => v.name)}
          />
          <DiffSection
            label="Removed variants"
            color={COLORS.removed}
            entries={diff.removedVariants.map((v) => v.name)}
          />
          <DiffSection
            label="Modified variants"
            color={COLORS.modified}
            entries={diff.modifiedVariants.map((v) =>
              v.changedTokens.length > 0
                ? `${v.name} (${v.changedTokens.join(", ")}${v.nameChanged ? "; renamed" : ""})`
                : `${v.name} (renamed)`,
            )}
          />
          <DiffSection
            label="Added token columns"
            color={COLORS.tokenChange}
            entries={[...diff.addedTokenKeys]}
          />
          <DiffSection
            label="Removed token columns"
            color={COLORS.tokenChange}
            entries={[...diff.removedTokenKeys]}
          />
        </>
      )}
    </div>
  );
}

/**
 * One-row section of the diff viewer. Renders only when `entries`
 * is non-empty, so an unchanged comparison shows nothing — keeps
 * the panel quiet when there's nothing to say.
 *
 * Intra-package helper.
 */
function DiffSection({
  label,
  color,
  entries,
}: {
  label: string;
  color: string;
  entries: readonly string[];
}): ReactElement | null {
  if (entries.length === 0) return null;
  return (
    <section style={{ marginBottom: "0.5rem" }}>
      <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color }}>
        {label} ({entries.length})
      </h4>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {entries.map((entry, i) => (
          // Composite key — two variants can legitimately share a
          // name (the id is what disambiguates), and a token-column
          // name can repeat across kind buckets. Including the index
          // keeps React's reconciliation correct without exposing
          // the internal ids in the rendered output.
          <li
            key={`${label}-${i}-${entry}`}
            style={{ padding: "0.125rem 0.5rem", fontSize: "0.8125rem" }}
          >
            {entry}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Version dropdown used twice in the header (baseline + current).
 * Disabled state covers the read-only case where the host hasn't
 * wired a setter.
 *
 * Intra-package helper.
 */
function VersionPicker({
  dataTestId,
  label,
  value,
  history,
  onChange,
}: {
  dataTestId: string;
  label: string;
  value: string;
  history: readonly VariantMatrixSnapshot[];
  onChange: ((version: string) => void) | undefined;
}): ReactElement {
  return (
    <label style={{ fontSize: "0.75rem", color: "#666" }}>
      {`${label} `}
      <select
        data-testid={dataTestId}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={onChange === undefined}
        style={{ fontFamily: "monospace", fontSize: "0.75rem" }}
      >
        {history.map((s) => (
          <option key={s.version} value={s.version}>
            v{s.version}
          </option>
        ))}
      </select>
    </label>
  );
}
