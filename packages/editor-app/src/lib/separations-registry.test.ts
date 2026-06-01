// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  type EditorSeparation,
  findSpotByColor,
  listSpots,
  registerSpot,
  unregisterSpot,
} from "./separations-registry";

describe("registerSpot", () => {
  it("appends a new spot to an empty list", () => {
    const out = registerSpot([], "#fc5102", "Brand Orange");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      name: "Brand Orange",
      colorSpace: "Spot",
      hex: "#fc5102",
    });
  });

  it("is idempotent — registering the same hex twice replaces in place", () => {
    const first = registerSpot([], "#fc5102", "Brand Orange");
    const second = registerSpot(first, "#fc5102", "Brand Orange Renamed");
    expect(second).toHaveLength(1);
    expect(second[0]?.name).toBe("Brand Orange Renamed");
  });

  it("compares hex case-insensitively (normalizes to lowercase)", () => {
    const out = registerSpot([], "#FC5102", "Brand");
    expect(out[0]?.hex).toBe("#fc5102");
    // Looking up via uppercase finds the lowercase-stored entry.
    expect(findSpotByColor(out, "#FC5102")?.name).toBe("Brand");
  });

  it("accepts optional pantone + lab + type metadata", () => {
    const out = registerSpot([], "#ff0000", "PANTONE Red 032 C", {
      pantone: "PANTONE Red 032 C",
      lab: { L: 51, a: 73, b: 51 },
      type: "ink",
    });
    expect(out[0]).toMatchObject({
      pantone: "PANTONE Red 032 C",
      lab: { L: 51, a: 73, b: 51 },
      type: "ink",
    });
  });

  it("omits absent optional fields rather than emitting undefined", () => {
    const out = registerSpot([], "#000000", "Black");
    expect(out[0]).not.toHaveProperty("pantone");
    expect(out[0]).not.toHaveProperty("lab");
    expect(out[0]).not.toHaveProperty("type");
  });

  it("does not mutate the input array", () => {
    const seed: EditorSeparation[] = [];
    registerSpot(seed, "#fc5102", "Brand");
    expect(seed).toHaveLength(0);
  });
});

describe("unregisterSpot", () => {
  it("removes the matching entry", () => {
    const seed = registerSpot([], "#fc5102", "Brand");
    const out = unregisterSpot(seed, "#fc5102");
    expect(out).toHaveLength(0);
  });

  it("is a no-op when the hex is absent", () => {
    const seed = registerSpot([], "#fc5102", "Brand");
    const out = unregisterSpot(seed, "#000000");
    expect(out).toHaveLength(1);
  });

  it("does not mutate the input array", () => {
    const seed = registerSpot([], "#fc5102", "Brand");
    const before = [...seed];
    unregisterSpot(seed, "#fc5102");
    expect(seed).toEqual(before);
  });
});

describe("findSpotByColor / listSpots", () => {
  it("findSpotByColor returns the matching entry or undefined", () => {
    const seed = registerSpot([], "#fc5102", "Brand");
    expect(findSpotByColor(seed, "#fc5102")?.name).toBe("Brand");
    expect(findSpotByColor(seed, "#000000")).toBeUndefined();
  });

  it("listSpots returns a shallow copy (immutable contract)", () => {
    const seed = registerSpot([], "#fc5102", "Brand");
    const out = listSpots(seed);
    expect(out).toEqual(seed);
    expect(out).not.toBe(seed);
  });
});
