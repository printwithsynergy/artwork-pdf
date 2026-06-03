// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { primaryButtonStyle, secondaryButtonStyle } from "./panel-button-styles";

const BRAND = "#fc5102";

describe("primaryButtonStyle", () => {
  it("returns BRAND background + white text by default", () => {
    const s = primaryButtonStyle();
    expect(s.background).toBe(BRAND);
    expect(s.color).toBe("#ffffff");
    expect(s.opacity).toBe(1);
    expect(s.cursor).toBe("pointer");
  });

  it("dims and disables cursor when disabled=true", () => {
    const s = primaryButtonStyle(true);
    expect(s.background).toBe(BRAND);
    expect(s.opacity).toBe(0.5);
    expect(s.cursor).toBe("not-allowed");
  });
});

describe("secondaryButtonStyle", () => {
  it("uses transparent background + BRAND border/text", () => {
    const s = secondaryButtonStyle();
    expect(s.background).toBe("transparent");
    expect(s.color).toBe(BRAND);
    expect(s.border).toContain(BRAND);
    expect(s.opacity).toBe(1);
  });

  it("dims and disables cursor when disabled=true", () => {
    const s = secondaryButtonStyle(true);
    expect(s.opacity).toBe(0.5);
    expect(s.cursor).toBe("not-allowed");
  });

  it("reserves right-margin so it sits cleanly next to a primary", () => {
    expect(secondaryButtonStyle().marginRight).toBe("0.5rem");
  });
});
