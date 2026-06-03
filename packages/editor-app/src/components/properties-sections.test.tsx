// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_EDITOR_CONFIG, type EditorConfig } from "../lib/editor-config";
import type { CanvasObj } from "./EditorCanvas";
import { resolvePropertiesSection } from "./properties-sections";

// Pure-logic tests for the selection→panel dispatcher. The
// dispatcher is the contract both the desktop RightRailAccordion and
// the mobile MobileToolDrawer rely on; the section id is what
// drives auto-open in the rail, so it has to stay stable per type.

function rect(overrides: Partial<CanvasObj> = {}): CanvasObj {
  return {
    id: "obj-1",
    type: "rect",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    fill: "#ff0000",
    stroke: "#000000",
    strokeWidth: 1,
    opacity: 1,
    ...overrides,
  };
}

const onPatch = vi.fn();

describe("resolvePropertiesSection", () => {
  it("returns null when no selection", () => {
    const out = resolvePropertiesSection(null, onPatch, DEFAULT_EDITOR_CONFIG);
    expect(out).toBeNull();
  });

  it("returns null when no onUpdateSelected wired (read-only host)", () => {
    const out = resolvePropertiesSection(rect(), undefined, DEFAULT_EDITOR_CONFIG);
    expect(out).toBeNull();
  });

  it("dispatches a rect selection to rect-properties", () => {
    const out = resolvePropertiesSection(rect(), onPatch, DEFAULT_EDITOR_CONFIG);
    expect(out?.id).toBe("rect-properties");
    expect(out?.label).toBe("Rectangle");
  });

  it("dispatches an ellipse selection to ellipse-properties", () => {
    const out = resolvePropertiesSection(rect({ type: "ellipse" }), onPatch, DEFAULT_EDITOR_CONFIG);
    expect(out?.id).toBe("ellipse-properties");
    expect(out?.label).toBe("Ellipse");
  });

  it("dispatches a text selection to text-properties", () => {
    const out = resolvePropertiesSection(
      rect({ type: "text", text: "Hello" }),
      onPatch,
      DEFAULT_EDITOR_CONFIG,
    );
    expect(out?.id).toBe("text-properties");
    expect(out?.label).toBe("Text");
  });

  it("dispatches an image selection to image-properties", () => {
    const out = resolvePropertiesSection(
      rect({ type: "image", src: "data:image/png;base64,iVBOR" }),
      onPatch,
      DEFAULT_EDITOR_CONFIG,
    );
    expect(out?.id).toBe("image-properties");
    expect(out?.label).toBe("Image");
  });

  it("dispatches a path selection to path-properties", () => {
    const out = resolvePropertiesSection(
      rect({ type: "path", pathData: "M0,0 L10,10" }),
      onPatch,
      DEFAULT_EDITOR_CONFIG,
    );
    expect(out?.id).toBe("path-properties");
    expect(out?.label).toBe("Path");
  });

  it("dispatches a nutrition selection only when nutritionFacts is present", () => {
    const withFacts = resolvePropertiesSection(
      rect({
        type: "nutrition",
        nutritionFacts: {
          servingSize: "1 cup",
          servingsPerContainer: 1,
          calories: 100,
          totalFatG: 0,
          saturatedFatG: 0,
          transFatG: 0,
          cholesterolMg: 0,
          sodiumMg: 0,
          totalCarbohydrateG: 0,
          dietaryFiberG: 0,
          totalSugarsG: 0,
          proteinG: 0,
        },
      }),
      onPatch,
      DEFAULT_EDITOR_CONFIG,
    );
    expect(withFacts?.id).toBe("nutrition-properties");

    const withoutFacts = resolvePropertiesSection(
      rect({ type: "nutrition" }),
      onPatch,
      DEFAULT_EDITOR_CONFIG,
    );
    expect(withoutFacts).toBeNull();
  });

  it("respects enable_rect_properties_panel = false", () => {
    const cfg: EditorConfig = {
      ...DEFAULT_EDITOR_CONFIG,
      enable_rect_properties_panel: false,
    };
    const out = resolvePropertiesSection(rect(), onPatch, cfg);
    expect(out).toBeNull();
  });

  it("respects enable_text_properties_panel = false", () => {
    const cfg: EditorConfig = {
      ...DEFAULT_EDITOR_CONFIG,
      enable_text_properties_panel: false,
    };
    const out = resolvePropertiesSection(rect({ type: "text" }), onPatch, cfg);
    expect(out).toBeNull();
  });

  it("respects enable_image_properties_panel = false", () => {
    const cfg: EditorConfig = {
      ...DEFAULT_EDITOR_CONFIG,
      enable_image_properties_panel: false,
    };
    const out = resolvePropertiesSection(rect({ type: "image" }), onPatch, cfg);
    expect(out).toBeNull();
  });

  it("respects enable_path_properties_panel = false", () => {
    const cfg: EditorConfig = {
      ...DEFAULT_EDITOR_CONFIG,
      enable_path_properties_panel: false,
    };
    const out = resolvePropertiesSection(rect({ type: "path" }), onPatch, cfg);
    expect(out).toBeNull();
  });

  it("returns null for an unrecognised type", () => {
    const weird = { ...rect(), type: "unknown" as unknown as CanvasObj["type"] };
    const out = resolvePropertiesSection(weird, onPatch, DEFAULT_EDITOR_CONFIG);
    expect(out).toBeNull();
  });

  it("threads onEditText hook into the text panel element", () => {
    const onEditText = vi.fn();
    const out = resolvePropertiesSection(rect({ type: "text" }), onPatch, DEFAULT_EDITOR_CONFIG, {
      onEditText,
    });
    expect(out?.id).toBe("text-properties");
    // The React element's props should include the hook.
    const props = (out?.element.props ?? {}) as { onEditText?: () => void };
    expect(props.onEditText).toBe(onEditText);
  });

  it("threads onReplaceImage hook into the image panel element", () => {
    const onReplaceImage = vi.fn();
    const out = resolvePropertiesSection(rect({ type: "image" }), onPatch, DEFAULT_EDITOR_CONFIG, {
      onReplaceImage,
    });
    expect(out?.id).toBe("image-properties");
    const props = (out?.element.props ?? {}) as { onReplace?: () => void };
    expect(props.onReplace).toBe(onReplaceImage);
  });
});
