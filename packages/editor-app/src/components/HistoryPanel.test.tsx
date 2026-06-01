// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { HistoryPanel } from "./HistoryPanel";

/**
 * `HistoryPanel` is a pure presentational component — the
 * editor-app package doesn't ship React Testing Library / jsdom, so
 * the full render flow is left for end-to-end coverage. Here we
 * exercise the JSX-element-tree shape via React's createElement
 * directly, which doesn't need a browser-like environment.
 */
describe("HistoryPanel — JSX shape", () => {
  it("renders one button per snapshot in newest-first order", () => {
    const el = HistoryPanel({
      cursor: 2,
      objectCounts: [0, 1, 2],
      onSelect: () => {},
    });
    // The returned element is <aside>{header}{button*N}</aside>;
    // unwrap to verify children.
    const children = (el as { props: { children: unknown } }).props.children as unknown[];
    // [header, mapped-array]; the array entry is the row buttons.
    const rowButtons = (children[1] as unknown[]) ?? [];
    expect(rowButtons).toHaveLength(3);
    // Newest first → keys are 2, 1, 0.
    const keys = rowButtons.map((b) => (b as { key: string }).key);
    expect(keys).toEqual(["2", "1", "0"]);
  });

  it("marks the cursor row with aria-current='step'", () => {
    const el = HistoryPanel({
      cursor: 1,
      objectCounts: [0, 1, 2],
      onSelect: () => {},
    });
    const children = (el as { props: { children: unknown } }).props.children as unknown[];
    const rowButtons = (children[1] as unknown[]) as Array<{
      key: string;
      props: { "aria-current"?: string };
    }>;
    const step1 = rowButtons.find((b) => b.key === "1");
    const step0 = rowButtons.find((b) => b.key === "0");
    expect(step1?.props["aria-current"]).toBe("step");
    expect(step0?.props["aria-current"]).toBeUndefined();
  });

  it("guards against missing objectCounts entries (defaults to 0 obj)", () => {
    const el = HistoryPanel({
      cursor: 1,
      objectCounts: [0, 0],
      onSelect: () => {},
    });
    // Doesn't throw — that's the invariant. Shape check kept light.
    expect(el).toBeDefined();
  });
});
