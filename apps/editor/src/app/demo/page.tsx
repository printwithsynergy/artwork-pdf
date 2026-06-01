// SPDX-License-Identifier: AGPL-3.0-or-later
//
// `/demo` — try-before-you-host editor route.
//
// Mounts `EditorApp` in demo mode (no destructive actions, client-only
// export path). Accepts two query params:
//
//   ?dieline=<id|set-id|csv>   seed the canvas with a known dieline
//   ?bleed=<mm|in|number>      override the per-page bleed
//
// Server component — the URL drives initial state on the server, so
// the first paint already has the chosen dieline loaded. Subsequent
// navigation inside the editor is client-side.

import {
  DEFAULT_BLEED_MM,
  EditorApp,
  getDefaultTemplate,
  getTemplateById,
  getTemplateSetById,
  parseBleed,
  templateSetToPages,
  templateToPage,
} from "@printwithsynergy/artwork-pdf-editor";

export const metadata = {
  title: "artworkPDF — Demo Editor",
  description: "Try the artworkPDF canvas editor on a packaging dieline — no account required.",
};

/**
 * Resolve a `?dieline=<value>` query string into the multi-page seed.
 *
 * Accepted shapes:
 *  • a single template id      → `?dieline=standup-pouch-4x6`
 *  • a template-set id         → `?dieline=carton-6x4x2-set`
 *  • a comma-separated list of template ids → `?dieline=foo,bar,baz`
 *
 * Unknown ids silently fall back to the default template (fail-open
 * so a stale link from social or email doesn't 500).
 */
function resolveDielineSeed(raw: string | undefined, bleedMm: number) {
  if (raw) {
    const set = getTemplateSetById(raw);
    if (set) return templateSetToPages(set, bleedMm);
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length > 1) {
      const pages = ids
        .map((id) => getTemplateById(id))
        .filter((t): t is NonNullable<ReturnType<typeof getTemplateById>> => t !== undefined)
        .map((tpl) => templateToPage(tpl, bleedMm));
      if (pages.length > 0) return pages;
    }
    const single = getTemplateById(ids[0]);
    if (single) return [templateToPage(single, bleedMm)];
  }
  return [templateToPage(getDefaultTemplate(), bleedMm)];
}

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ dieline?: string; bleed?: string }>;
}) {
  const { dieline, bleed } = await searchParams;
  const bleedMm = parseBleed(bleed) ?? DEFAULT_BLEED_MM;
  const pages = resolveDielineSeed(dieline, bleedMm);

  return (
    <EditorApp
      demo
      initialPhase="editor"
      initialPages={pages}
      topBar={{
        extraButtons: [
          { label: "← Back to artworkpdf.com", href: "https://artworkpdf.com", target: "_blank" },
        ],
      }}
    />
  );
}
