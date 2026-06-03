// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { StreamingRenderEvent } from "../lib/streaming-render";
import type {
  StreamingRenderConnectFn,
  StreamingRenderProgressProps,
} from "./StreamingRenderProgress";

describe("StreamingRenderConnectFn type", () => {
  it("returns events iterable + close handle", () => {
    const adapter: StreamingRenderConnectFn = () => {
      async function* gen(): AsyncIterable<StreamingRenderEvent> {
        yield { kind: "page-start", pageIndex: 0, totalPages: 1 };
      }
      return { events: gen(), close: () => {} };
    };
    const handle = adapter();
    expect(typeof handle.close).toBe("function");
    expect(handle.events).toBeDefined();
  });
});

describe("StreamingRenderProgressProps type", () => {
  it("accepts a minimal config (no connect → read-only)", () => {
    const props: StreamingRenderProgressProps = {};
    expect(props.connect).toBeUndefined();
    expect(props.onDone).toBeUndefined();
    expect(props.onError).toBeUndefined();
  });

  it("accepts connect + onDone + onError", () => {
    let doneInfo: { pdfSha256: string; cacheKey: string } | null = null;
    let errInfo: { message: string; code: string } | null = null;
    const props: StreamingRenderProgressProps = {
      connect: () => ({
        events: (async function* () {
          /* empty */
        })(),
        close: () => {},
      }),
      onDone: (info) => {
        doneInfo = info;
      },
      onError: (info) => {
        errInfo = info;
      },
    };
    expect(typeof props.connect).toBe("function");
    props.onDone?.({ pdfSha256: "abc", cacheKey: "xyz" });
    props.onError?.({ message: "bad", code: "E_BAD" });
    expect(doneInfo).toEqual({ pdfSha256: "abc", cacheKey: "xyz" });
    expect(errInfo).toEqual({ message: "bad", code: "E_BAD" });
  });
});
