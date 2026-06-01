// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { FoldPreviewOverlayProps } from "./FoldPreviewOverlay";

/**
 * Contract tests for FoldPreviewOverlay's typed public surface.
 *
 * Visual / WebGL behaviour (Three.js renderer, scene composition,
 * camera framing) lands when the editor adopts a headless WebGL
 * harness; the unit-level guarantees live in `fold-geometry.test.ts`.
 * These tests pin the wire shape so apps/service's host configs and
 * the editor's PaletteManager can drive the overlay directly.
 */

describe("FoldPreviewOverlayProps type", () => {
  it("requires panelMetadata + width + height; foldConfig is optional", () => {
    const minimal: FoldPreviewOverlayProps = {
      panelMetadata: { panels: [] },
      width: 800,
      height: 600,
    };
    expect(minimal.foldConfig).toBeUndefined();
    expect(minimal.backgroundColor).toBeUndefined();
  });

  it("accepts undefined panelMetadata for hosts that toggle the panel off", () => {
    const undef: FoldPreviewOverlayProps = {
      panelMetadata: undefined,
      width: 320,
      height: 240,
    };
    expect(undef.panelMetadata).toBeUndefined();
  });

  it("accepts the full additive shape (panelMetadata + foldConfig + bg)", () => {
    const full: FoldPreviewOverlayProps = {
      panelMetadata: {
        panels: [{ id: "p", pathData: "", bbox: { x: 0, y: 0, width: 10, height: 10 } }],
      },
      foldConfig: { edges: [], defaultAngleDeg: 0 },
      width: 800,
      height: 600,
      backgroundColor: "#f5f5f5",
    };
    expect(full.foldConfig?.edges).toEqual([]);
    expect(full.backgroundColor).toBe("#f5f5f5");
  });
});
