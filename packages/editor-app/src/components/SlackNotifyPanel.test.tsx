// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  SlackNotificationContext,
  SlackNotificationEventKind,
  SlackNotificationPayload,
  SlackNotifyFn,
  SlackNotifyPanelProps,
} from "./SlackNotifyPanel";
import { SLACK_NOTIFICATION_EVENT_LABELS, composeSlackMessage } from "./SlackNotifyPanel";

/**
 * Contract tests for SlackNotifyPanel (Wave 4 I3).
 *
 * DOM behaviour (dropdown selection, channel override, send button
 * state transitions) lands when the editor adopts RTL. These tests
 * pin the wire shape so hosts wiring a Slack webhook (typically via
 * synergy's `slack.notify` node) have a stable contract, plus the
 * pure `composeSlackMessage` mapping every event template needs.
 */

const FULL_CTX: SlackNotificationContext = {
  documentName: "Acme Carton",
  documentId: "doc-1",
  documentUrl: "https://example.com/editor/doc-1",
  findingCount: 3,
  variantId: "EN-GB",
  actor: "Quincy",
};

describe("SlackNotificationEventKind type", () => {
  it("enumerates the six canonical templates", () => {
    const kinds: SlackNotificationEventKind[] = [
      "preflight-blocked",
      "preflight-cleared",
      "job-submitted",
      "variant-approved",
      "approval-requested",
      "custom",
    ];
    expect(kinds).toHaveLength(6);
  });
});

describe("SLACK_NOTIFICATION_EVENT_LABELS", () => {
  it("supplies a human label for every kind", () => {
    const kinds: SlackNotificationEventKind[] = [
      "preflight-blocked",
      "preflight-cleared",
      "job-submitted",
      "variant-approved",
      "approval-requested",
      "custom",
    ];
    for (const k of kinds) {
      expect(SLACK_NOTIFICATION_EVENT_LABELS[k]).toBeDefined();
      expect(SLACK_NOTIFICATION_EVENT_LABELS[k].length).toBeGreaterThan(0);
    }
  });
});

describe("composeSlackMessage", () => {
  it("renders 'preflight-blocked' with finding count + subject + actor + link", () => {
    const out = composeSlackMessage("preflight-blocked", FULL_CTX);
    expect(out.text).toContain("Preflight blocked");
    expect(out.text).toContain("Acme Carton");
    expect(out.text).toContain("by Quincy");
    expect(out.text).toContain("3 findings");
    expect(out.text).toContain("https://example.com/editor/doc-1");
  });

  it("singularizes 'finding' when count is 1", () => {
    const out = composeSlackMessage("preflight-blocked", { ...FULL_CTX, findingCount: 1 });
    expect(out.text).toContain("1 finding");
    expect(out.text).not.toContain("1 findings");
  });

  it("omits the count fragment when findingCount is absent", () => {
    const { findingCount: _, ...ctxWithoutCount } = FULL_CTX;
    const out = composeSlackMessage("preflight-blocked", ctxWithoutCount);
    expect(out.text).toContain("Preflight blocked");
    expect(out.text).not.toContain("0 findings");
    expect(out.text).not.toMatch(/: \d+ finding/);
  });

  it("uses documentId when documentName is absent", () => {
    const out = composeSlackMessage("preflight-cleared", { documentId: "doc-42" });
    expect(out.text).toContain("doc-42");
  });

  it("falls back to a generic subject when both name and id are absent", () => {
    const out = composeSlackMessage("job-submitted", {});
    expect(out.text).toContain("an artwork document");
  });

  it("includes variantId for 'variant-approved'", () => {
    const out = composeSlackMessage("variant-approved", FULL_CTX);
    expect(out.text).toContain("Variant approved");
    expect(out.text).toContain("EN-GB");
  });

  it("emits a placeholder when 'custom' is sent with empty context", () => {
    const out = composeSlackMessage("custom", { documentName: "Acme Carton" });
    expect(out.text).toContain("Acme Carton");
  });

  it("'custom' renders context.text verbatim when present", () => {
    const out = composeSlackMessage("custom", { text: "Ad-hoc note." });
    expect(out.text).toBe("Ad-hoc note.");
  });

  it("omits the actor clause when actor is absent", () => {
    const out = composeSlackMessage("job-submitted", { documentName: "Acme" });
    expect(out.text).not.toContain("by ");
  });

  it("does not set channel — channel is a panel-level override", () => {
    const out = composeSlackMessage("approval-requested", FULL_CTX);
    expect(out.channel).toBeUndefined();
  });
});

describe("SlackNotifyFn type", () => {
  it("is an async function from payload → void", async () => {
    const captured: SlackNotificationPayload[] = [];
    const notify: SlackNotifyFn = async (payload) => {
      captured.push(payload);
    };
    await notify({ text: "hello", channel: "#test" });
    expect(captured).toHaveLength(1);
    expect(captured[0]?.channel).toBe("#test");
  });
});

describe("SlackNotifyPanelProps type", () => {
  it("requires notify + context; defaults / callbacks optional", () => {
    const props: SlackNotifyPanelProps = {
      notify: async () => {},
      context: { documentName: "x" },
    };
    expect(props.defaultEvent).toBeUndefined();
    expect(props.onSuccess).toBeUndefined();
  });

  it("accepts the full optional surface", () => {
    let observed: SlackNotificationPayload | undefined;
    const props: SlackNotifyPanelProps = {
      notify: async () => {},
      context: FULL_CTX,
      defaultEvent: "approval-requested",
      defaultChannel: "#preflight",
      errorMessage: (e) => `oops: ${String(e)}`,
      onSuccess: (p) => {
        observed = p;
      },
    };
    props.onSuccess?.({ text: "ok" });
    expect(observed?.text).toBe("ok");
    expect(props.defaultEvent).toBe("approval-requested");
  });
});
