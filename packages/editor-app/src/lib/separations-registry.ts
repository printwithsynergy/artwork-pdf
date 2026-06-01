// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Per-page registry of named spot inks the editor has identified.
 *
 * AI4 ("palette → spot") feeds this registry every time the user
 * marks a fill or stroke color as a spot ink. The list rides on the
 * page (see `Page.separations` in `dieline-template.ts`) and gets
 * threaded through to compile-pdf via the
 * `JobSubmitRequest.separationsOverride` field — bypassing the
 * renderer's inference of separations from the document content.
 *
 * Wave 1 PR-7 (C3 SwatchesPicker) adds a "from library" flow that
 * pre-fills `pantone` + `lab` via the compile-pdf spots endpoint.
 * For now, the registry handles ad-hoc registration with whatever
 * metadata the user has (a name, optionally a Pantone code).
 *
 * The helpers in this file are pure — they take an array and return
 * a new array. State is owned by the caller (Page / EditorApp).
 */

/**
 * Editor-side mirror of `@artworkpdf/document-model`'s `Separation`.
 *
 * Kept structural (not an import from document-model) so the
 * editor-app package stays consumable by hosts that don't pull
 * document-model in. The wire serialization is structurally
 * compatible — when the export builder populates
 * `separationsOverride` on the job request, an `EditorSeparation[]`
 * satisfies the document-model `Separation[]` shape.
 *
 * @public
 */
export type EditorSeparation = {
  /** Display name and the channel identity (e.g. `"PANTONE 185 C"`). */
  name: string;
  /** PDF color space. Spots use `"Spot"`; process inks use `"CMYK"`. */
  colorSpace: "CMYK" | "Spot" | "DeviceN" | "RGB" | "Gray";
  /** The source hex this spot was registered from (`#fc5102`). */
  hex: string;
  /** Canonical Pantone reference name, when known. */
  pantone?: string;
  /** Measured Lab triplet, when known (filled by C3's SwatchesPicker). */
  lab?: { L: number; a: number; b: number };
  /** Channel type — informs the renderer's downstream handling. */
  type?: "ink" | "varnish" | "foil" | "emboss" | "white";
};

/**
 * Options accepted by {@link registerSpot} beyond the required name.
 *
 * @public
 */
export type RegisterSpotOptions = {
  pantone?: string;
  lab?: { L: number; a: number; b: number };
  type?: EditorSeparation["type"];
  colorSpace?: EditorSeparation["colorSpace"];
};

/**
 * Add (or replace) a spot keyed by `hex`. Idempotent — registering
 * the same hex twice updates the existing entry rather than
 * appending a duplicate. Comparison is case-insensitive.
 *
 * @returns A new array with the spot present. The input is not
 *   mutated.
 *
 * @public
 */
export function registerSpot(
  seps: readonly EditorSeparation[],
  hex: string,
  name: string,
  opts: RegisterSpotOptions = {},
): EditorSeparation[] {
  const normalized = hex.toLowerCase();
  const next: EditorSeparation = {
    name,
    colorSpace: opts.colorSpace ?? "Spot",
    hex: normalized,
    ...(opts.pantone !== undefined ? { pantone: opts.pantone } : {}),
    ...(opts.lab !== undefined ? { lab: opts.lab } : {}),
    ...(opts.type !== undefined ? { type: opts.type } : {}),
  };
  const existingIdx = seps.findIndex((s) => s.hex.toLowerCase() === normalized);
  if (existingIdx === -1) return [...seps, next];
  return seps.map((s, i) => (i === existingIdx ? next : s));
}

/**
 * Remove a spot by hex. No-op if absent.
 *
 * @returns A new array with the matching entry removed.
 *
 * @public
 */
export function unregisterSpot(
  seps: readonly EditorSeparation[],
  hex: string,
): EditorSeparation[] {
  const normalized = hex.toLowerCase();
  return seps.filter((s) => s.hex.toLowerCase() !== normalized);
}

/**
 * Lookup a registered spot by hex. Case-insensitive.
 *
 * @returns The matching `EditorSeparation` or `undefined`.
 *
 * @public
 */
export function findSpotByColor(
  seps: readonly EditorSeparation[],
  hex: string,
): EditorSeparation | undefined {
  const normalized = hex.toLowerCase();
  return seps.find((s) => s.hex.toLowerCase() === normalized);
}

/**
 * Identity helper — returns the list as-is for symmetry with the
 * other registry verbs. Use this at the export site to thread the
 * page's spots into `JobSubmitRequest.separationsOverride`.
 *
 * @public
 */
export function listSpots(seps: readonly EditorSeparation[]): EditorSeparation[] {
  return [...seps];
}
