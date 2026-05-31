// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * artwork-pdf plugins for `@printwithsynergy/lens-pdf`.
 *
 * Use this subpath only when you also have `lens-pdf` installed.
 * Hosts that mount the editor without lens-pdf don't need this.
 *
 * Quick start:
 *
 * ```tsx
 * import { LensPDF } from "@printwithsynergy/lens-pdf";
 * import { dielineOverlayPlugin, preflightFindingsPlugin }
 *   from "@printwithsynergy/artwork-pdf-editor/lens";
 *
 * <LensPDF
 *   pdfUrl={blobUrl}
 *   plugins={[
 *     dielineOverlayPlugin({ pages: { 1: { template: tpl, bleedMm: 3.175 } } }),
 *     preflightFindingsPlugin({ report }),
 *   ]}
 * />
 * ```
 *
 * @packageDocumentation
 */

export { dielineOverlayPlugin } from "./dieline-overlay";
export { preflightFindingsPlugin } from "./preflight-findings";
