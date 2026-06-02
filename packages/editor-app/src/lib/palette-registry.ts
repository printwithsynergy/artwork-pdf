// SPDX-License-Identifier: AGPL-3.0-or-later

import type { PaletteId } from "./editor-config";

/**
 * Static metadata for one entry in the palette registry.
 *
 * `slot` follows lens-pdf's `<vendor>.<area>.<feature>` convention —
 * `panel.right` for right-rail panels, `panel.left` for left-rail,
 * `panel.modal` for modal-style panels. The convention lets future
 * host-side plugin systems route palettes to the right region
 * without hard-coding ids.
 *
 * `label` is the human-readable name shown in the PaletteManager
 * overflow and the mobile drawer "Panels" section.
 *
 * @public
 */
export type PaletteRegistryEntry = {
  slot: string;
  label: string;
};

/**
 * The canonical map of every {@link PaletteId} the editor knows about,
 * keyed for fast lookup by `PaletteManager` / `MobileToolDrawer`.
 *
 * `layers` and `preflight` are wired in the current EditorApp; the
 * other ids are registered for forward compatibility — Wave 1+
 * components will mount them and (where the flag exists but the UI
 * doesn't yet) call `markUnwired(...)`.
 *
 * @public
 */
export const PALETTE_REGISTRY: Record<PaletteId, PaletteRegistryEntry> = {
  layers: { slot: "panel.right", label: "Layers" },
  preflight: { slot: "panel.right", label: "Preflight" },
  "dieline-library": { slot: "panel.modal", label: "Dieline Library" },
  "dieline-parameters": { slot: "panel.right", label: "Dieline Parameters" },
  "dieline-preview": { slot: "panel.right", label: "Dieline Preview" },
  swatches: { slot: "panel.right", label: "Swatches" },
  inks: { slot: "panel.right", label: "Inks" },
  "graphic-styles": { slot: "panel.right", label: "Graphic Styles" },
  history: { slot: "panel.right", label: "History" },
  "fold-preview": { slot: "panel.modal", label: "3D Fold Preview" },
  "variant-matrix": { slot: "panel.modal", label: "Variants" },
  "process-rules": { slot: "panel.right", label: "Process Rules" },
  "preflight-diff": { slot: "panel.right", label: "Preflight Diff" },
};

/**
 * Ordered list of every {@link PaletteId} — same order as the
 * registry's declaration. Use for stable iteration in UI (the
 * overflow menu, the mobile drawer).
 *
 * @public
 */
export const PALETTE_IDS: PaletteId[] = Object.keys(PALETTE_REGISTRY) as PaletteId[];
