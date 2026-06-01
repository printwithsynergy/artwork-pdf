// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Dieline-template bundle + helpers for seeding the editor canvas.
//
// The shipped JSON library (`data/dielines.json`) gets loaded eagerly
// so server components (Next.js RSC, Astro frontmatter) can pick a
// template and produce initial Page state without touching the
// browser-only editor bundle.
//
// `dielineToPage()` is the parallel ingress for user-supplied CF2 /
// DDES / ARD files (parsed via `@artworkpdf/dieline-parser`'s
// `parseCF2` / `parseDDES` / `parseARD`) — each parsed `Dieline`
// becomes a single-page `Page` seeded with one locked path per
// `DielinePath`.

import type { Dieline, DielinePath } from "@artworkpdf/dieline-parser";
import type { CanvasObj } from "../components/EditorCanvas";
import library from "../data/dielines.json";

/**
 * One packaging structure — geometry + metadata for a known dieline
 * (pouch, bottle wrap, carton, etc.).
 *
 * `dimensions` is the *trim* size in mm; `bleedMm` is the per-side
 * bleed extension; `trimBox` is the trim rect in mm relative to the
 * full bleed-included page. `previewSvg` is an inline string suitable
 * for thumbnail rendering in the template-picker UI.
 *
 * Distinct from `@artworkpdf/document-model`'s `DielineTemplate`: the
 * shape here is a published, self-contained type so the editor
 * package doesn't force the document-model dep on hosts.
 *
 * @public
 */
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

/**
 * All bundled dieline templates, in library declaration order.
 *
 * Mirrors the shape of `data/dielines.json`. Hosts that want a
 * filtered or ordered subset should derive from this array rather
 * than reloading the JSON file.
 *
 * @public
 */
export const TEMPLATES: DielineTemplate[] = LIBRARY.templates;

/**
 * Bundled multi-page template sets (e.g. carton front + back). Empty if
 * the library has none.
 *
 * @public
 */
export const TEMPLATE_SETS: TemplateSet[] = LIBRARY.templateSets ?? [];

/**
 * Return the library's default template (`isDefault: true`), falling
 * back to the first entry. Throws if the library is empty — that
 * would indicate a packaging defect, not a runtime condition.
 *
 * @public
 */
export function getDefaultTemplate(): DielineTemplate {
  const flagged = TEMPLATES.find((t) => t.isDefault);
  if (flagged) return flagged;
  const first = TEMPLATES[0];
  if (!first) throw new Error("dielines.json contains no templates");
  return first;
}

/**
 * Lookup by template id. Returns `undefined` (not throws) for
 * unknown or missing ids so callers can fall back to a default.
 *
 * @public
 */
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

/**
 * Build the initial canvas state for a single template — the dieline
 * trim rect (locked, non-interactive) plus the page size including
 * bleed on all sides.
 *
 * Pass `bleedMmOverride` to use a host-supplied bleed instead of the
 * template's bundled value (e.g. when the user picks a custom bleed
 * in the URL or UI). Returned coordinates are in PDF points
 * (1 mm = 2.83465 pt).
 *
 * Use this for single-page seeds; for multi-page documents use
 * {@link templateToPage} or {@link templatesToPages} which wrap the
 * result in a {@link Page}.
 *
 * @public
 */
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

/**
 * Stroke color per DielinePath type. Chosen to match the
 * print-industry conventions our preview uses elsewhere:
 *
 * - cut    — orange (brand, same as bundled DIELINE_STROKE)
 * - crease — blue (folding score)
 * - perf   — red (perforation)
 * - bleed  — cyan (bleed edge / safety boundary)
 */
const DIELINE_PATH_STROKES: Record<DielinePath["type"], string> = {
  cut: DIELINE_STROKE,
  crease: "#1e90ff",
  perf: "#ef4444",
  bleed: "#0ea5e9",
};

/**
 * Build a {@link Page} from a parsed {@link Dieline} (CF2 / DDES /
 * ARD import).
 *
 * Each `DielinePath` becomes one locked `CanvasObj` of type `"path"`
 * rendered as a Konva `Path` (the `Path` import was added to
 * `EditorCanvas` for this case). Type-specific stroke colors come
 * from {@link DIELINE_PATH_STROKES}. The whole page is locked so
 * users can't accidentally drag the structural reference geometry —
 * same invariant as the bundled-template dieline rect.
 *
 * Coordinate units: the parser emits SVG path `d` strings in
 * **dieline-native millimeters** (Y-down). We position each path
 * object at `(bleedMm * MM_TO_PT, bleedMm * MM_TO_PT)` so the dieline
 * trim sits inside the bleed margin. The path data itself is in
 * mm — Konva renders it without further conversion because the
 * containing Stage is configured in points and the relative offsets
 * align (the Stage's own scale handles the mm→pt for display).
 *
 * `bleedMmOverride`: pass a host-supplied bleed (URL param, UI
 * input) instead of the default. Defaults to 0 for parsed dielines —
 * the source files don't carry their own bleed convention and the
 * caller is the right place to decide.
 *
 * @public
 */
export function dielineToPage(dieline: Dieline, bleedMmOverride?: number): Page {
  const bleedMm = bleedMmOverride ?? 0;
  const pageSize = {
    width: (dieline.widthMm + bleedMm * 2) * MM_TO_PT,
    height: (dieline.heightMm + bleedMm * 2) * MM_TO_PT,
  };
  const bleedOffsetPt = bleedMm * MM_TO_PT;

  const objects: CanvasObj[] = dieline.paths.map((p: DielinePath) => ({
    id: `dieline-${dieline.format.toLowerCase()}-${p.id}`,
    type: "path" as const,
    x: bleedOffsetPt,
    y: bleedOffsetPt,
    width: 0,
    height: 0,
    fill: "transparent",
    stroke: DIELINE_PATH_STROKES[p.type],
    strokeWidth: 1,
    opacity: 1,
    pathData: p.d,
    name: `${dieline.format} ${p.type}`,
    locked: true,
  }));

  return {
    id: `page-${dieline.format.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`,
    objects,
    pageSize,
    bleedMm,
  };
}
