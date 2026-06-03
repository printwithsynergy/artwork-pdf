// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Shared dispatcher for the per-type properties panels.
 *
 * Both the desktop right-rail accordion ({@link RightRailAccordion})
 * and the mobile drawer ({@link MobileToolDrawer}) need to surface
 * the same "selected object → properties panel" mapping. Centralising
 * the switch here keeps the two surfaces in lock-step: when a new
 * property panel ships (e.g. once GS1 + Barcode become tools), only
 * this dispatcher changes.
 *
 * @public
 */

import type { ReactElement } from "react";
import type { EditorConfig } from "../lib/editor-config";
import { BraillePanel, type BrailleSpec } from "./BraillePanel";
import type { CanvasObj } from "./EditorCanvas";
import { EllipsePropertiesPanel } from "./EllipsePropertiesPanel";
import { ImagePropertiesPanel } from "./ImagePropertiesPanel";
import {
  DEFAULT_NUTRITION_STYLE,
  type NutritionFacts,
  NutritionPanel,
  type NutritionStyle,
} from "./NutritionPanel";
import { PathPropertiesPanel } from "./PathPropertiesPanel";
import { RectPropertiesPanel } from "./RectPropertiesPanel";
import { TextPropertiesPanel } from "./TextPropertiesPanel";

/**
 * Result of {@link resolvePropertiesSection} — either a rendered
 * section (id + label + element ready to mount in an accordion or
 * drawer) or `null` when the current selection has no matching
 * panel.
 *
 * @public
 */
export type ResolvedPropertiesSection = {
  id: string;
  label: string;
  element: ReactElement;
};

/**
 * Map the selected canvas object to its matching properties panel.
 * Honours the editor's `enable_<type>_properties_panel` flags so
 * hosts can hide a per-type panel without unmounting the surrounding
 * chrome.
 *
 * Returns `null` when:
 *   - nothing is selected, or
 *   - no `onUpdateSelected` callback is wired (read-only host), or
 *   - the selected type has no registered panel, or
 *   - the matching panel's flag is `false`.
 *
 * @public
 */
export function resolvePropertiesSection(
  selectedObj: CanvasObj | null | undefined,
  onUpdateSelected: ((patch: Partial<CanvasObj>) => void) | undefined,
  config: EditorConfig,
  hooks?: PropertiesSectionHooks,
): ResolvedPropertiesSection | null {
  if (!selectedObj || !onUpdateSelected) return null;

  switch (selectedObj.type) {
    case "rect": {
      if (!config.enable_rect_properties_panel) return null;
      return {
        id: "rect-properties",
        label: "Rectangle",
        element: <RectPropertiesPanel value={selectedObj} onChange={onUpdateSelected} />,
      };
    }
    case "ellipse": {
      if (!config.enable_ellipse_properties_panel) return null;
      return {
        id: "ellipse-properties",
        label: "Ellipse",
        element: <EllipsePropertiesPanel value={selectedObj} onChange={onUpdateSelected} />,
      };
    }
    case "text": {
      if (!config.enable_text_properties_panel) return null;
      return {
        id: "text-properties",
        label: "Text",
        element: (
          <TextPropertiesPanel
            value={selectedObj}
            onChange={onUpdateSelected}
            {...(hooks?.onEditText !== undefined ? { onEditText: hooks.onEditText } : {})}
          />
        ),
      };
    }
    case "image": {
      if (!config.enable_image_properties_panel) return null;
      return {
        id: "image-properties",
        label: "Image",
        element: (
          <ImagePropertiesPanel
            value={selectedObj}
            onChange={onUpdateSelected}
            {...(hooks?.onReplaceImage !== undefined ? { onReplace: hooks.onReplaceImage } : {})}
          />
        ),
      };
    }
    case "path": {
      if (!config.enable_path_properties_panel) return null;
      return {
        id: "path-properties",
        label: "Path",
        element: <PathPropertiesPanel value={selectedObj} onChange={onUpdateSelected} />,
      };
    }
    case "nutrition": {
      if (!config.enable_nutrition_panel) return null;
      if (!selectedObj.nutritionFacts) return null;
      const facts = selectedObj.nutritionFacts;
      const style = selectedObj.nutritionStyle ?? DEFAULT_NUTRITION_STYLE;
      return {
        id: "nutrition-properties",
        label: "Nutrition Facts",
        element: (
          <NutritionPanel
            value={facts}
            onChange={(nutritionFacts: NutritionFacts) => onUpdateSelected({ nutritionFacts })}
            style={style}
            onStyleChange={(nutritionStyle: NutritionStyle) => onUpdateSelected({ nutritionStyle })}
          />
        ),
      };
    }
    case "braille": {
      if (!config.enable_braille_panel) return null;
      if (!selectedObj.brailleSpec) return null;
      const spec = selectedObj.brailleSpec;
      return {
        id: "braille-properties",
        label: "Braille",
        element: (
          <BraillePanel
            value={spec}
            onChange={(brailleSpec: BrailleSpec) => onUpdateSelected({ brailleSpec })}
          />
        ),
      };
    }
    default:
      return null;
  }
}

/**
 * Optional host-wired callbacks the dispatcher threads into a panel
 * when relevant (e.g. the text panel's "Edit text" affordance opens
 * EditorCanvas's inline-edit overlay; the image panel's "Replace"
 * affordance opens the host's file-picker). Hosts that don't supply
 * a hook get a panel without the corresponding button.
 *
 * @public
 */
export type PropertiesSectionHooks = {
  /** Open the text inline-edit overlay for the currently-selected
   *  text object. Wired by EditorCanvas to its `onTextDblClick`
   *  helper. */
  onEditText?: () => void;
  /** Open the host's image-replace flow for the currently-selected
   *  image object. Wired by EditorCanvas to its hidden
   *  `<input type="file">` ref. */
  onReplaceImage?: () => void;
};
