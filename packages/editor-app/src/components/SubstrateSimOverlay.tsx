// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 P2 — Substrate show-through simulation overlay.
 *
 * White artboards hide everything the substrate will affect:
 * kraft tints unprinted regions brown, metallised film reflects
 * through low-opacity art, clear PE shows nothing where ink
 * doesn't cover. P2 paints a substrate-coloured rectangle
 * underneath the canvas so the operator sees what the press will
 * actually deliver before exporting. Pairs with C2 (white
 * underbase) — host can toggle the underbase on/off above this
 * overlay to confirm masking.
 *
 * Pure-render component — host passes the substrate descriptor
 * (mirrors `printContext.substrate`); the overlay is anchored
 * absolutely. Consumers wrap canvas + overlay in a
 * relatively-positioned container with the substrate sim *behind*
 * the canvas (lower z-index).
 *
 * @public
 */

import type { ReactElement } from "react";

/**
 * Substrate descriptor that drives the simulation. Four fields
 * map directly to `printContext.substrate`.
 *
 * @public
 */
export type SubstrateSimSpec = {
  widthPx: number;
  heightPx: number;
  /** CSS color of the substrate (e.g. `"#d2b48c"` kraft,
   *  `"#c0c0c0"` metallised, `"transparent"` clear PE). */
  color: string;
  /** 0..1. 1 = fully opaque (paper); < 1 = substrate colour
   *  shows through unprinted regions but ink dominates printed. */
  opacity: number;
  /** Finish modifier — gloss adds a subtle sheen, satin a
   *  weaker one, matte / uncoated render flat (uncoated adds
   *  faint pulp-paper noise). */
  finish: "matte" | "gloss" | "satin" | "uncoated";
};

/**
 * Props for the {@link SubstrateSimOverlay}.
 *
 * @public
 */
export type SubstrateSimOverlayProps = {
  spec: SubstrateSimSpec;
};

function finishOverlay(finish: SubstrateSimSpec["finish"]): string {
  switch (finish) {
    case "gloss":
      return "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)";
    case "satin":
      return "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 70%)";
    case "matte":
      return "none";
    case "uncoated":
      return "radial-gradient(circle at 30% 20%, rgba(0,0,0,0.04) 0%, transparent 70%)";
  }
}

/**
 * Pure-render substrate simulation overlay.
 *
 * @public
 */
export function SubstrateSimOverlay({ spec }: SubstrateSimOverlayProps): ReactElement {
  const { widthPx, heightPx, color, opacity, finish } = spec;
  return (
    <div
      data-testid="substrate-sim-overlay"
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: widthPx,
        height: heightPx,
        background: color,
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        data-testid="substrate-sim-finish-layer"
        style={{
          position: "absolute",
          inset: 0,
          background: finishOverlay(finish),
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
