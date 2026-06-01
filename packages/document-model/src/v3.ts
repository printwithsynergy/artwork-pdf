// SPDX-License-Identifier: AGPL-3.0-or-later
// DocumentModel v3 — pages-first canonical wire shape.
// v2 (flat layers + doc-level dimensions) is preserved in extended.ts for
// backward-compat; use upgradeV2ToV3 in migrate.ts to lift v2 into v3.

import type { GraphicStyle, Layer, PrintContext, Separation } from "./extended.js";

export type PageV3 = {
  id: string;
  name?: string;
  width: number;
  height: number;
  unit: "mm" | "in" | "px" | "pt";
  bleedMm: number;
  separations: Separation[];
  layers: Layer[];
  dielineTemplateId?: string;
  flexoDistortion?: { distortionFactorX: number; distortionFactorY: number };
};

export type DocumentV3 = {
  version: "3";
  pages: PageV3[];
  swatches?: string[];
  graphicStyles?: GraphicStyle[];
  variableData?: Record<string, string>;
  printContext?: PrintContext;
};
