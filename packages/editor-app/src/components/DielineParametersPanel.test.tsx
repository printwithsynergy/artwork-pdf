// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { DielineParameters, DielineParametersPanelProps } from "./DielineParametersPanel";

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
});
