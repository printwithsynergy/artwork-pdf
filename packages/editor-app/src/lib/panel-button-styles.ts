// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CSSProperties } from "react";

/**
 * Shared button vocabulary for editor panels. The four embedded
 * builder panels — NutritionPanel, BraillePanel,
 * Gs1DigitalLinkPanel, BarcodeGeneratorPanel — previously used
 * browser-default `<button>` styling which renders light gray on
 * the editor's dark `PANEL_BG #1a0f08` and fails contrast. These
 * helpers re-use the same BRAND `#fc5102` vocabulary as the
 * toolbar's `ToolBtn` so embedded actions feel consistent with
 * the rest of the editor.
 *
 * Hosts that mount the panels independently can import these
 * directly to keep their own action buttons consistent.
 *
 * @public
 */

const BRAND = "#fc5102";
const TEXT = "#ffffff";
const BORDER = "#3d1a00";

/**
 * Primary call-to-action style — solid BRAND background, white
 * text. Use for the canonical action of a panel (Compose,
 * Generate, Apply).
 *
 * @public
 */
export function primaryButtonStyle(disabled?: boolean): CSSProperties {
  return {
    background: BRAND,
    color: TEXT,
    border: `1px solid ${BRAND}`,
    borderRadius: 4,
    padding: "0.4rem 0.85rem",
    fontSize: "0.8rem",
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    marginTop: "0.5rem",
  };
}

/**
 * Secondary action style — transparent background, BRAND border +
 * text. Use for non-canonical actions that sit alongside a
 * primary (Preview vs. Generate, Reset vs. Apply).
 *
 * @public
 */
export function secondaryButtonStyle(disabled?: boolean): CSSProperties {
  return {
    background: "transparent",
    color: BRAND,
    border: `1px solid ${BRAND}`,
    borderRadius: 4,
    padding: "0.4rem 0.85rem",
    fontSize: "0.8rem",
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    marginTop: "0.5rem",
    marginRight: "0.5rem",
  };
}
