// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  WhiteUnderbaseGeneratorFn,
  WhiteUnderbasePanelProps,
  WhiteUnderbaseResult,
  WhiteUnderbaseSpec,
} from "./WhiteUnderbasePanel";
import { DEFAULT_WHITE_UNDERBASE_SPEC, validateWhiteUnderbaseSpec } from "./WhiteUnderbasePanel";

/**
 * Contract tests for WhiteUnderbasePanel (Wave 3 C2).
 *
 * DOM behaviour (input changes, generate-click dispatch) lands when
 * the editor adopts RTL. These tests pin the pure helper + types so
 * hosts wiring the adapter have a stable contract.
 */

describe("WhiteUnderbaseSpec type", () => {
  it("requires every field", () => {
    const spec: WhiteUnderbaseSpec = {
      separationName: "White",
      opacity: 1,
      chokeMm: 0,
      knockoutMode: "solid",
    };
    expect(spec.separationName).toBe("White");
    expect(spec.opacity).toBe(1);
    expect(spec.chokeMm).toBe(0);
    expect(spec.knockoutMode).toBe("solid");
  });

  it("knockoutMode is a discriminated string union", () => {
    const a: WhiteUnderbaseSpec["knockoutMode"] = "solid";
    const b: WhiteUnderbaseSpec["knockoutMode"] = "subtract-cmyk";
    expect([a, b]).toEqual(["solid", "subtract-cmyk"]);
  });
});

describe("DEFAULT_WHITE_UNDERBASE_SPEC", () => {
  it("uses White as the default separation name", () => {
    expect(DEFAULT_WHITE_UNDERBASE_SPEC.separationName).toBe("White");
  });
  it("defaults to solid full coverage with no choke", () => {
    expect(DEFAULT_WHITE_UNDERBASE_SPEC.opacity).toBe(1);
    expect(DEFAULT_WHITE_UNDERBASE_SPEC.chokeMm).toBe(0);
    expect(DEFAULT_WHITE_UNDERBASE_SPEC.knockoutMode).toBe("solid");
  });
});

describe("validateWhiteUnderbaseSpec", () => {
  it("accepts the default spec", () => {
    expect(validateWhiteUnderbaseSpec(DEFAULT_WHITE_UNDERBASE_SPEC)).toBeNull();
  });

  it("rejects an empty separation name", () => {
    const err = validateWhiteUnderbaseSpec({
      ...DEFAULT_WHITE_UNDERBASE_SPEC,
      separationName: "",
    });
    expect(err).toMatch(/separation name/i);
  });

  it("rejects whitespace-only separation names", () => {
    const err = validateWhiteUnderbaseSpec({
      ...DEFAULT_WHITE_UNDERBASE_SPEC,
      separationName: "   ",
    });
    expect(err).toMatch(/separation name/i);
  });

  it("rejects opacity outside [0, 1]", () => {
    expect(validateWhiteUnderbaseSpec({ ...DEFAULT_WHITE_UNDERBASE_SPEC, opacity: -0.1 })).toMatch(
      /opacity/i,
    );
    expect(validateWhiteUnderbaseSpec({ ...DEFAULT_WHITE_UNDERBASE_SPEC, opacity: 1.5 })).toMatch(
      /opacity/i,
    );
  });

  it("accepts opacity 0 and 1 (endpoints)", () => {
    expect(validateWhiteUnderbaseSpec({ ...DEFAULT_WHITE_UNDERBASE_SPEC, opacity: 0 })).toBeNull();
    expect(validateWhiteUnderbaseSpec({ ...DEFAULT_WHITE_UNDERBASE_SPEC, opacity: 1 })).toBeNull();
  });

  it("rejects negative choke", () => {
    const err = validateWhiteUnderbaseSpec({
      ...DEFAULT_WHITE_UNDERBASE_SPEC,
      chokeMm: -1,
    });
    expect(err).toMatch(/choke/i);
  });

  it("warns on implausibly large choke (> 5 mm)", () => {
    const err = validateWhiteUnderbaseSpec({
      ...DEFAULT_WHITE_UNDERBASE_SPEC,
      chokeMm: 10,
    });
    expect(err).toMatch(/implausibly|double-check/i);
  });

  it("returns first error encountered", () => {
    // Bad name first → should report the name error, not the opacity error
    const err = validateWhiteUnderbaseSpec({
      separationName: "",
      opacity: 5,
      chokeMm: 0,
      knockoutMode: "solid",
    });
    expect(err).toMatch(/separation name/i);
  });
});

describe("WhiteUnderbasePanelProps type", () => {
  it("accepts a minimal config (no generator → read-only)", () => {
    const props: WhiteUnderbasePanelProps = {};
    expect(props.generator).toBeUndefined();
    expect(props.initialSpec).toBeUndefined();
    expect(props.onGenerated).toBeUndefined();
  });

  it("accepts generator + onGenerated", async () => {
    const result: WhiteUnderbaseResult = { separationName: "White", coveragePct: 42.5 };
    const generator: WhiteUnderbaseGeneratorFn = async () => result;
    let landed: WhiteUnderbaseResult | null = null;
    const props: WhiteUnderbasePanelProps = {
      generator,
      onGenerated: (r) => {
        landed = r;
      },
    };
    const out = await props.generator?.(DEFAULT_WHITE_UNDERBASE_SPEC);
    expect(out).toEqual(result);
    props.onGenerated?.(result);
    expect(landed).toEqual(result);
  });

  it("accepts initialSpec partial override", () => {
    const props: WhiteUnderbasePanelProps = {
      initialSpec: { separationName: "WhiteUnderbase", chokeMm: 0.2 },
    };
    expect(props.initialSpec?.separationName).toBe("WhiteUnderbase");
    expect(props.initialSpec?.chokeMm).toBe(0.2);
    expect(props.initialSpec?.opacity).toBeUndefined();
  });
});
