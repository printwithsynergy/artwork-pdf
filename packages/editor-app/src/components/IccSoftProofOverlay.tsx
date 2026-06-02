// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 2 PR-6 (C5) — ICC soft-proof overlay.
 *
 * Surfaces compile-pdf's per-pixel delta-E map (source ICC →
 * destination ICC, simulated through the selected rendering intent)
 * as a heat overlay on top of the canvas, plus a footer chip showing
 * `max / avg deltaE`. Workflow:
 *
 *  1. Host rasterizes the active page + collects the source +
 *     destination ICC profiles + intent.
 *  2. Host hands the `loader` adapter to the overlay; the adapter
 *     POSTs to compile-pdf's `/v1/soft-proof/apply` (Wave 2 PR-G).
 *  3. The overlay paints the returned delta-E ImageData on a
 *     positioned canvas, recomputing every time the inputs change.
 *
 * Adapter pattern (matches {@link ComplianceFindingsPanel}): hosts
 * wire the HTTP client themselves so this package stays free of a
 * compile-pdf runtime dep.
 *
 * @public
 */
import { useEffect, useRef, useState } from "react";

/**
 * ICC rendering intent — mirrors the four ICC v4 intents that
 * compile-pdf's soft-proof producer accepts.
 *
 * @public
 */
export type SoftProofIntent =
  | "perceptual"
  | "relative-colorimetric"
  | "saturation"
  | "absolute-colorimetric";

/**
 * Result shape returned by an {@link IccSoftProofLoaderFn}. `deltaE`
 * is a per-pixel ImageData (R = clamped deltaE * 4, G/B = 0, A = 255)
 * the overlay paints over the canvas; `max` / `avg` drive the footer
 * chip. Keeping max/avg outside the ImageData lets the host compute
 * them server-side without re-walking the buffer on the client.
 *
 * @public
 */
export type IccSoftProofResult = {
  deltaE: ImageData;
  max: number;
  avg: number;
};

/**
 * Host-supplied adapter. Receives the rasterized document + source /
 * destination ICC profiles + rendering intent; returns the delta-E
 * heatmap. Rejects on transport errors; the overlay surfaces the
 * message inline.
 *
 * **Identity matters.** The overlay re-fetches whenever the `loader`
 * reference changes; hosts that build the adapter inline should
 * memoize it with `useCallback` so an unrelated parent re-render
 * doesn't trigger a spurious `POST /v1/soft-proof/apply` round-trip.
 *
 * @public
 */
export type IccSoftProofLoaderFn = (input: {
  documentB64: string;
  sourceProfile: string;
  destinationProfile: string;
  intent: SoftProofIntent;
}) => Promise<IccSoftProofResult>;

/**
 * @public
 */
export type IccSoftProofOverlayProps = {
  /** Latest rendered document (base64 PDF) or `undefined` while
   *  the host has nothing to soft-proof. */
  documentB64: string | undefined;
  /** Source ICC profile name (e.g. `"ISOcoated_v2_eci"`). */
  sourceProfile: string | undefined;
  /** Destination ICC profile name (e.g. `"USWebUncoated"`). */
  destinationProfile: string | undefined;
  /** Rendering intent. Defaults to `"relative-colorimetric"` when
   *  the host doesn't supply one. */
  intent?: SoftProofIntent;
  /** Adapter that resolves to the delta-E result. */
  loader: IccSoftProofLoaderFn;
  /** Pixel width of the overlay (= the rasterized canvas width).
   *  The overlay draws the deltaE ImageData 1:1. */
  width: number;
  /** Pixel height of the overlay. */
  height: number;
};

const FOOTER_BG = "rgba(0,0,0,0.65)";
const FOOTER_TEXT = "#f4ece6";

/**
 * @public
 */
export function IccSoftProofOverlay({
  documentB64,
  sourceProfile,
  destinationProfile,
  intent = "relative-colorimetric",
  loader,
  width,
  height,
}: IccSoftProofOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ max: number; avg: number } | null>(null);

  useEffect(() => {
    if (!documentB64 || !sourceProfile || !destinationProfile) {
      setStats(null);
      setError(null);
      return;
    }
    let disposed = false;
    setLoading(true);
    setError(null);
    // Wrap the loader call in an async IIFE so synchronous throws
    // from the adapter (e.g. host-side input validation) flow into
    // the same `setError` path as a rejected Promise — otherwise
    // the throw would escape the effect and leave the overlay stuck.
    void (async () => {
      try {
        const result = await loader({
          documentB64,
          sourceProfile,
          destinationProfile,
          intent,
        });
        if (disposed) return;
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) ctx.putImageData(result.deltaE, 0, 0);
        setStats({ max: result.max, avg: result.avg });
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
  }, [documentB64, sourceProfile, destinationProfile, intent, loader]);

  if (!documentB64 || !sourceProfile || !destinationProfile) return null;

  return (
    <div
      data-testid="icc-soft-proof-overlay"
      style={{ position: "relative", width, height, pointerEvents: "none" }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          // Multiply blend so the heatmap reads as a tint over the
          // canvas rather than replacing it — matches how the C4 TAC
          // overlay composites.
          mixBlendMode: "multiply",
          opacity: 0.7,
        }}
      />
      <div
        role="status"
        style={{
          position: "absolute",
          right: 8,
          bottom: 8,
          padding: "2px 8px",
          background: FOOTER_BG,
          color: FOOTER_TEXT,
          borderRadius: 4,
          fontSize: "0.7rem",
          fontFamily: "monospace",
        }}
      >
        {loading
          ? "soft-proofing…"
          : error
            ? `soft-proof failed: ${error}`
            : stats
              ? `ΔE max ${stats.max.toFixed(1)} · avg ${stats.avg.toFixed(1)}`
              : null}
      </div>
    </div>
  );
}
