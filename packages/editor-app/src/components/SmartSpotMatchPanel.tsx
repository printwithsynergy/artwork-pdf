// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 AI2 — Smart spot-match panel.
 *
 * Resolves a user-picked CMYK / Lab / hex color to a ranked list of
 * nearest-PANTONE candidates via a host-supplied loader (typically
 * fronting compile-pdf's `/v1/spots/match` endpoint or a tenant-local
 * ΔE engine). Each match carries the canonical {@link Spot} entry +
 * its ΔE distance from the query so the picker can render
 * "good / borderline / poor" cues without the editor doing color
 * math itself.
 *
 * Sibling of {@link SwatchesPicker} — that one searches the PANTONE
 * catalogue by name, this one searches it by color value. Pairs with
 * the AI4 `registerSpot` flow (Wave 1) — clicking a match feeds the
 * selected `Spot` into the host's separations registry.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Spot } from "./SwatchesPicker";

/**
 * One color-space query the loader recognizes. At least one of
 * `cmyk` / `lab` / `hex` must be present. The host's loader picks
 * the most accurate space available (Lab > CMYK > hex) when more
 * than one is supplied.
 *
 * @public
 */
export type SpotMatchQuery = {
  /** Percent CMYK in `[0, 100]` per channel. */
  cmyk?: readonly [number, number, number, number];
  /** CIE Lab — L in `[0, 100]`, a/b roughly `[-128, 128]`. */
  lab?: readonly [number, number, number];
  /** 7-char sRGB hex including the leading `#` (e.g. `"#ff5102"`). */
  hex?: string;
  /** Optional cap on the number of returned matches; loaders that
   *  ignore it must still return a stable ordering. */
  limit?: number;
};

/**
 * One ranked match — the canonical PANTONE entry + its ΔE distance
 * from the query. The panel sorts matches ascending on `deltaE`
 * (best first) via {@link sortMatchesByDeltaE}.
 *
 * @public
 */
export type SpotMatch = {
  spot: Spot;
  /** CIE ΔE distance. Smaller is better; under ~1 is "imperceptible",
   *  1–3 is "noticeable", >5 is "poor". */
  deltaE: number;
};

/**
 * Host adapter — resolves a {@link SpotMatchQuery} to a ranked list
 * of {@link SpotMatch} candidates. Rejects on transport / validation
 * errors and the panel surfaces the message inline. Hosts should
 * memoize the function with `useCallback` so an unrelated parent
 * re-render doesn't trigger a spurious refetch.
 *
 * @public
 */
export type SpotMatchLoaderFn = (query: SpotMatchQuery) => Promise<readonly SpotMatch[]>;

/**
 * Configuration for the {@link SmartSpotMatchPanel}. The host always
 * supplies the {@link SpotMatchLoaderFn}; the other three props are
 * optional and shape the panel's initial state and selection
 * behaviour. Hosts that want to drive the query from outside the
 * panel (e.g. wire the active fill colour straight in) flow that
 * through `initialQuery`; the panel re-derives its query whenever
 * `initialQuery`'s content changes.
 *
 * @public
 */
export type SmartSpotMatchPanelProps = {
  /** Host adapter, see {@link SpotMatchLoaderFn}. */
  loader: SpotMatchLoaderFn;
  /** Optional initial query — pre-fills the form. Hosts wire this to
   *  the active object's fill / stroke color when the user opens the
   *  panel from a swatch chip. */
  initialQuery?: SpotMatchQuery;
  /** Optional cap on returned matches. Defaults to 12 — enough to
   *  cover the standard `5 ΔE` neighborhood without overwhelming the
   *  scroll surface. */
  limit?: number;
  /** Click callback. Receives the full {@link SpotMatch} so hosts
   *  can wire it into a separations registry / fill picker. */
  onSelect?: (match: SpotMatch) => void;
};

/**
 * Pure helper — sorts a `SpotMatch` list ascending on `deltaE`
 * (best-first). Stable on ties: input order preserved. Returns a
 * new array.
 *
 * @public
 */
export function sortMatchesByDeltaE(matches: readonly SpotMatch[]): readonly SpotMatch[] {
  return [...matches]
    .map((m, i) => ({ m, i }))
    .sort((a, b) => a.m.deltaE - b.m.deltaE || a.i - b.i)
    .map((x) => x.m);
}

/**
 * Pure helper — classifies a ΔE distance into the conventional
 * print-industry quality band so renderers can color-code matches
 * consistently. Thresholds are the standard CIE-1994 perceptual cut
 * points; the panel uses them for the result-row severity chip.
 *
 * @public
 */
export type DeltaEQuality = "imperceptible" | "noticeable" | "fair" | "poor";

/**
 * Pure helper — maps a ΔE distance to a {@link DeltaEQuality} band
 * using the CIE-1994 perceptual cut points (under 1 is
 * imperceptible, 1–3 is noticeable, 3–5 is fair, ≥5 is poor). Used
 * by the panel for the per-row severity chip; exported so hosts can
 * surface the same banding outside the panel (e.g. in a print-proof
 * audit). Returns `"poor"` for non-finite or negative inputs by
 * threshold ordering — callers should pre-validate if they care.
 *
 * @public
 */
export function deltaEQuality(deltaE: number): DeltaEQuality {
  if (!Number.isFinite(deltaE) || deltaE < 0) return "poor";
  if (deltaE < 1) return "imperceptible";
  if (deltaE < 3) return "noticeable";
  if (deltaE < 5) return "fair";
  return "poor";
}

/**
 * Pure helper — formats ΔE for chip / row display (e.g. `"ΔE 1.2"`).
 * Two-decimal precision matches what most ΔE engines emit and what
 * print shops quote.
 *
 * @public
 */
export function formatDeltaE(deltaE: number): string {
  return `ΔE ${deltaE.toFixed(2)}`;
}

/**
 * Pure helper — quickly checks whether a query has at least one
 * color-space populated. Exported so hosts that drive the loader
 * from outside the panel can gate their fetch on the same predicate.
 *
 * @public
 */
export function isQueryReady(query: SpotMatchQuery): boolean {
  return Boolean(query.cmyk || query.lab || query.hex?.trim());
}

const DELTA_E_COLORS: Record<DeltaEQuality, string> = {
  imperceptible: "#080",
  noticeable: "#0a8",
  fair: "#a60",
  poor: "#a00",
};

/**
 * Stateful panel — accepts a CMYK or hex input, calls the host
 * loader, and surfaces ranked matches with ΔE chips. Hosts wire
 * `onSelect` to push the picked spot into the active object's fill
 * / stroke or into the separations registry.
 *
 * @public
 */
export function SmartSpotMatchPanel({
  loader,
  initialQuery,
  limit,
  onSelect,
}: SmartSpotMatchPanelProps): ReactElement {
  const [hex, setHex] = useState(initialQuery?.hex ?? "");
  const [matches, setMatches] = useState<readonly SpotMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Keep the hex input in lockstep with `initialQuery.hex` when the
  // host swaps the active selection — without this, a panel reused
  // for a different object would mix new cmyk / lab with the old
  // hex value in the input.
  useEffect(() => {
    setHex(initialQuery?.hex ?? "");
  }, [initialQuery?.hex]);

  // Stable query object — re-derived only when content changes, not
  // when a parent re-render hands back a referentially-different
  // but content-identical `initialQuery`. The join'd keys identity-
  // compare on content; the raw refs are read inside but excluded
  // from the dep list intentionally.
  const cmykKey = initialQuery?.cmyk?.join(",") ?? "";
  const labKey = initialQuery?.lab?.join(",") ?? "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: cmyk / lab are content-keyed via cmykKey / labKey
  const query: SpotMatchQuery = useMemo(
    () => ({
      ...(hex.trim() && { hex: hex.trim() }),
      ...(initialQuery?.cmyk && { cmyk: initialQuery.cmyk }),
      ...(initialQuery?.lab && { lab: initialQuery.lab }),
      ...(limit !== undefined && { limit }),
    }),
    [hex, cmykKey, labKey, limit],
  );

  useEffect(() => {
    if (!isQueryReady(query)) {
      setMatches(null);
      setError(null);
      setLoading(false);
      return;
    }
    let disposed = false;
    setLoading(true);
    setError(null);
    // Drop the previous result eagerly so stale rows can't be
    // selected for a query that's no longer current.
    setMatches(null);
    void (async () => {
      try {
        const next = await loader(query);
        if (disposed) return;
        setMatches(sortMatchesByDeltaE(next));
      } catch (err: unknown) {
        if (disposed) return;
        setMatches(null);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [loader, query]);

  return (
    <div data-testid="smart-spot-match-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Find PANTONE match</h3>
      </header>
      <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
        sRGB hex
        <input
          type="text"
          aria-label="sRGB hex"
          placeholder="#ff5102"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          style={{ display: "block", marginTop: "0.125rem", width: "100%" }}
        />
      </label>
      {loading && <div style={{ opacity: 0.6, fontSize: "0.75rem" }}>Searching…</div>}
      {error && (
        <div role="alert" style={{ color: "#a00", fontSize: "0.75rem" }}>
          Couldn't fetch matches: {error}
        </div>
      )}
      {matches && matches.length === 0 && !loading && !error && (
        <div style={{ opacity: 0.6, fontSize: "0.75rem" }}>No matches.</div>
      )}
      {matches && matches.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {matches.map((match) => (
            <SmartSpotMatchRow
              key={`${match.spot.library ?? "-"}|${match.spot.name}`}
              match={match}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SmartSpotMatchRow({
  match,
  onSelect,
}: {
  match: SpotMatch;
  onSelect: ((m: SpotMatch) => void) | undefined;
}): ReactElement {
  const quality = deltaEQuality(match.deltaE);
  const chipColor = DELTA_E_COLORS[quality];
  const rowContents = (
    <>
      <span style={{ flex: 1, fontSize: "0.8125rem" }}>{match.spot.name}</span>
      <span
        aria-label={`${formatDeltaE(match.deltaE)} — ${quality}`}
        style={{
          fontSize: "0.6875rem",
          padding: "0.0625rem 0.375rem",
          borderRadius: 999,
          background: chipColor,
          color: "#fff",
        }}
      >
        {formatDeltaE(match.deltaE)}
      </span>
    </>
  );
  const rowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    width: "100%",
    padding: "0.25rem 0.5rem",
    border: "1px solid transparent",
    borderRadius: 4,
    textAlign: "left" as const,
  };
  return (
    <li>
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(match)}
          style={{ ...rowStyle, cursor: "pointer", background: "transparent" }}
          aria-label={match.spot.name}
        >
          {rowContents}
        </button>
      ) : (
        <div style={rowStyle}>{rowContents}</div>
      )}
    </li>
  );
}
