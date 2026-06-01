// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { type CSSProperties, useEffect, useState } from "react";

/**
 * Wave 2 C1 — inks palette.
 *
 * Surfaces the live separations registered in the document plus the
 * named inks discovered in the active rendered PDF (via the new
 * compile-pdf `POST /v1/separations/list` endpoint, PR-F). Splits
 * cleanly from the existing swatches palette which still handles
 * PANTONE search:
 *
 *   - **swatches** (PR-7 / C3): catalogue search, "register as spot"
 *   - **inks**    (this panel, C1): the live ink list — what plates
 *     will the compiler actually produce?
 *
 * Adapter pattern: hosts wire an async function that returns the
 * separations list. This keeps the editor package free of any
 * runtime dep on `apps/service`'s `CompilePdfClient`. The host
 * typically passes
 * `(pdfB64) => client.separationsList(pdfB64).then((r) => r.separations)`.
 *
 * @public
 */
export type Ink = {
  /** Display name (e.g. "PANTONE 185 C", "Silver", "Cyan"). */
  name: string;
  /** "Separation" or "DeviceN" — mirrors the wire shape. */
  color_space: "Separation" | "DeviceN";
  /** 0-indexed page numbers on which this ink appears. */
  occurs_on_pages: number[];
};

/**
 * Host-supplied adapter. Returns the inks for `pdfB64` (typically by
 * proxying to `CompilePdfClient.separationsList`). Rejects on
 * transport errors; the panel renders the error inline.
 *
 * **Identity matters.** The panel re-fetches whenever the `loader`
 * reference changes (the standard React-effect dependency rule);
 * hosts that build the adapter inline should memoize it with
 * `useCallback` so an unrelated parent re-render doesn't trigger a
 * spurious `POST /v1/separations/list` round-trip.
 *
 * @public
 */
export type InksLoaderFn = (pdfB64: string) => Promise<readonly Ink[]>;

/**
 * @public
 */
export type InksPanelProps = {
  /** Latest rendered PDF — base64, no `data:` prefix. When
   *  `undefined` the panel shows an "export first" affordance. */
  pdfB64: string | undefined;
  /** Adapter that resolves to the inks list. */
  loader: InksLoaderFn;
  /** Optional callback fired when the user clicks an ink row;
   *  hosts wire this to highlight occurrences on the canvas. */
  onSelect?: (ink: Ink) => void;
};

/**
 * @public
 */
export function InksPanel({ pdfB64, loader, onSelect }: InksPanelProps) {
  const [inks, setInks] = useState<readonly Ink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pdfB64) {
      setInks(null);
      setError(null);
      return;
    }
    let disposed = false;
    setLoading(true);
    setError(null);
    loader(pdfB64)
      .then((next) => {
        if (disposed) return;
        setInks(next);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (disposed) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [pdfB64, loader]);

  if (!pdfB64) {
    return (
      <div data-testid="inks-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        Render the document to see its ink list.
      </div>
    );
  }
  if (loading) {
    return (
      <div data-testid="inks-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        Loading inks…
      </div>
    );
  }
  if (error) {
    return (
      <div data-testid="inks-panel" role="alert" style={{ padding: "0.5rem", color: "#a00" }}>
        Couldn't load inks: {error}
      </div>
    );
  }
  if (!inks || inks.length === 0) {
    return (
      <div data-testid="inks-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        No named separations in this document.
      </div>
    );
  }
  return (
    <div data-testid="inks-panel" style={{ padding: "0.5rem" }}>
      <h3 style={{ margin: "0 0 0.5rem 0" }}>Inks ({inks.length})</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {inks.map((ink) => (
          <li key={ink.name}>
            <button
              type="button"
              onClick={() => onSelect?.(ink)}
              aria-label={`Select ${ink.name}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                width: "100%",
                padding: "0.25rem 0.5rem",
                background: "transparent",
                border: "none",
                cursor: onSelect ? "pointer" : "default",
                textAlign: "left",
              }}
            >
              <span aria-hidden="true" style={swatchStyleFor(ink)} />
              <span style={{ flex: 1 }}>{ink.name}</span>
              <small style={{ opacity: 0.6 }}>
                {ink.color_space} · p{ink.occurs_on_pages.map((p) => p + 1).join(",")}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Best-effort swatch chip. We don't have a Lab→sRGB pipeline in the
 *  editor (codex-pdf owns colour conversion); show a process-color
 *  hint for the common CMYK names and a neutral chip otherwise. */
function swatchStyleFor(ink: Ink): CSSProperties {
  const lower = ink.name.toLowerCase();
  const base: CSSProperties = {
    width: "0.85rem",
    height: "0.85rem",
    borderRadius: "0.15rem",
    border: "1px solid #888",
    flexShrink: 0,
  };
  if (lower.includes("cyan")) return { ...base, background: "#00aeef" };
  if (lower.includes("magenta")) return { ...base, background: "#ec008c" };
  if (lower.includes("yellow")) return { ...base, background: "#fff200" };
  if (lower.includes("black") || lower.includes("key")) return { ...base, background: "#000" };
  return { ...base, background: "#ddd" };
}
