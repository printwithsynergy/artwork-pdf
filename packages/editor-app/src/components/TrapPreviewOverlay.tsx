// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * One trap operation as predicted by the D1 preview pass. Pixel-space
 * rectangle in PDF points (1 pt = 1/72 in) plus the source/destination
 * ink names.
 *
 * Mirrors compile-pdf's `trap_diff.operations[i]` shape (see
 * `apps/service/src/compile-pdf-client.ts`'s `TrapOperation`). Kept
 * inline here so the published editor package has no runtime dep on
 * apps/service.
 *
 * @public
 */
export type TrapPreviewOperation = {
  page_index: number;
  rect_pt: [number, number, number, number];
  from_ink: string;
  to_ink: string;
  width_pt?: number;
};

/**
 * Pluggable preview fetcher. Hosts inject this so the editor never
 * imports `CompilePdfClient` directly — matches the
 * {@link import("./SwatchesPicker").SpotSearchFn} adapter pattern.
 *
 * @public
 */
export type TrapPreviewFn = () => Promise<{
  operations: TrapPreviewOperation[];
}>;

/**
 * @public
 */
export type TrapPreviewOverlayProps = {
  /** Container width / height in CSS pixels — the overlay canvas
   *  matches these so it aligns with the Konva Stage underneath. */
  width: number;
  height: number;
  /** 1-indexed page number to render. The trap-diff payload may carry
   *  operations for many pages; the overlay only draws this page. */
  pageIndex: number;
  /** Stage scale × DPR-equivalent factor: how many CSS pixels one PDF
   *  point occupies. The component multiplies `rect_pt` by this to
   *  position each trap rectangle on the overlay. */
  pointsToPx: number;
  /** Re-fetch trigger — change this value to debounce a new preview
   *  pass. The value itself isn't read. Pass the editor's `objects`
   *  array or a policy-version counter. */
  trigger: unknown;
  /** Async fetcher returning the trap operations for the current
   *  document + policy. Hosts wire this to
   *  `CompilePdfClient.trapPreview()` and a serialized canvas PDF. */
  previewFn: TrapPreviewFn | null;
  /** Debounce window in milliseconds. Defaults to 500 — slower than
   *  C4's 250 ms because the trap preview is a server round trip. */
  debounceMs?: number;
};

/**
 * D1 background trap-preview overlay.
 *
 * Sits as an absolutely-positioned `<canvas>` on top of the Konva
 * Stage, debouncing calls to a host-supplied
 * {@link TrapPreviewFn} on every change to the `trigger` prop. Paints
 * a translucent cyan band over each predicted trap region from the
 * server's trap-diff so users see where ink spreading / choking will
 * happen before submitting a full render.
 *
 * Approximate preview — uses the metadata-only `/v1/trap/preview`
 * endpoint (compile-pdf PR #38) which runs the same trap analysis as
 * `/trap/apply` but skips the PDF write. Users wanting bit-exact
 * preview must still run a full job.
 *
 * @public
 */
export function TrapPreviewOverlay({
  width,
  height,
  pageIndex,
  pointsToPx,
  trigger,
  previewFn,
  debounceMs = 500,
}: TrapPreviewOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [opsCount, setOpsCount] = useState<number | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    // `trigger` is intentionally read here (no-op `void` cast) so the
    // exhaustive-deps lint sees it as used; the actual value is never
    // consumed — only its identity change is meaningful.
    void trigger;
    if (!previewFn || width <= 0 || height <= 0) {
      setOpsCount(null);
      return;
    }
    reqIdRef.current += 1;
    const myReqId = reqIdRef.current;
    const handle = setTimeout(async () => {
      let result: Awaited<ReturnType<TrapPreviewFn>>;
      try {
        result = await previewFn();
      } catch {
        // Network / server failure — clear the overlay and stop. We
        // don't surface the error because trap preview is advisory;
        // failures shouldn't block editing.
        if (myReqId === reqIdRef.current) setOpsCount(null);
        return;
      }
      // Stale-response guard: a newer request fired while this one
      // was in-flight; drop the result.
      if (myReqId !== reqIdRef.current) return;

      const pageOps = result.operations.filter((o) => o.page_index === pageIndex - 1);
      setOpsCount(pageOps.length);

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(14, 165, 233, 0.45)";
      for (const op of pageOps) {
        const [llx, lly, urx, ury] = op.rect_pt;
        const x = llx * pointsToPx;
        // PDF coords are y-up from bottom; canvas coords are y-down
        // from top. Mirror against the container height so traps land
        // where the user sees them on screen.
        const y = canvas.height - ury * pointsToPx;
        const w = (urx - llx) * pointsToPx;
        const h = (ury - lly) * pointsToPx;
        ctx.fillRect(x, y, w, h);
      }
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [width, height, pageIndex, pointsToPx, trigger, previewFn, debounceMs]);

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
      {opsCount !== null && opsCount > 0 && (
        <output
          aria-label="Trap preview operations"
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            padding: "0.25rem 0.5rem",
            background: "rgba(14, 116, 144, 0.85)",
            color: "#f0f9ff",
            fontSize: "0.7rem",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            borderRadius: 4,
            pointerEvents: "none",
          }}
        >
          {opsCount} trap{opsCount === 1 ? "" : "s"}
        </output>
      )}
    </>
  );
}
