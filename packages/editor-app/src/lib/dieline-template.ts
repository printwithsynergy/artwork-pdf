// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CanvasObj } from "../components/EditorCanvas";
import library from "../data/dielines.json";

export type DielineTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  dimensions: { widthMm: number; heightMm: number; depthMm: number };
  bleedMm: number;
  trimBox: { x: number; y: number; width: number; height: number };
  previewSvg: string;
  tags: string[];
  isDefault?: boolean;
};

const MM_TO_PT = 2.83465;
const DIELINE_STROKE = "#fc5102";

export const TEMPLATES: DielineTemplate[] = (library as { templates: DielineTemplate[] }).templates;

export function getDefaultTemplate(): DielineTemplate {
  const flagged = TEMPLATES.find((t) => t.isDefault);
  if (flagged) return flagged;
  const first = TEMPLATES[0];
  if (!first) throw new Error("dielines.json contains no templates");
  return first;
}

export function getTemplateById(id: string | undefined): DielineTemplate | undefined {
  if (!id) return undefined;
  return TEMPLATES.find((t) => t.id === id);
}

export function templateToInitialState(
  template: DielineTemplate,
  bleedMmOverride?: number,
): {
  objects: CanvasObj[];
  pageSize: { width: number; height: number };
} {
  const bleedMm = bleedMmOverride ?? template.bleedMm;
  const pageSize = {
    width: (template.dimensions.widthMm + bleedMm * 2) * MM_TO_PT,
    height: (template.dimensions.heightMm + bleedMm * 2) * MM_TO_PT,
  };
  // The trim sits inside the bleed margin by `bleedMm` on each side.
  // Templates carry their own trimBox.x/y assuming their bundled
  // bleedMm; we override here so the trim stays the right size and
  // shifts to match the effective bleed.
  const dielineObj: CanvasObj = {
    id: `dieline-${template.id}`,
    type: "rect",
    x: bleedMm * MM_TO_PT,
    y: bleedMm * MM_TO_PT,
    width: template.trimBox.width * MM_TO_PT,
    height: template.trimBox.height * MM_TO_PT,
    fill: "transparent",
    stroke: DIELINE_STROKE,
    strokeWidth: 1,
    opacity: 1,
    locked: true,
  };
  return { objects: [dielineObj], pageSize };
}
