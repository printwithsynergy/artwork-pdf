// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { SubstrateSimOverlayProps, SubstrateSimSpec } from "./SubstrateSimOverlay";

describe("SubstrateSimSpec type", () => {
  it("requires every field", () => {
    const spec: SubstrateSimSpec = {
      widthPx: 400,
      heightPx: 200,
      color: "#d2b48c",
      opacity: 0.6,
      finish: "uncoated",
    };
    expect(spec.color).toBe("#d2b48c");
    expect(spec.opacity).toBe(0.6);
    expect(spec.finish).toBe("uncoated");
  });

  it("accepts every finish variant", () => {
    const variants: SubstrateSimSpec["finish"][] = ["matte", "gloss", "satin", "uncoated"];
    for (const finish of variants) {
      const s: SubstrateSimSpec = { widthPx: 1, heightPx: 1, color: "#fff", opacity: 1, finish };
      expect(s.finish).toBe(finish);
    }
  });

  it("accepts opacity at both endpoints", () => {
    const opaque: SubstrateSimSpec = {
      widthPx: 1,
      heightPx: 1,
      color: "#fff",
      opacity: 1,
      finish: "matte",
    };
    const clear: SubstrateSimSpec = {
      widthPx: 1,
      heightPx: 1,
      color: "transparent",
      opacity: 0,
      finish: "matte",
    };
    expect([opaque.opacity, clear.opacity]).toEqual([1, 0]);
  });

  it("accepts representative substrate colours", () => {
    const colors = ["#d2b48c", "#c0c0c0", "transparent", "#fff", "rgb(255,255,255)"];
    for (const color of colors) {
      const s: SubstrateSimSpec = {
        widthPx: 100,
        heightPx: 100,
        color,
        opacity: 0.7,
        finish: "satin",
      };
      expect(s.color).toBe(color);
    }
  });
});

describe("SubstrateSimOverlayProps type", () => {
  it("wraps a SubstrateSimSpec", () => {
    const props: SubstrateSimOverlayProps = {
      spec: { widthPx: 400, heightPx: 200, color: "#d2b48c", opacity: 0.6, finish: "uncoated" },
    };
    expect(props.spec.color).toBe("#d2b48c");
    expect(props.spec.finish).toBe("uncoated");
  });
});
