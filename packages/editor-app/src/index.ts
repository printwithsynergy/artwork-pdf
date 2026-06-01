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
export { HistoryPanel, type HistoryPanelProps } from "./components/HistoryPanel";
export {
  DielineParametersPanel,
  type DielineParameters,
  type DielineParametersPanelProps,
} from "./components/DielineParametersPanel";
export { TacOverlay, type TacOverlayProps } from "./components/TacOverlay";
export {
  TrapPreviewOverlay,
  type TrapPreviewFn,
  type TrapPreviewOperation,
  type TrapPreviewOverlayProps,
} from "./components/TrapPreviewOverlay";
export {
  TrapEditorPanel,
  type TrapEditorPanelProps,
  type TrapEditorValue,
} from "./components/TrapEditorPanel";
export {
  ImposePanel,
  type ImposePanelPreset,
  type ImposePanelProps,
  type ImposePanelValue,
} from "./components/ImposePanel";
export {
  FoldPreviewOverlay,
  type FoldPreviewOverlayProps,
} from "./components/FoldPreviewOverlay";
export {
  FoldEditorPanel,
  type FoldEditorEdge,
  type FoldEditorPanelProps,
  type FoldEditorPanelValue,
} from "./components/FoldEditorPanel";
export {
  VariantMatrixPanel,
  type VariantMatrixPanelProps,
  type VariantMatrixPanelValue,
  type VariantMatrixPanelVariant,
} from "./components/VariantMatrixPanel";
export {
  buildFoldScene,
  type FoldHingeAxis,
  type FoldPanelQuad,
  type FoldSceneSpec,
} from "./lib/fold-geometry";
export { PaletteManager, type PaletteManagerProps } from "./components/PaletteManager";
export {
  SwatchesPicker,
  type SwatchesPickerProps,
  type Spot,
  type SpotSearchFn,
  type SpotLibrary,
} from "./components/SwatchesPicker";
export {
  InksPanel,
  type Ink,
  type InksLoaderFn,
  type InksPanelProps,
} from "./components/InksPanel";
export {
  JobSetupPanel,
  type JobSetupPanelProps,
  type JobSetupValue,
  type PrintProcess,
  type SubstrateFinish,
} from "./components/JobSetupPanel";
export {
  MisEstimateButton,
  type MisEstimateButtonProps,
  type MisEstimateManifest,
  type MisSubmitFn,
} from "./components/MisEstimateButton";
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
  type EditorDielinePanel,
  isPointInPanel,
  findPanelAt,
  getPanelById,
  resolveAnchorPanel,
} from "./lib/panel-anchor";
export {
  type EditorSeparation,
  type RegisterSpotOptions,
  registerSpot,
  unregisterSpot,
  findSpotByColor,
  listSpots,
} from "./lib/separations-registry";
export {
  hexToCmyk,
  parseHex,
  rgbToCmyk,
  tacPercent,
} from "./lib/color-math";
export {
  rasterizeStage,
  sampleTACFromImageData,
  tacForHex,
} from "./lib/rasterize";
export {
  type BarcodeDetection,
  type BarcodeFormat,
  type BarcodeValidation,
  scanBarcodes,
  validateBarcode,
  validateEAN13,
  validateGS1128,
  validateUPCA,
} from "./lib/barcode-scan";
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
