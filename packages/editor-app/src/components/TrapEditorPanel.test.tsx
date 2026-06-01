// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { TrapEditorPanelProps, TrapEditorValue } from "./TrapEditorPanel";

/**
 * Contract tests for TrapEditorPanel's typed public surface.
 *
 * Visual / DOM behaviour (range slider, select wiring, useId IDs)
 * needs jsdom + RTL and lands when the editor adopts that toolchain
 * for component tests. These tests pin the wire shape so D1's
 * preview overlay (PR-12) and any host driving the panel from a
 * page's `trapConfig` can rely on the published API.
 */

describe("TrapEditorValue type", () => {
  it("requires widthMm; mode is optional", () => {
    const minimal: TrapEditorValue = { widthMm: 0.1 };
    const full: TrapEditorValue = { widthMm: 0.25, mode: "spread" };
    expect(minimal.widthMm).toBe(0.1);
    expect(full.mode).toBe("spread");
    expect(minimal.mode).toBeUndefined();
  });

  it("mode accepts only auto / spread / choke", () => {
    // TypeScript enforces the union; this asserts the runtime values
    // round-trip cleanly. `mode` is omitted (rather than set to
    // `undefined`) to satisfy exactOptionalPropertyTypes — both
    // representations are observationally equivalent for the consumer.
    const modes = ["auto", "spread", "choke"] as const;
    for (const mode of modes) {
      const v: TrapEditorValue = { widthMm: 0.144, mode };
      expect(v.widthMm).toBe(0.144);
    }
    const withoutMode: TrapEditorValue = { widthMm: 0.144 };
    expect(withoutMode.mode).toBeUndefined();
  });
});

describe("TrapEditorPanelProps type", () => {
  it("requires value + onChange; range params are optional", () => {
    const handler = (next: TrapEditorValue) => {
      expect(next.widthMm).toBeGreaterThanOrEqual(0);
    };
    const props: TrapEditorPanelProps = {
      value: undefined,
      onChange: handler,
    };
    expect(props.value).toBeUndefined();
    expect(typeof props.onChange).toBe("function");
  });

  it("accepts a fully-specified value with custom range bounds", () => {
    const props: TrapEditorPanelProps = {
      value: { widthMm: 0.5, mode: "choke" },
      onChange: () => {},
      minMm: 0.05,
      maxMm: 2.0,
      stepMm: 0.005,
    };
    expect(props.value?.mode).toBe("choke");
    expect(props.maxMm).toBe(2.0);
  });
});
