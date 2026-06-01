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
export { PaletteManager, type PaletteManagerProps } from "./components/PaletteManager";
export {
  JobSetupPanel,
  type JobSetupPanelProps,
  type JobSetupValue,
  type PrintProcess,
  type SubstrateFinish,
} from "./components/JobSetupPanel";
export { useIsMobile } from "./hooks/useIsMobile";
export { type EditorMode, useEditorMode } from "./hooks/useEditorMode";
export {
  type EditorConfig,
  type FeatureKey,
  type PaletteId,
  DEFAULT_EDITOR_CONFIG,
  BASIC_MODE_OVERRIDES,
  PRO_MODE_OVERRIDES,
  resolveConfig,
  showFeature,
  isPanelVisible,
} from "./lib/editor-config";
export { markUnwired, isUnwired } from "./lib/unwired";
export {
  type PaletteRegistryEntry,
  PALETTE_REGISTRY,
  PALETTE_IDS,
} from "./lib/palette-registry";
export {
  type DielineTemplate,
  type Page,
  type TemplateSet,
  TEMPLATES,
  TEMPLATE_SETS,
  dielineToPage,
  getDefaultTemplate,
  getTemplateById,
  getTemplateSetById,
  templateToInitialState,
  templateToPage,
  templatesToPages,
  templateSetToPages,
} from "./lib/dieline-template";
export { DEFAULT_BLEED_MM, parseBleed, formatBleed } from "./lib/bleed";
