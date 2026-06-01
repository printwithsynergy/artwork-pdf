// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { rasterizeStage } from "../lib/rasterize";

/**
 * C4 live total-area-coverage overlay.
 *
 * Sits as an absolutely-positioned `<canvas>` on top of the Konva
 * Stage, debouncing a rasterize-and-sample pass on every change to
 * the watched objects array. Paints pixels whose TAC exceeds the
 * configured threshold (default 300%) in translucent red — a "where
 * the ink is going to pool" hint — and shows a `max / avg` chip in
 * the bottom-left.
 *
 * Browser-side sanity check, not a colorimetric proof: the same
 * caveats as {@link import("../lib/rasterize").sampleTACFromImageData}
 * apply (subtractive sRGB → CMYK with K-extraction, alpha composited
 * onto an opaque white background). Production TAC enforcement lives
 * server-side in compile-pdf's `total_ink_coverage` preflight rule.
 *
 * @public
 */
export type TacOverlayProps = {
  /** Live Konva Stage. The overlay no-ops while this is `null` (the
   *  ref starts null on first render). */
  stage: Konva.Stage | null;
  /** Container width/height in CSS pixels — the overlay canvas
   *  matches these so it lines up with the Stage. */
  width: number;
  height: number;
  /** Re-sample trigger. Any change to this value (by reference for
   *  arrays, by equality for primitives) debounces a new rasterize
   *  pass. The value itself isn't read — it just lets React's effect
   *  diffing detect editor changes. Pass `objects` (the canvas
   *  contents array) so every commit re-samples. */
  trigger: unknown;
  /** TAC threshold in percent (0-400). Pixels at or above the
   *  threshold are painted; pixels below are transparent. Defaults to
   *  300% — the standard coated-stock preflight ceiling. */
  thresholdPct?: number;
  /** Debounce window in milliseconds before a new sample fires.
   *  Defaults to 250 ms — fast enough to feel live, slow enough that
   *  click-drag operations don't thrash the rasterizer. */
  debounceMs?: number;
};

/**
 * @public
 */
export function TacOverlay({
  stage,
  width,
  height,
  trigger,
  thresholdPct = 300,
  debounceMs = 250,
}: TacOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [readout, setReadout] = useState<{ maxPct: number; avgPct: number } | null>(null);

  useEffect(() => {
    // `trigger` is intentionally read here (no-op `void` cast) so the
    // exhaustive-deps lint sees it as used; the actual value is never
    // consumed — only its identity change is meaningful.
    void trigger;
    if (!stage || width <= 0 || height <= 0) {
      setReadout(null);
      return;
    }
    const handle = setTimeout(() => {
      let image: ImageData;
      try {
        image = rasterizeStage(stage);
      } catch {
        // Stage's 2d context occasionally fails to acquire during
        // teardown (unmount race); silently skip — next change will
        // try again.
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      // Match the source image so writes are 1:1 — the canvas CSS
      // size is what scales it back to the displayed Stage area.
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // One fused pass: sample TAC per pixel inline AND paint the
      // overlay where TAC crosses the threshold. We can't reuse the
      // shared sampler's `perPixelPct` for the threshold check
      // because that array clamps the 0-400 % range to a byte
      // (255 = ≥255 %), which collapses every pixel above the
      // default 300 % threshold to a single bucket; honest threshold
      // checks need the un-truncated percentage here.
      const src = image.data;
      const overlay = ctx.createImageData(image.width, image.height);
      const dst = overlay.data;
      const pixelCount = image.width * image.height;
      let maxPct = 0;
      let sumPct = 0;
      for (let p = 0, i = 0; p < src.length; p += 4, i++) {
        // Pre-multiply with opaque white background so semi-
        // transparent pixels reflect printable ink. Mirrors the
        // canonical sampler's composite step.
        const a = (src[p + 3] ?? 255) / 255;
        const inv = 1 - a;
        const r = ((src[p] ?? 0) * a + 255 * inv) / 255;
        const g = ((src[p + 1] ?? 0) * a + 255 * inv) / 255;
        const b = ((src[p + 2] ?? 0) * a + 255 * inv) / 255;
        const k = 1 - Math.max(r, g, b);
        let c = 0;
        let m = 0;
        let y = 0;
        if (k < 1) {
          const scale = 1 - k;
          c = (1 - r - k) / scale;
          m = (1 - g - k) / scale;
          y = (1 - b - k) / scale;
        }
        const tac = (c + m + y + k) * 100;
        if (tac > maxPct) maxPct = tac;
        sumPct += tac;
        if (tac >= thresholdPct) {
          const j = i * 4;
          dst[j] = 220; // R
          dst[j + 1] = 38; // G
          dst[j + 2] = 38; // B
          // Alpha scales linearly from 64 at threshold to 192 at
          // (threshold + 100 %), so a 305 % pixel barely glows but
          // a 400 % pixel screams. Clamped to keep the red readable
          // over busy artwork.
          const intensity = Math.min(192, 64 + (tac - thresholdPct) * 1.28);
          dst[j + 3] = intensity;
        }
      }
      ctx.putImageData(overlay, 0, 0);
      setReadout({ maxPct, avgPct: pixelCount > 0 ? sumPct / pixelCount : 0 });
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [stage, width, height, trigger, thresholdPct, debounceMs]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: `${width}px`,
          height: `${height}px`,
          pointerEvents: "none",
        }}
      />
      {readout !== null && (
        <output
          aria-label="Total area coverage"
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            padding: "0.25rem 0.5rem",
            background: "rgba(15, 23, 42, 0.78)",
            color: "#f8fafc",
            fontSize: "0.7rem",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            borderRadius: 4,
            pointerEvents: "none",
            lineHeight: 1.3,
          }}
        >
          <div>TAC max {readout.maxPct.toFixed(0)}%</div>
          <div style={{ opacity: 0.75 }}>avg {readout.avgPct.toFixed(0)}%</div>
        </output>
      )}
    </>
  );
}
