// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  DEFAULT_BLEED_MM,
  EditorApp,
  getDefaultTemplate,
  getTemplateById,
  parseBleed,
  templateToInitialState,
} from "@printwithsynergy/artwork-pdf-editor";

export const metadata = {
  title: "artworkPDF — Demo Editor",
  description: "Try the artworkPDF canvas editor on a packaging dieline — no account required.",
};

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ dieline?: string; bleed?: string }>;
}) {
  const { dieline, bleed } = await searchParams;
  const template = getTemplateById(dieline) ?? getDefaultTemplate();
  const bleedMm = parseBleed(bleed) ?? DEFAULT_BLEED_MM;
  const { objects, pageSize } = templateToInitialState(template, bleedMm);

  return (
    <EditorApp
      demo
      initialPhase="editor"
      initialObjects={objects}
      initialPageSize={pageSize}
      bleedMm={bleedMm}
      topBar={{
        extraButtons: [
          { label: "← Back to artworkpdf.com", href: "https://artworkpdf.com", target: "_blank" },
        ],
      }}
    />
  );
}
