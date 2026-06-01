// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  type JobSetupValue,
  type PreflightContext,
  preflightContextOf,
  type PrintProcess,
  type SubstrateClass,
} from "./JobSetupPanel";

// P1 — type-and-behaviour contract for the JobSetupValue → lint-pdf
// process-aware preflight projection. Locks down the keys lint-pdf
// reads from the wire (changing them is a breaking change for hosts).

describe("PrintProcess literal union", () => {
  it("accepts all five process classes", () => {
    const processes: PrintProcess[] = ["offset", "flexo", "gravure", "digital", "screen"];
    expect(processes).toHaveLength(5);
  });
});

describe("SubstrateClass literal union", () => {
  it("accepts the four lint-pdf substrate buckets", () => {
    const classes: SubstrateClass[] = ["coated", "uncoated", "newsprint", "synthetic"];
    expect(classes).toHaveLength(4);
  });
});

describe("preflightContextOf", () => {
  function baseValue(overrides: Partial<JobSetupValue["substrate"]> = {}): JobSetupValue {
    return {
      process: "offset",
      substrate: { id: "stock-1", color: "#fff", opacity: 1, finish: "matte", ...overrides },
    };
  }

  it("projects process + substrate.class onto the preflight context", () => {
    const value = baseValue({ class: "coated" });
    const ctx: PreflightContext = preflightContextOf(value);
    expect(ctx).toEqual({ process: "offset", substrate: "coated" });
  });

  it("returns substrate=undefined when the host hasn't picked a class", () => {
    const value = baseValue();
    const ctx = preflightContextOf(value);
    expect(ctx.process).toBe("offset");
    expect(ctx.substrate).toBeUndefined();
  });

  it("is a pure function — does not mutate input", () => {
    const value = baseValue({ class: "newsprint" });
    const before = JSON.stringify(value);
    preflightContextOf(value);
    expect(JSON.stringify(value)).toBe(before);
  });
});
