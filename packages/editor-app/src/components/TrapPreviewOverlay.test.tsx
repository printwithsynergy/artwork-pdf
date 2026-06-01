// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  TrapPreviewFn,
  TrapPreviewOperation,
  TrapPreviewOverlayProps,
} from "./TrapPreviewOverlay";

/**
 * Contract tests for the TrapPreviewOverlay's typed public surface.
 *
 * The visual / DOM behaviour requires jsdom (overlay canvas, ref
 * wiring, debounce timers) and isn't covered here — those land when
 * the editor adopts RTL in a future pass. These tests pin the wire
 * shape so D2's interactive trap editor (PR-13) and any host that
 * mounts the overlay directly can rely on the published API.
 */

describe("TrapPreviewOperation type", () => {
  it("accepts a well-formed operation", () => {
    const op: TrapPreviewOperation = {
      page_index: 0,
      rect_pt: [100, 100, 300, 300],
      from_ink: "Y",
      to_ink: "K",
      width_pt: 0.144,
    };
    expect(op.page_index).toBe(0);
    expect(op.rect_pt).toHaveLength(4);
  });

  it("width_pt is optional (older trap-diff payloads omit it)", () => {
    const op: TrapPreviewOperation = {
      page_index: 1,
      rect_pt: [0, 0, 50, 50],
      from_ink: "M",
      to_ink: "K",
    };
    expect(op.width_pt).toBeUndefined();
  });
});

describe("TrapPreviewFn type", () => {
  it("is a zero-arg async returning operations", async () => {
    const fn: TrapPreviewFn = async () => ({
      operations: [
        {
          page_index: 0,
          rect_pt: [10, 10, 20, 20],
          from_ink: "C",
          to_ink: "M",
        },
      ],
    });
    const result = await fn();
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]?.from_ink).toBe("C");
  });
});

describe("TrapPreviewOverlayProps type", () => {
  it("requires the structural fields and accepts a null previewFn", () => {
    const props: TrapPreviewOverlayProps = {
      width: 800,
      height: 600,
      pageIndex: 1,
      pointsToPx: 1,
      trigger: null,
      previewFn: null,
    };
    expect(props.previewFn).toBeNull();
  });

  it("debounceMs is optional", () => {
    const previewFn: TrapPreviewFn = async () => ({ operations: [] });
    const props: TrapPreviewOverlayProps = {
      width: 100,
      height: 100,
      pageIndex: 1,
      pointsToPx: 0.5,
      trigger: [1, 2, 3],
      previewFn,
    };
    expect(props.debounceMs).toBeUndefined();
  });
});
