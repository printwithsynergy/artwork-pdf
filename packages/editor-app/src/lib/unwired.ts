// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Unwired-feature registry.
 *
 * A feature is "unwired" when the *flag* exists in {@link EditorConfig}
 * but the corresponding *UI* isn't shipped in this build yet (typical
 * for forward-compatibility plumb-throughs like `enable_separations`
 * — flag preps the surface; component lands in a later wave).
 *
 * Mirrors the pattern from `lens-pdf`. The set is module-scoped and
 * in-memory only — there's no persistence. Components / packages
 * call {@link markUnwired} at module-init time; {@link showFeature}
 * reads via {@link isUnwired} to suppress UI for features whose flag
 * is on but whose implementation hasn't landed.
 */

const UNWIRED = new Set<string>();

/**
 * Mark a feature as "flag exists but UI not shipped". Idempotent.
 *
 * Typical call site is at the bottom of the module that *would*
 * render the UI when wired:
 *
 * ```ts
 * // packages/editor-app/src/components/SeparationsPanel.tsx
 * import { markUnwired } from "../lib/unwired";
 * markUnwired("separations"); // wire-up lands in Wave 1
 * ```
 *
 * @public
 */
export function markUnwired(feature: string): void {
  UNWIRED.add(feature);
}

/**
 * Test whether a feature has been marked unwired. Used by
 * {@link import("./editor-config").showFeature}; hosts generally
 * don't need to call this directly.
 *
 * @public
 */
export function isUnwired(feature: string): boolean {
  return UNWIRED.has(feature);
}

/**
 * Test-only — clear the unwired set. Not exported through the
 * public barrel.
 */
export function _resetUnwiredForTests(): void {
  UNWIRED.clear();
}
