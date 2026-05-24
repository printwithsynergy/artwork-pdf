// SPDX-License-Identifier: AGPL-3.0-or-later
import { EditorApp } from "../../components/EditorApp";
import {
  getDefaultTemplate,
  getTemplateById,
  templateToInitialState,
} from "../../lib/dieline-template";

export const metadata = {
  title: "artworkPDF — Demo Editor",
  description: "Try the artworkPDF canvas editor on a packaging dieline — no account required.",
};

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ dieline?: string }>;
}) {
  const { dieline } = await searchParams;
  const template = getTemplateById(dieline) ?? getDefaultTemplate();
  const { objects, pageSize } = templateToInitialState(template);

  return (
    <EditorApp demo initialPhase="editor" initialObjects={objects} initialPageSize={pageSize} />
  );
}
