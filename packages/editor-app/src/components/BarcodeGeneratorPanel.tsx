// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 3 G2g — Barcode generator panel.
 *
 * Companion to the Wave 1 G2v {@link import("../lib/barcode-scan").scanBarcodes}
 * + {@link import("../lib/barcode-scan").validateBarcode} surface. G2v
 * inspects barcodes the user has already placed on the canvas; G2g
 * lets the user *generate* a new one — they pick a format, type the
 * payload, and the host's `renderer` adapter resolves the bitmap.
 * The panel emits the rendered bitmap via `onRendered` so the host
 * places it as a `CanvasObj`.
 *
 * Adapter pattern (matches Wave 2 PR-6 / PR-8 components): hosts
 * wire the rendering backend themselves. This keeps the editor
 * package free of a runtime dep on a specific barcode library and
 * lets server-side renderers (compile-pdf, codex-pdf) be the
 * canonical source of truth when the host prefers PDF/X-4 exact
 * vector output over a client-rendered raster.
 *
 * @public
 */
import { useState } from "react";

import { ALL_BARCODE_FORMATS, type BarcodeFormat } from "../lib/barcode-scan";

/**
 * Result returned by a {@link BarcodeRenderFn}. `bitmap` is an
 * ImageData the host paints onto the canvas; `widthMm` / `heightMm`
 * tell the host how big to place it.
 *
 * @public
 */
export type BarcodeRenderResult = {
  bitmap: ImageData;
  widthMm: number;
  heightMm: number;
};

/**
 * Host-supplied renderer. Takes a format + payload + optional
 * sizing hints and returns the bitmap. Rejects on invalid payload
 * (host-side check-digit / GS1 AI sequence validation) or
 * transport errors when the renderer is server-backed; the panel
 * surfaces the message inline.
 *
 * **Identity matters.** The panel does not memoize `renderer`; if
 * the host builds the adapter inline it should wrap with
 * `useCallback` so the panel doesn't refire the renderer on every
 * parent re-render.
 *
 * @public
 */
export type BarcodeRenderFn = (input: {
  format: BarcodeFormat;
  payload: string;
  widthMm?: number;
  heightMm?: number;
}) => Promise<BarcodeRenderResult>;

/**
 * @public
 */
export type BarcodeGeneratorPanelProps = {
  /** Renderer the panel calls on "Generate". */
  renderer: BarcodeRenderFn;
  /** Fired with the rendered bitmap so the host can place it on the canvas. */
  onRendered: (result: BarcodeRenderResult) => void;
  /** Restrict the format dropdown to a subset; defaults to every
   *  format supported by {@link BarcodeFormat}. */
  allowedFormats?: readonly BarcodeFormat[];
};

/**
 * Interactive barcode generation panel. Users pick a format from the
 * dropdown, type the payload, optionally constrain the physical
 * dimensions in millimetres, and click **Generate**. The panel calls
 * the host-supplied `renderer` adapter and emits the resulting
 * bitmap via `onRendered`; the host then places it on the canvas as
 * a `CanvasObj`. Renderer rejections surface inline in an `alert`
 * region — the panel never throws to the host.
 *
 * @public
 */
export function BarcodeGeneratorPanel({
  renderer,
  onRendered,
  allowedFormats,
}: BarcodeGeneratorPanelProps) {
  // Fall back to the full format list when the host passes `undefined`
  // *or* an empty array. An empty array would otherwise render a
  // select with no options against a still-valid `format` state, which
  // confuses both keyboard users and the host's `onRendered` flow.
  const formats: readonly BarcodeFormat[] =
    allowedFormats && allowedFormats.length > 0 ? allowedFormats : ALL_BARCODE_FORMATS;
  const [format, setFormat] = useState<BarcodeFormat>(formats[0] ?? "EAN-13");
  const [payload, setPayload] = useState("");
  const [widthMm, setWidthMm] = useState<number | undefined>(undefined);
  const [heightMm, setHeightMm] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!payload.trim()) {
      setError("Payload is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await renderer({
        format,
        payload: payload.trim(),
        ...(widthMm !== undefined && { widthMm }),
        ...(heightMm !== undefined && { heightMm }),
      });
      onRendered(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="barcode-generator-panel" style={{ padding: "0.5rem" }}>
      <h3 style={{ margin: "0 0 0.5rem 0" }}>Generate barcode</h3>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Format
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as BarcodeFormat)}
          style={{ marginLeft: "0.5rem" }}
        >
          {formats.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Payload
        <input
          type="text"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          aria-label="Barcode payload"
          style={{ marginLeft: "0.5rem", width: "20em" }}
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Width (mm, optional)
        <input
          type="number"
          min="0"
          step="0.1"
          value={widthMm ?? ""}
          onChange={(e) => {
            // Empty input clears the hint — the renderer falls back
            // to its default sizing, which is format-dependent (EAN-13
            // = 37.29 × 25.93 mm at 100% magnification, GS1-128 is
            // payload-length-dependent, etc.). Don't pin a number
            // here because the panel doesn't know which renderer
            // backend is wired. The NaN guard catches paste / a11y
            // tool / programmatic-DOM cases where `type="number"`
            // browser validation is bypassed and a non-numeric string
            // reaches `Number()`.
            const v = e.target.value;
            const num = Number(v);
            setWidthMm(v === "" || Number.isNaN(num) ? undefined : num);
          }}
          style={{ marginLeft: "0.5rem" }}
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Height (mm, optional)
        <input
          type="number"
          min="0"
          step="0.1"
          value={heightMm ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            const num = Number(v);
            setHeightMm(v === "" || Number.isNaN(num) ? undefined : num);
          }}
          style={{ marginLeft: "0.5rem" }}
        />
      </label>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={busy}
        style={{ padding: "0.4rem 0.8rem" }}
      >
        {busy ? "Generating…" : "Generate"}
      </button>
      {error && (
        <div role="alert" style={{ marginTop: "0.5rem", color: "#a00" }}>
          {error}
        </div>
      )}
    </div>
  );
}
