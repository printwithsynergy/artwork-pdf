// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

/**
 * One PANTONE catalogue entry from compile-pdf's `/v1/spots/*`
 * endpoints. Mirrors `SpotEntry` on the apps/service
 * `CompilePdfClient`, kept structural here so editor-app stays
 * apps/service-dep-free.
 *
 * @public
 */
export type Spot = {
  name: string;
  library?: string | null;
  lab?: [number, number, number] | null;
  cmyk_bridge?: [number, number, number, number] | null;
};

/**
 * Search adapter — the editor passes in a function that fronts
 * `CompilePdfClient.spotSearch()`. Threading the search via a prop
 * (rather than calling fetch directly) keeps SwatchesPicker
 * decoupled from the network — tests pass a stub, the demo can
 * preload an in-memory fixture, etc.
 *
 * @public
 */
export type SpotSearchFn = (opts: {
  q?: string;
  library?: string;
  limit?: number;
}) => Promise<{ results: Spot[]; total: number; limit: number }>;

/**
 * Library descriptor — matches the wire shape of one entry in
 * `/v1/spots/libraries`.
 *
 * @public
 */
export type SpotLibrary = {
  id: string;
  count: number;
};

/**
 * Props for the C3 SwatchesPicker palette.
 *
 * `search` is the only required prop; library filter + initial
 * query are optional. `onSelect` fires when the user clicks a
 * swatch — typically wired to AI4's `registerSpot` in the host.
 *
 * `enable_palettes: false` collapses the entire palette system off;
 * hosts mount this component only when `isPanelVisible(config,
 * "swatches")` returns true.
 *
 * @public
 */
export type SwatchesPickerProps = {
  search: SpotSearchFn;
  /** Initial libraries-filter dropdown values. Hosts that already
   *  fetched `spotLibraries()` thread the result here. */
  libraries?: SpotLibrary[];
  /** Optional initial query. */
  initialQuery?: string;
  /** Click callback. Receives the full Spot row. */
  onSelect: (spot: Spot) => void;
};

const PANEL_BG = "#1a0f08";
const BORDER = "#3d1a00";
const BRAND = "#fc5102";
const TEXT = "#f4ece6";
const MUTED = "#888";
const DEBOUNCE_MS = 250;

const inputStyle: CSSProperties = {
  flex: 1,
  padding: "0.4rem 0.6rem",
  background: "#0f0a05",
  border: `1px solid ${BORDER}`,
  borderRadius: 4,
  color: TEXT,
  fontSize: "0.8rem",
  fontFamily: "inherit",
};

/**
 * Right-rail palette for browsing compile-pdf's PANTONE catalogue
 * (codex-pdf's public-domain reference set).
 *
 * UX:
 * - Search input → debounced (250 ms) call to `search()`.
 * - Optional library dropdown (when `libraries` is supplied).
 * - Result list as colored chips with the canonical name; click
 *   fires `onSelect`.
 * - Footer disclaimer ("public-domain reference, not licensed
 *   PANTONE data") — present per the trademark stance.
 *
 * @returns An `<aside>` element with search input, library filter,
 *   results list, and the trademark disclaimer footer.
 * @public
 */
export function SwatchesPicker({
  search,
  libraries,
  initialQuery = "",
  onSelect,
}: SwatchesPickerProps) {
  const [query, setQuery] = useState(initialQuery);
  const [library, setLibrary] = useState<string | "">("");
  const [results, setResults] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    // Debounce — bump the request id and only commit results from
    // the latest call. Prevents stale results overriding fresh ones
    // when the user types quickly.
    const id = ++reqIdRef.current;
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      const opts: Parameters<SpotSearchFn>[0] = { limit: 50 };
      if (query) opts.q = query;
      if (library) opts.library = library;
      search(opts)
        .then((res) => {
          if (id !== reqIdRef.current) return; // stale
          setResults(res.results);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (id !== reqIdRef.current) return;
          const msg = err instanceof Error ? err.message : "spots search failed";
          setError(msg);
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, library, search]);

  return (
    <aside
      style={{
        width: 240,
        background: PANEL_BG,
        borderLeft: `1px solid ${BORDER}`,
        color: TEXT,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: MUTED,
          padding: "0.55rem 0.85rem",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        Swatches
      </div>
      <div style={{ padding: "0.55rem 0.65rem", display: "flex", gap: "0.4rem" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search PANTONE…"
          aria-label="Search PANTONE catalogue"
          style={inputStyle}
        />
      </div>
      {libraries && libraries.length > 0 && (
        <div style={{ padding: "0 0.65rem 0.55rem" }}>
          <select
            value={library}
            onChange={(e) => setLibrary(e.target.value)}
            aria-label="Filter by library"
            style={{ ...inputStyle, width: "100%" }}
          >
            <option value="">All libraries</option>
            {libraries.map((lib) => (
              <option key={lib.id} value={lib.id}>
                {lib.id} ({lib.count})
              </option>
            ))}
          </select>
        </div>
      )}
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading && (
          <div style={{ padding: "0.55rem 0.85rem", color: MUTED, fontSize: "0.78rem" }}>
            Loading…
          </div>
        )}
        {error && !loading && (
          <div
            role="alert"
            style={{ padding: "0.55rem 0.85rem", color: "#ef4444", fontSize: "0.78rem" }}
          >
            {error}
          </div>
        )}
        {!loading && !error && results.length === 0 && (
          <div style={{ padding: "0.55rem 0.85rem", color: MUTED, fontSize: "0.78rem" }}>
            No matches.
          </div>
        )}
        {!loading &&
          !error &&
          results.map((spot) => {
            const swatchColor = labToCssApprox(spot.lab) ?? "#666";
            return (
              <button
                key={spot.name}
                type="button"
                onClick={() => onSelect(spot)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.55rem",
                  width: "100%",
                  padding: "0.35rem 0.85rem",
                  background: "transparent",
                  border: "none",
                  borderLeft: "2px solid transparent",
                  cursor: "pointer",
                  color: TEXT,
                  fontSize: "0.78rem",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderLeftColor = BRAND;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderLeftColor = "transparent";
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 16,
                    height: 16,
                    borderRadius: 3,
                    background: swatchColor,
                    border: `1px solid ${BORDER}`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{spot.name}</span>
              </button>
            );
          })}
      </div>
      <div
        style={{
          padding: "0.45rem 0.85rem",
          borderTop: `1px solid ${BORDER}`,
          color: MUTED,
          fontSize: "0.65rem",
          lineHeight: 1.35,
        }}
      >
        Public-domain colour-science reference. Not licensed PANTONE data.
      </div>
    </aside>
  );
}

/**
 * Crude Lab → CSS-color approximation for the swatch chips. Not a
 * colorimetric conversion — just enough to give each row a
 * recognizable tint in the picker. Returns `undefined` for entries
 * without a Lab triplet (the chip falls back to a neutral grey).
 *
 * Lab L is 0-100 (perceptual lightness); we map directly to sRGB
 * grey then shift slightly toward a/b axes. Future: replace with a
 * proper Lab→sRGB conversion via culori or chroma-js if perceptual
 * accuracy matters for the picker.
 */
function labToCssApprox(lab: [number, number, number] | null | undefined): string | undefined {
  if (!lab) return undefined;
  const [L, a, b] = lab;
  // Very rough — clamps to a tinted grey based on a/b sign.
  const lum = Math.max(0, Math.min(255, Math.round((L / 100) * 255)));
  const r = Math.max(0, Math.min(255, lum + Math.round(a * 1.5)));
  const g = Math.max(0, Math.min(255, lum - Math.round(Math.abs(a) * 0.5)));
  const bl = Math.max(0, Math.min(255, lum - Math.round(b * 1.5)));
  return `rgb(${r}, ${g}, ${bl})`;
}
