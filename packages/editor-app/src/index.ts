// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Public API surface of `@printwithsynergy/artwork-pdf-editor`. Hosts mount the
 * editor by importing {@link EditorApp} and optionally customize it
 * via {@link EditorAppProps.config}, {@link EditorAppProps.topBar},
 * and {@link EditorAppProps.bleedMm}.
 *
 * The dieline-template helpers and bleed parser are re-exported so
 * server components (Next.js Server Components, Astro frontmatter)
 * can seed the canvas with the right initial state without bundling
 * the whole client.
 *
 * @packageDocumentation
 */

export { EditorApp, type EditorAppProps } from "./components/EditorApp";
export type { CanvasObj } from "./components/EditorCanvas";
export { TopBar, ArtworkPdfLogo, type TopBarProps, type TopBarButton } from "./components/TopBar";
export { MobileToolDrawer, type MobileToolDrawerProps } from "./components/MobileToolDrawer";
export { useIsMobile } from "./hooks/useIsMobile";
export { type EditorMode, useEditorMode } from "./hooks/useEditorMode";
export {
  type EditorConfig,
  DEFAULT_EDITOR_CONFIG,
  BASIC_MODE_OVERRIDES,
  PRO_MODE_OVERRIDES,
  resolveConfig,
} from "./lib/editor-config";
export {
  type DielineTemplate,
  TEMPLATES,
  getDefaultTemplate,
  getTemplateById,
  templateToInitialState,
} from "./lib/dieline-template";
export { DEFAULT_BLEED_MM, parseBleed, formatBleed } from "./lib/bleed";
