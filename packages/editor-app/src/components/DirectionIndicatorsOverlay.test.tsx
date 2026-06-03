// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  DirectionIndicatorsOverlayProps,
  DirectionIndicatorsSpec,
} from "./DirectionIndicatorsOverlay";

describe("DirectionIndicatorsSpec type", () => {
  it("requires widthPx + heightPx; all other fields optional", () => {
    const minimal: DirectionIndicatorsSpec = { widthPx: 400, heightPx: 200 };
    expect(minimal.widthPx).toBe(400);
    expect(minimal.fluteAxis).toBeUndefined();
    expect(minimal.grainAxis).toBeUndefined();
    expect(minimal.webDirection).toBeUndefined();
    expect(minimal.printSide).toBeUndefined();
  });

  it("accepts every flute / grain axis variant", () => {
    const h: DirectionIndicatorsSpec = { widthPx: 1, heightPx: 1, fluteAxis: "horizontal" };
    const v: DirectionIndicatorsSpec = { widthPx: 1, heightPx: 1, grainAxis: "vertical" };
    expect([h.fluteAxis, v.grainAxis]).toEqual(["horizontal", "vertical"]);
  });

  it("accepts every web direction variant", () => {
    const dirs: NonNullable<DirectionIndicatorsSpec["webDirection"]>[] = [
      "left-to-right",
      "right-to-left",
      "top-to-bottom",
      "bottom-to-top",
    ];
    for (const d of dirs) {
      const spec: DirectionIndicatorsSpec = { widthPx: 1, heightPx: 1, webDirection: d };
      expect(spec.webDirection).toBe(d);
    }
  });

  it("printSide discriminates outside vs inside", () => {
    const outside: DirectionIndicatorsSpec["printSide"] = "outside";
    const inside: DirectionIndicatorsSpec["printSide"] = "inside";
    expect([outside, inside]).toEqual(["outside", "inside"]);
  });
});

describe("DirectionIndicatorsOverlayProps type", () => {
  it("requires spec", () => {
    const props: DirectionIndicatorsOverlayProps = {
      spec: { widthPx: 400, heightPx: 300, fluteAxis: "horizontal", printSide: "inside" },
    };
    expect(props.spec.widthPx).toBe(400);
    expect(props.spec.printSide).toBe("inside");
  });
});
