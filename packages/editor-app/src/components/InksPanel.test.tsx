// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { Ink, InksLoaderFn, InksPanelProps } from "./InksPanel";

/**
 * Contract tests for InksPanel's typed public surface.
 *
 * DOM behaviour (loading state, error rendering, ink-row clicks,
 * swatch chips) lands when the editor adopts RTL. These tests pin
 * the wire shape so apps/service's CompilePdfClient + the editor's
 * PaletteManager can drive the panel directly.
 */

describe("Ink type", () => {
  it("requires name + color_space + occurs_on_pages", () => {
    const ink: Ink = {
      name: "PANTONE 185 C",
      color_space: "Separation",
      occurs_on_pages: [0, 2],
    };
    expect(ink.name).toBe("PANTONE 185 C");
    expect(ink.color_space).toBe("Separation");
    expect(ink.occurs_on_pages).toEqual([0, 2]);
  });

  it("accepts DeviceN color_space", () => {
    const ink: Ink = {
      name: "Silver",
      color_space: "DeviceN",
      occurs_on_pages: [1],
    };
    expect(ink.color_space).toBe("DeviceN");
  });
});

describe("InksLoaderFn type", () => {
  it("is an async function from base64 → readonly Ink[]", async () => {
    const loader: InksLoaderFn = async (pdfB64) => {
      expect(typeof pdfB64).toBe("string");
      return [{ name: "Cyan", color_space: "Separation", occurs_on_pages: [0] }];
    };
    const inks = await loader("AAEC");
    expect(inks).toHaveLength(1);
  });
});

describe("InksPanelProps type", () => {
  it("requires pdfB64 (or undefined) + loader; onSelect is optional", () => {
    const props: InksPanelProps = {
      pdfB64: undefined,
      loader: async () => [],
    };
    expect(props.onSelect).toBeUndefined();
  });

  it("accepts an onSelect callback", () => {
    let selected: Ink | undefined;
    const props: InksPanelProps = {
      pdfB64: "AAEC",
      loader: async () => [],
      onSelect: (ink) => {
        selected = ink;
      },
    };
    props.onSelect?.({
      name: "Black",
      color_space: "Separation",
      occurs_on_pages: [0],
    });
    expect(selected?.name).toBe("Black");
  });
});
