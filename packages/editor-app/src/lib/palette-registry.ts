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
  "brand-assets": { slot: "panel.right", label: "Brand Assets" },
  "mark-library": { slot: "panel.right", label: "Marks" },
  "slack-notify": { slot: "panel.right", label: "Slack notify" },
  "preflight-autofix": { slot: "panel.right", label: "Auto-fix" },
  "smart-spot-match": { slot: "panel.right", label: "Spot match" },
  "design-suggestions": { slot: "panel.right", label: "Design suggestions" },
  "annotations-sidebar": { slot: "panel.right", label: "Annotations" },
  "brand-consistency": { slot: "panel.right", label: "Brand consistency" },
  "webhook-notify": { slot: "panel.right", label: "Webhook notify" },
  "email-notify": { slot: "panel.right", label: "Email notify" },
  "accessibility-hints": { slot: "panel.right", label: "Accessibility hints" },
  "palette-to-spot": { slot: "panel.right", label: "Palette → spot" },
  "white-underbase": { slot: "panel.right", label: "White underbase" },
  "streaming-render": { slot: "panel.right", label: "Render progress" },
  "direction-indicators": { slot: "overlay.canvas", label: "Direction indicators" },
  "substrate-sim": { slot: "overlay.canvas", label: "Substrate simulation" },
  "contrast-legibility": { slot: "panel.right", label: "Contrast & legibility" },
  "dam-assets": { slot: "panel.right", label: "DAM assets" },
  "approved-master-diff": { slot: "panel.right", label: "Master diff" },
  "copy-generation": { slot: "panel.right", label: "Copy generator" },
  "image-generation": { slot: "panel.right", label: "Image generator" },
  "auto-layout": { slot: "panel.right", label: "Auto layout" },
  "ocr-rebuild": { slot: "panel.right", label: "OCR rebuild" },
  "localization": { slot: "panel.right", label: "Localization" },
  "design-handoff": { slot: "panel.right", label: "Design handoff" },
  "ecommerce-connector": { slot: "panel.right", label: "Products" },
  "pim-connector": { slot: "panel.right", label: "PIM fields" },
};

/**
 * Ordered list of every {@link PaletteId} — same order as the
 * registry's declaration. Use for stable iteration in UI (the
 * overflow menu, the mobile drawer).
 *
 * @public
 */
export const PALETTE_IDS: PaletteId[] = Object.keys(PALETTE_REGISTRY) as PaletteId[];
