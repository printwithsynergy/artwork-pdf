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

/** Stroke color + display name for the dieline trim rect. The dieline
 *  is a technical separation in print, so it gets its own named plate
 *  rather than being lumped in with artwork spot inks. */
export const DIELINE_STROKE = "#fc5102";
export const DIELINE_NAME = "Die Line";

/**
 * A multi-page dieline set — an ordered list of {@link DielineTemplate}
 * ids that compose a single multi-page artwork document (e.g. a carton's
 * front + back, or pouch front + back).
 *
 * @public
 */
export type TemplateSet = {
  id: string;
  name: string;
  description: string;
  category: string;
  pages: Array<{ templateId: string; name?: string }>;
  tags: string[];
  isDefault?: boolean;
};

type DielineLibrary = {
  templates: DielineTemplate[];
  templateSets?: TemplateSet[];
};

const LIBRARY = library as DielineLibrary;

export const TEMPLATES: DielineTemplate[] = LIBRARY.templates;

/**
 * Bundled multi-page template sets (e.g. carton front + back). Empty if
 * the library has none.
 *
 * @public
 */
export const TEMPLATE_SETS: TemplateSet[] = LIBRARY.templateSets ?? [];

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

/**
 * Lookup a multi-page template set by id (e.g. `"carton-6x4x2-set"`).
 * Returns `undefined` for unknown / missing.
 *
 * @public
 */
export function getTemplateSetById(id: string | undefined): TemplateSet | undefined {
  if (!id) return undefined;
  return TEMPLATE_SETS.find((s) => s.id === id);
}

/**
 * Expand a {@link TemplateSet} into an ordered list of {@link Page}s.
 * Each set entry resolves to its `DielineTemplate`; unknown ids are
 * skipped (so callers always get a non-throwing result they can fall
 * back from).
 *
 * @public
 */
export function templateSetToPages(set: TemplateSet, bleedMmOverride?: number): Page[] {
  return set.pages
    .map(({ templateId, name }) => {
      const tpl = getTemplateById(templateId);
      return tpl ? templateToPage(tpl, bleedMmOverride, name) : null;
    })
    .filter((p): p is Page => p !== null);
}


/**
 * One page of a multi-page artwork document. Carries the dieline rect
 * + any user-drawn objects, plus the per-page geometry (pageSize, bleed).
 * Used as the array element of {@link EditorAppProps.initialPages}.
 *
 * @public
 */
export type Page = {
  /** Stable id (e.g. `uuid()` or ``page-${i}``) — used as a React key. */
  id: string;
  objects: CanvasObj[];
  pageSize: { width: number; height: number };
  bleedMm: number;
  /** Source template id, when this page was seeded from a known dieline. */
  templateId?: string;
  /** Human label shown in the page navigator (e.g. "Front", "Back"). */
  name?: string;
};

/**
 * Build a {@link Page} from a {@link DielineTemplate}. Mirrors the
 * single-page {@link templateToInitialState} output but in the new
 * multi-page shape. Use this to seed `EditorAppProps.initialPages`.
 *
 * @public
 */
export function templateToPage(
  template: DielineTemplate,
  bleedMmOverride?: number,
  name?: string,
): Page {
  const { objects, pageSize } = templateToInitialState(template, bleedMmOverride);
  const page: Page = {
    id: `page-${template.id}-${Math.random().toString(36).slice(2, 8)}`,
    objects,
    pageSize,
    bleedMm: bleedMmOverride ?? template.bleedMm,
    templateId: template.id,
  };
  if (name !== undefined) page.name = name;
  return page;
}

/**
 * Build a list of {@link Page}s from an ordered set of templates +
 * per-page names. Convenience for multi-page document sets (e.g. a
 * carton's front / back / spine).
 *
 * @public
 */
export function templatesToPages(
  entries: ReadonlyArray<{ template: DielineTemplate; name?: string }>,
  bleedMmOverride?: number,
): Page[] {
  return entries.map(({ template, name }) => templateToPage(template, bleedMmOverride, name));
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
    name: DIELINE_NAME,
    locked: true,
  };
  return { objects: [dielineObj], pageSize };
}
