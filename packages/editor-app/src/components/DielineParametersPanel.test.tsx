// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { DielineParameters, DielineParametersPanelProps } from "./DielineParametersPanel";
import { validateDielineParameters } from "./DielineParametersPanel";

/**
 * Contract tests for DielineParametersPanel's typed public surface.
 *
 * DOM behaviour (numeric input clamping, depth-clear semantics)
 * lands when the editor adopts RTL. These tests pin the wire shape so
 * hosts wiring a parametric CF2/codex-pdf carton generator have a
 * stable type contract to target.
 */

describe("DielineParameters type", () => {
  it("requires widthMm + heightMm + bleedMm; depthMm is optional", () => {
    const flat: DielineParameters = {
      widthMm: 100,
      heightMm: 150,
      bleedMm: 3,
    };
    expect(flat.depthMm).toBeUndefined();
    expect(flat.widthMm).toBe(100);
  });

  it("accepts a depthMm for boxy dielines", () => {
    const carton: DielineParameters = {
      widthMm: 80,
      heightMm: 120,
      depthMm: 40,
      bleedMm: 3,
    };
    expect(carton.depthMm).toBe(40);
  });
});

describe("DielineParametersPanelProps type", () => {
  it("requires value (or undefined) + onChange", () => {
    const props: DielineParametersPanelProps = {
      value: undefined,
      onChange: () => {
        /* host wires regen here */
      },
    };
    expect(props.value).toBeUndefined();
  });

  it("accepts optional clamping bounds and hideDepth", () => {
    let latest: DielineParameters | undefined;
    const props: DielineParametersPanelProps = {
      value: { widthMm: 100, heightMm: 50, bleedMm: 3 },
      onChange: (next) => {
        latest = next;
      },
      minWidthMm: 50,
      maxWidthMm: 500,
      hideDepth: true,
    };
    props.onChange({ widthMm: 200, heightMm: 100, bleedMm: 3 });
    expect(latest?.widthMm).toBe(200);
    expect(props.hideDepth).toBe(true);
  });

  it("accepts an onCommit callback distinct from onChange (Wave 4 S5)", () => {
    const commits: DielineParameters[] = [];
    const props: DielineParametersPanelProps = {
      value: { widthMm: 100, heightMm: 50, bleedMm: 3 },
      onChange: () => {
        /* live edits */
      },
      onCommit: (next) => commits.push(next),
    };
    // The callback contract is "fires when finished editing" — the
    // panel itself dedupes no-op blurs internally via a ref. This
    // test pins the host-facing shape, not the panel's internal
    // dedup logic (which is covered by the DOM test once RTL lands).
    props.onCommit?.({ widthMm: 100, heightMm: 50, bleedMm: 3 });
    expect(commits).toHaveLength(1);
    expect(commits[0]?.widthMm).toBe(100);
  });

  it("accepts hidePreview to suppress the live preview thumbnail", () => {
    const props: DielineParametersPanelProps = {
      value: { widthMm: 100, heightMm: 50, bleedMm: 3 },
      onChange: () => {
        /* noop */
      },
      hidePreview: true,
    };
    expect(props.hidePreview).toBe(true);
  });
});

describe("validateDielineParameters (Wave 4 S5)", () => {
  it("returns no warnings for well-sized parameters", () => {
    const warnings = validateDielineParameters({
      widthMm: 200,
      heightMm: 300,
      depthMm: 50,
      bleedMm: 3,
    });
    expect(warnings).toEqual([]);
  });

  it("warns when bleed exceeds 50% of the shorter trim dimension", () => {
    const warnings = validateDielineParameters({
      widthMm: 10,
      heightMm: 20,
      bleedMm: 8,
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Bleed/);
    expect(warnings[0]).toMatch(/50%/);
  });

  it("warns when depth exceeds the shorter trim dimension", () => {
    const warnings = validateDielineParameters({
      widthMm: 80,
      heightMm: 120,
      depthMm: 100,
      bleedMm: 3,
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Depth/);
    expect(warnings[0]).toMatch(/carton would not close/);
  });

  it("can surface multiple warnings simultaneously", () => {
    const warnings = validateDielineParameters({
      widthMm: 10,
      heightMm: 10,
      depthMm: 30,
      bleedMm: 6,
    });
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("does not warn for a flat dieline with no depth", () => {
    const warnings = validateDielineParameters({
      widthMm: 100,
      heightMm: 200,
      bleedMm: 3,
    });
    expect(warnings).toEqual([]);
  });

  it("suppresses depth + bleed warnings when a trim dimension is zero (mid-edit)", () => {
    // Both width and height of 0 — user has cleared one mid-edit.
    // Bleed and depth warnings should not flash in that transient
    // state because `minTrim` is 0.
    const warnings = validateDielineParameters({
      widthMm: 0,
      heightMm: 100,
      depthMm: 50,
      bleedMm: 5,
    });
    expect(warnings).toEqual([]);
  });
});
