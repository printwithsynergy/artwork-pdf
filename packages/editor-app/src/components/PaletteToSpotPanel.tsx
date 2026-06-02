// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 1 AI4 — Palette → spot conversion panel.
 *
 * Closes the Wave 1 AI family. AI2 {@link SmartSpotMatchPanel}
 * answers "what's the nearest PANTONE for one user-picked color?";
 * AI4 takes the inverse direction — given the palette already in the
 * document (every distinct fill / stroke color on the active page),
 * route each entry through a host-supplied matcher and let the user
 * commit the best match into the spot registry in one click per row.
 *
 * Reuses AI2's {@link SpotMatchLoaderFn} adapter on purpose: a host
 * that wires a ΔE matcher for AI2 gets AI4 for free, and the cache /
 * rate-limit behaviour stays under one adapter.
 *
 * Pure helpers ({@link summarizePaletteCoverage}) live alongside so
 * downstream consumers can render coverage metrics (% of palette
 * matched, average ΔE, count of unmatched) without the panel.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SpotMatch, SpotMatchLoaderFn } from "./SmartSpotMatchPanel";
import { sortMatchesByDeltaE } from "./SmartSpotMatchPanel";

/**
 * One color entry in the document's palette, as the host provides it
 * (the editor's separations registry already carries this shape per
 * page). `usageCount` is informational — UIs sort by it to surface
 * the highest-impact colors first.
 *
 * @public
 */
export type PaletteColor = {
  /** Stable identifier — the panel uses it as the React key. */
  id: string;
  /** Lower-cased hex string `#rrggbb` (canonical). */
  hex: string;
  /** Optional human-readable name (e.g., "Brand Blue"). */
  name?: string;
  /** Optional usage counter — number of canvas objects that touch
   *  this color. */
  usageCount?: number;
};

/**
 * One row in the conversion table — pairs a palette color with the
 * best match returned from the loader. `status` discriminates the
 * lifecycle: hosts render a spinner on `loading`, the best match on
 * `matched`, the error message on `error`, and a "Convert" button on
 * `idle` / `matched`.
 *
 * @public
 */
export type PaletteToSpotRow = {
  color: PaletteColor;
  status: "idle" | "loading" | "matched" | "error";
  bestMatch?: SpotMatch;
  /** All loader-returned matches, sorted by ΔE. Hosts can surface
   *  alternates behind a disclosure. */
  alternates?: readonly SpotMatch[];
  errorMessage?: string;
};

/**
 * Aggregate coverage summary returned by
 * {@link summarizePaletteCoverage}.
 *
 * @public
 */
export type PaletteCoverageSummary = {
  totalColors: number;
  matched: number;
  unmatched: number;
  /** Average ΔE across `matched` rows. `null` when none matched. */
  averageDeltaE: number | null;
  /** Worst ΔE across `matched` rows. `null` when none matched. */
  worstDeltaE: number | null;
};

/**
 * Pure helper — summarizes a list of conversion rows. Pure function;
 * no I/O.
 *
 * @public
 */
export function summarizePaletteCoverage(
  rows: readonly PaletteToSpotRow[],
): PaletteCoverageSummary {
  let matched = 0;
  let sum = 0;
  let worst = 0;
  for (const row of rows) {
    if (row.status === "matched" && row.bestMatch) {
      matched++;
      sum += row.bestMatch.deltaE;
      if (row.bestMatch.deltaE > worst) worst = row.bestMatch.deltaE;
    }
  }
  return {
    totalColors: rows.length,
    matched,
    unmatched: rows.length - matched,
    averageDeltaE: matched > 0 ? sum / matched : null,
    worstDeltaE: matched > 0 ? worst : null,
  };
}

/**
 * Host adapter — commits a matched spot into the host's spot
 * registry (the editor's per-page `separations-registry` for the
 * canonical case). Resolves once the registry write completes; the
 * panel surfaces errors inline.
 *
 * @public
 */
export type SpotCommitFn = (color: PaletteColor, match: SpotMatch) => Promise<void>;

/**
 * Configuration for the {@link PaletteToSpotPanel}.
 *
 * @public
 */
export type PaletteToSpotPanelProps = {
  /** The colors to convert. Typically `getSeparations(activePage)`
   *  mapped into {@link PaletteColor} shape. */
  colors: readonly PaletteColor[];
  /** Match adapter — same shape as {@link SmartSpotMatchPanel}'s
   *  loader, so one matcher wire serves both AI2 + AI4. Called once
   *  per palette color when the user clicks "Match all" or hits the
   *  per-row "Match" button. */
  matchLoader: SpotMatchLoaderFn;
  /** Optional commit adapter — when provided, each row gains a
   *  "Convert" button that fires `onCommit`. Absent → conversion is
   *  read-only (host wires its own commit flow). */
  onCommit?: SpotCommitFn;
  /** Optional mapper that turns a loader error into a user-facing
   *  message. The default avoids leaking internal `Error.message`. */
  errorMessage?: (err: unknown) => string;
};

/**
 * Stateful panel — renders the palette as a table, dispatches the
 * host matcher per row (lazily on "Match" click or eagerly via the
 * "Match all" affordance), and surfaces coverage metrics in the
 * footer.
 *
 * @public
 */
export function PaletteToSpotPanel({
  colors,
  matchLoader,
  onCommit,
  errorMessage,
}: PaletteToSpotPanelProps): ReactElement {
  const initialRows = useMemo<PaletteToSpotRow[]>(
    () => colors.map((color) => ({ color, status: "idle" })),
    [colors],
  );
  const [rows, setRows] = useState<PaletteToSpotRow[]>(initialRows);

  // Re-seed the row state when the input palette changes.
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const matchOne = useCallback(
    async (color: PaletteColor) => {
      setRows((prev) =>
        prev.map((r) => (r.color.id === color.id ? { ...r, status: "loading" } : r)),
      );
      try {
        const matches = await matchLoader({ hex: color.hex });
        const sorted = sortMatchesByDeltaE(matches);
        const best = sorted[0];
        setRows((prev) =>
          prev.map((r) =>
            r.color.id === color.id
              ? {
                  color,
                  status: "matched",
                  ...(best && { bestMatch: best }),
                  alternates: sorted,
                }
              : r,
          ),
        );
      } catch (err) {
        let message = "Couldn't fetch matches.";
        if (errorMessage) {
          try {
            const candidate = errorMessage(err);
            if (candidate) message = candidate;
          } catch {
            // fall back to default
          }
        }
        setRows((prev) =>
          prev.map((r) =>
            r.color.id === color.id ? { color, status: "error", errorMessage: message } : r,
          ),
        );
      }
    },
    [matchLoader, errorMessage],
  );

  const matchAll = useCallback(async () => {
    // Skip rows that are already loading (in-flight) or already matched
    // (no point re-paying the matcher cost — host can use the per-row
    // "Re-match" button if they want to refresh a single entry).
    await Promise.all(
      rows
        .filter((r) => r.status !== "loading" && r.status !== "matched")
        .map((r) => matchOne(r.color)),
    );
  }, [rows, matchOne]);

  const commit = useCallback(
    async (row: PaletteToSpotRow) => {
      if (!onCommit || !row.bestMatch) return;
      try {
        await onCommit(row.color, row.bestMatch);
      } catch (err) {
        // Surface commit failures the same way match failures land
        // (per-row error state). Without this branch a failed write
        // would leave the row showing the matched state, suggesting
        // the spot was committed when it wasn't.
        let message = "Couldn't commit spot to registry.";
        if (errorMessage) {
          try {
            const candidate = errorMessage(err);
            if (candidate) message = candidate;
          } catch {
            // fall back to default
          }
        }
        setRows((prev) =>
          prev.map((r) =>
            r.color.id === row.color.id
              ? { color: row.color, status: "error", errorMessage: message }
              : r,
          ),
        );
      }
    },
    [onCommit, errorMessage],
  );

  const summary = useMemo(() => summarizePaletteCoverage(rows), [rows]);

  return (
    <div data-testid="palette-to-spot-panel" style={{ padding: "0.5rem" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Palette → spot ({rows.length})</h3>
        <button
          type="button"
          onClick={matchAll}
          disabled={rows.length === 0 || rows.every((r) => r.status === "loading")}
          style={{ fontSize: "0.75rem", padding: "0.125rem 0.5rem" }}
        >
          Match all
        </button>
      </header>
      {rows.length === 0 ? (
        <div
          data-testid="palette-to-spot-panel-empty"
          style={{ opacity: 0.6, fontSize: "0.875rem" }}
        >
          The active page has no palette colors yet.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.map((row) => (
            <PaletteRow
              key={row.color.id}
              row={row}
              onMatch={() => matchOne(row.color)}
              onCommit={onCommit ? () => commit(row) : undefined}
            />
          ))}
        </ul>
      )}
      <footer
        style={{
          marginTop: "0.5rem",
          fontSize: "0.75rem",
          color: "#595959",
          borderTop: "1px solid #eee",
          paddingTop: "0.375rem",
        }}
      >
        Matched {summary.matched}/{summary.totalColors}
        {summary.averageDeltaE !== null && (
          <>
            {" "}
            · avg ΔE {summary.averageDeltaE.toFixed(2)} · worst ΔE{" "}
            {(summary.worstDeltaE ?? 0).toFixed(2)}
          </>
        )}
      </footer>
    </div>
  );
}

/**
 * Renders one palette row. Intra-package helper — surface
 * (color swatch + hex + status + match controls) is intentionally
 * minimal so {@link PaletteToSpotPanel} can swap it without
 * downstream consumers depending on the shape.
 */
function PaletteRow({
  row,
  onMatch,
  onCommit,
}: {
  row: PaletteToSpotRow;
  onMatch: () => void;
  onCommit: (() => void) | undefined;
}): ReactElement {
  return (
    <li
      data-testid={`palette-to-spot-row-${row.color.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.375rem 0.5rem",
        borderBottom: "1px solid #eee",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 18,
          height: 18,
          borderRadius: 3,
          border: "1px solid #ccc",
          background: row.color.hex,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, fontSize: "0.8125rem" }}>
        <div style={{ fontWeight: 500 }}>
          {row.color.name ?? row.color.hex}
          {row.color.usageCount !== undefined && (
            <span style={{ color: "#595959", fontWeight: 400 }}> · {row.color.usageCount}×</span>
          )}
        </div>
        {row.status === "matched" && row.bestMatch && (
          <div style={{ fontSize: "0.75rem", color: "#595959" }}>
            {row.bestMatch.spot.name} · ΔE {row.bestMatch.deltaE.toFixed(2)}
          </div>
        )}
        {row.status === "error" && (
          <div role="alert" style={{ fontSize: "0.75rem", color: "#a00" }}>
            {row.errorMessage}
          </div>
        )}
      </div>
      {row.status === "loading" ? (
        <output style={{ fontSize: "0.75rem", color: "#595959" }}>…</output>
      ) : (
        <>
          <button
            type="button"
            onClick={onMatch}
            style={{ fontSize: "0.6875rem", padding: "0.0625rem 0.375rem" }}
          >
            {row.status === "matched" ? "Re-match" : "Match"}
          </button>
          {onCommit && row.status === "matched" && row.bestMatch && (
            <button
              type="button"
              onClick={onCommit}
              style={{ fontSize: "0.6875rem", padding: "0.0625rem 0.375rem" }}
            >
              Convert
            </button>
          )}
        </>
      )}
    </li>
  );
}
