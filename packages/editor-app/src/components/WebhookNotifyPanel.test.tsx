// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  WebhookNotificationContext,
  WebhookNotificationEvent,
  WebhookNotificationEventKind,
  WebhookNotifyFn,
  WebhookNotifyPanelProps,
} from "./WebhookNotifyPanel";
import { WEBHOOK_NOTIFICATION_EVENT_LABELS, composeWebhookEvent } from "./WebhookNotifyPanel";

/**
 * Contract tests for WebhookNotifyPanel (Wave 4 I1).
 *
 * DOM behaviour (event picker, integration dropdown, send button)
 * lands when the editor adopts RTL. These tests pin the wire shape +
 * pure composer so hosts wiring the adapter have a stable contract.
 */

const FIXED_NOW = () => new Date("2026-06-02T17:00:00.000Z");

const FULL_CTX: WebhookNotificationContext = {
  documentName: "Acme 12oz Carton",
  documentId: "doc-123",
  documentUrl: "https://editor.example/doc-123",
  findingCount: 3,
  variantId: "var-7",
  actor: "Sam Reviewer",
  text: "looks good",
};

describe("WebhookNotificationEventKind", () => {
  it("enumerates the six event kinds", () => {
    const kinds: WebhookNotificationEventKind[] = [
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

describe("WEBHOOK_NOTIFICATION_EVENT_LABELS", () => {
  it("provides a human-readable label for every event kind", () => {
    expect(WEBHOOK_NOTIFICATION_EVENT_LABELS["preflight-blocked"]).toBe("Preflight blocked");
    expect(WEBHOOK_NOTIFICATION_EVENT_LABELS["preflight-cleared"]).toBe("Preflight cleared");
    expect(WEBHOOK_NOTIFICATION_EVENT_LABELS["job-submitted"]).toBe("Job submitted");
    expect(WEBHOOK_NOTIFICATION_EVENT_LABELS["variant-approved"]).toBe("Variant approved");
    expect(WEBHOOK_NOTIFICATION_EVENT_LABELS.custom).toBe("Custom event");
  });
});

describe("composeWebhookEvent", () => {
  it("stamps schemaVersion=1 and the provided ISO timestamp", () => {
    const event = composeWebhookEvent("job-submitted", FULL_CTX, { now: FIXED_NOW });
    expect(event.schemaVersion).toBe(1);
    expect(event.sentAt).toBe("2026-06-02T17:00:00.000Z");
  });

  it("preserves the structured context verbatim", () => {
    const event = composeWebhookEvent("preflight-blocked", FULL_CTX, { now: FIXED_NOW });
    expect(event.context).toEqual(FULL_CTX);
  });

  it("threads the integration id when supplied", () => {
    const event = composeWebhookEvent("job-submitted", FULL_CTX, {
      integration: "zapier-main",
      now: FIXED_NOW,
    });
    expect(event.integration).toBe("zapier-main");
  });

  it("omits the integration field when not supplied", () => {
    const event = composeWebhookEvent("job-submitted", FULL_CTX, { now: FIXED_NOW });
    expect(event.integration).toBeUndefined();
    expect(Object.hasOwn(event, "integration")).toBe(false);
  });

  it("omits the integration field when supplied as empty string", () => {
    const event = composeWebhookEvent("job-submitted", FULL_CTX, {
      integration: "",
      now: FIXED_NOW,
    });
    expect(Object.hasOwn(event, "integration")).toBe(false);
  });

  it("defaults `now` to wall-clock when omitted (returns parseable ISO)", () => {
    const event = composeWebhookEvent("custom", { text: "hi" });
    expect(Number.isNaN(Date.parse(event.sentAt))).toBe(false);
  });

  it("handles all six event kinds without dropping context", () => {
    const kinds: WebhookNotificationEventKind[] = [
      "preflight-blocked",
      "preflight-cleared",
      "job-submitted",
      "variant-approved",
      "approval-requested",
      "custom",
    ];
    for (const kind of kinds) {
      const event = composeWebhookEvent(kind, FULL_CTX, { now: FIXED_NOW });
      expect(event.kind).toBe(kind);
      expect(event.context).toEqual(FULL_CTX);
    }
  });

  it("works with a sparse context (only documentName)", () => {
    const event = composeWebhookEvent(
      "job-submitted",
      { documentName: "Sparse doc" },
      { now: FIXED_NOW },
    );
    expect(event.context.documentName).toBe("Sparse doc");
    expect(event.context.findingCount).toBeUndefined();
  });
});

describe("WebhookNotificationEvent type", () => {
  it("schemaVersion is a literal 1 — bump on breaking changes", () => {
    const event: WebhookNotificationEvent = {
      schemaVersion: 1,
      kind: "job-submitted",
      context: { documentName: "foo" },
      sentAt: "2026-06-02T17:00:00.000Z",
    };
    expect(event.schemaVersion).toBe(1);
  });
});

describe("WebhookNotifyPanelProps type", () => {
  it("requires notify + context; everything else optional", () => {
    const notify: WebhookNotifyFn = async () => undefined;
    const props: WebhookNotifyPanelProps = {
      notify,
      context: {},
    };
    expect(props.notify).toBe(notify);
    expect(props.defaultEvent).toBeUndefined();
    expect(props.integrations).toBeUndefined();
    expect(props.defaultIntegration).toBeUndefined();
    expect(props.errorMessage).toBeUndefined();
    expect(props.onSuccess).toBeUndefined();
  });

  it("accepts every optional knob", () => {
    let lastSent: WebhookNotificationEvent | undefined;
    const props: WebhookNotifyPanelProps = {
      notify: async () => undefined,
      context: FULL_CTX,
      defaultEvent: "preflight-blocked",
      integrations: ["zapier-main", "n8n-staging"],
      defaultIntegration: "n8n-staging",
      errorMessage: (err) => `Custom: ${String(err)}`,
      onSuccess: (e) => {
        lastSent = e;
      },
    };
    expect(props.defaultEvent).toBe("preflight-blocked");
    expect(props.integrations).toHaveLength(2);
    expect(props.defaultIntegration).toBe("n8n-staging");
    expect(props.errorMessage?.(new Error("boom"))).toBe("Custom: Error: boom");
    props.onSuccess?.({
      schemaVersion: 1,
      kind: "job-submitted",
      context: {},
      sentAt: "2026-06-02T17:00:00.000Z",
    });
    expect(lastSent?.kind).toBe("job-submitted");
  });
});
