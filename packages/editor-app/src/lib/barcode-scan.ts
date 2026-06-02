// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * G2v — barcode detection + validation for the live editor and the
 * file-upload preflight pass.
 *
 * Two responsibilities, intentionally separated:
 *
 *   1. **Validation** ({@link validateEAN13}, {@link validateUPCA},
 *      {@link validateGS1128}, {@link validateBarcode}) — pure
 *      check-digit / structural validators against the canonical
 *      specifications. No third-party dep; the standard mod-10 and
 *      AI-parsing algorithms are short and well-defined. These are
 *      what the `barcode_validation` preflight rule consults to flag
 *      malformed codes the user has already declared on the canvas
 *      (or that future G2g (Wave 3) will generate).
 *
 *   2. **Detection** ({@link scanBarcodes}) — visual scanning of a
 *      rasterized canvas / image to find barcodes the user pasted in
 *      or imported from artwork PDFs. The detector is currently a
 *      stub that always resolves to an empty array; a follow-up will
 *      add `jsqr` for QR codes (smallest footprint ~40 kB minified)
 *      and either `quagga2` (~200 kB, mature, EAN-13/UPC-A/Code-128)
 *      or `@undecaf/zbar-wasm` (~600 kB, more accurate) for linear
 *      barcodes after a perf+accuracy bake-off. Until then this
 *      module ships the type contract and validator surface so the
 *      preflight switch + rule defaults can land cleanly without
 *      pulling in a heavyweight dep on day one.
 */

/**
 * Barcode symbology / format. Listed are the formats covered by the
 * `barcode_validation` rule. Other formats (Data Matrix, ITF-14,
 * Code 39, …) can be added incrementally; each gets its own
 * validator + entry in {@link validateBarcode}.
 *
 * @public
 */
export type BarcodeFormat = "EAN-13" | "UPC-A" | "GS1-128" | "QR";

/**
 * Canonical list of every {@link BarcodeFormat} the module supports.
 * Exported so UI surfaces ({@link import("../components/BarcodeGeneratorPanel").BarcodeGeneratorPanel}
 * default dropdown, host-supplied filters, contract tests) don't have
 * to redeclare the list and drift out of sync when a new format is
 * added to the union.
 *
 * @public
 */
export const ALL_BARCODE_FORMATS: readonly BarcodeFormat[] = [
  "EAN-13",
  "UPC-A",
  "GS1-128",
  "QR",
] as const;

/**
 * Result of detecting one barcode on a rasterized image.
 *
 * `bounds` and `confidence` are optional because different detectors
 * surface them with different fidelity (jsQR returns a 4-corner
 * polygon, zbar returns a rect, quagga returns both); callers should
 * defensively check for `undefined`.
 *
 * @public
 */
export type BarcodeDetection = {
  /** The decoded payload, e.g. `"4006381333931"` for an EAN-13 or a
   *  URL for a QR code. */
  code: string;
  /** Detected symbology. */
  format: BarcodeFormat;
  /** Pixel-space bounding box on the source ImageData, if the
   *  detector reported one. */
  bounds?: { x: number; y: number; width: number; height: number };
  /** Detector confidence in `[0, 1]`, if reported. */
  confidence?: number;
};

/**
 * Result of validating one barcode against its format-specific spec.
 *
 * `reason` is populated only when `valid` is `false` — a short
 * human-readable explanation suitable for surfacing in the
 * preflight panel.
 *
 * @public
 */
export type BarcodeValidation = { valid: boolean; reason?: string };

/**
 * EAN-13 check-digit validation.
 *
 * EAN-13 is 13 digits; the 13th is a mod-10 checksum over the first
 * 12 with alternating weights (1, 3, 1, 3, …). Returns `true` iff the
 * input is exactly 13 ASCII digits and the checksum matches.
 *
 * @public
 */
export function validateEAN13(code: string): boolean {
  if (!/^[0-9]{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = code.charCodeAt(i) - 48;
    // Odd-positioned digits (1-indexed) get weight 1; even get 3.
    sum += i % 2 === 0 ? d : d * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === code.charCodeAt(12) - 48;
}

/**
 * UPC-A check-digit validation.
 *
 * UPC-A is 12 digits; the 12th is a mod-10 checksum over the first
 * 11 with weights (3, 1, 3, 1, …). Returns `true` iff the input is
 * exactly 12 ASCII digits and the checksum matches.
 *
 * @public
 */
export function validateUPCA(code: string): boolean {
  if (!/^[0-9]{12}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const d = code.charCodeAt(i) - 48;
    // Odd-positioned digits (1-indexed) get weight 3; even get 1 —
    // mirror image of EAN-13's weight pattern.
    sum += i % 2 === 0 ? d * 3 : d;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === code.charCodeAt(11) - 48;
}

/**
 * GS1-128 structural validation.
 *
 * GS1-128 (formerly UCC/EAN-128) encodes structured data using
 * Application Identifiers — each AI is 2–4 digits followed by a
 * data field of AI-dependent length. A full validator would require
 * the AI table; the shippable approximation here checks that:
 *
 *   - The payload contains only printable ASCII (no control chars
 *     other than the `<GS>` `0x1D` separator used between
 *     variable-length data fields).
 *   - The payload starts with at least two digits (the first AI).
 *   - The payload is non-empty and ≤ 48 chars (real-world
 *     GS1-128 codes rarely exceed this).
 *
 * Returns `true` for plausibly-structured payloads. False positives
 * are intentional — preflight is a sanity check, not a parser.
 *
 * @public
 */
export function validateGS1128(code: string): boolean {
  if (code.length === 0 || code.length > 48) return false;
  if (!/^[0-9]{2}/.test(code)) return false;
  // 0x1D is the GS separator GS1-128 uses; everything else must be
  // printable ASCII so we don't accept binary garbage.
  for (let i = 0; i < code.length; i++) {
    const c = code.charCodeAt(i);
    if (c === 0x1d) continue;
    if (c < 0x20 || c > 0x7e) return false;
  }
  return true;
}

/**
 * Format-aware validator that dispatches to the right per-format
 * check. QR codes pass when the payload is non-empty (the symbol
 * itself carries a Reed-Solomon checksum the detector already
 * verified before emitting the {@link BarcodeDetection}).
 *
 * @public
 */
export function validateBarcode(detection: BarcodeDetection): BarcodeValidation {
  switch (detection.format) {
    case "EAN-13":
      return validateEAN13(detection.code)
        ? { valid: true }
        : { valid: false, reason: "EAN-13 check digit failed or wrong length (need 13 digits)" };
    case "UPC-A":
      return validateUPCA(detection.code)
        ? { valid: true }
        : { valid: false, reason: "UPC-A check digit failed or wrong length (need 12 digits)" };
    case "GS1-128":
      return validateGS1128(detection.code)
        ? { valid: true }
        : {
            valid: false,
            reason: "GS1-128 payload is empty, too long, or contains non-printable chars",
          };
    case "QR":
      return detection.code.length > 0
        ? { valid: true }
        : { valid: false, reason: "QR payload is empty" };
    default:
      // Defensive: detectors that return formats outside our union
      // (e.g. a future library reporting "Code128" before we add it
      // to BarcodeFormat) would otherwise return undefined.
      return { valid: false, reason: "Unsupported barcode format" };
  }
}

/**
 * Visual barcode detection from a rasterized image.
 *
 * Currently a stub: returns an empty array regardless of input. The
 * real implementation lands in a follow-up that adds a barcode
 * detection library (likely `jsqr` for QR + `quagga2` for linear).
 * Until then, callers see no false positives, and the
 * {@link validateBarcode} surface stays usable for codes the user
 * (or G2g, Wave 3) declares directly on the canvas.
 *
 * The async signature is forward-compatible — most barcode
 * detectors are async (decoder workers, WASM init), so callers
 * don't need to refactor when the real detector lands.
 *
 * @public
 */
export async function scanBarcodes(_imageData: ImageData): Promise<BarcodeDetection[]> {
  // TODO(wave-1 follow-up): integrate jsqr + a linear scanner.
  return [];
}
