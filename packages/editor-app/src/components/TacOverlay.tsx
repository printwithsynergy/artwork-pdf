// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { rasterizeStage, sampleTACFromImageData } from "../lib/rasterize";

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
      const { maxPct, avgPct, perPixelPct } = sampleTACFromImageData(image);
      setReadout({ maxPct, avgPct });

      const canvas = canvasRef.current;
      if (!canvas) return;
      // Match the source image so writes are 1:1 — the canvas CSS
      // size is what scales it back to the displayed Stage area.
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Paint a red overlay only where TAC ≥ threshold. Below
      // threshold = fully transparent so the artwork shows through.
      const overlay = ctx.createImageData(image.width, image.height);
      const data = overlay.data;
      // perPixelPct is 0-255 (clamped); convert threshold to the
      // same scale once outside the hot loop.
      const thresholdByte = Math.min(255, Math.max(0, Math.round(thresholdPct)));
      for (let i = 0; i < perPixelPct.length; i++) {
        const v = perPixelPct[i] ?? 0;
        if (v >= thresholdByte) {
          const j = i * 4;
          data[j] = 220; // R
          data[j + 1] = 38; // G
          data[j + 2] = 38; // B
          // Alpha scales from 64 (at threshold) to 192 (at 4x ink),
          // so a 305% pixel barely glows but a 380% pixel screams.
          const intensity = Math.min(192, 64 + (v - thresholdByte) * 2);
          data[j + 3] = intensity;
        }
      }
      ctx.putImageData(overlay, 0, 0);
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
