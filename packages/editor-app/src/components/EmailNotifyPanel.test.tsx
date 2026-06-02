// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  EmailNotificationContext,
  EmailNotificationEventKind,
  EmailNotifyFn,
  EmailNotifyPanelProps,
} from "./EmailNotifyPanel";
import {
  EMAIL_NOTIFICATION_EVENT_LABELS,
  composeEmailMessage,
  parseEmailList,
} from "./EmailNotifyPanel";

/**
 * Contract tests for EmailNotifyPanel (Wave 4 I2).
 *
 * DOM behaviour (event picker, recipient inputs, send button) lands
 * when the editor adopts RTL. These tests pin the pure helpers + wire
 * shapes so hosts wiring the adapter have a stable contract.
 */

const FULL_CTX: EmailNotificationContext = {
  documentName: "Acme 12oz Carton",
  documentId: "doc-123",
  documentUrl: "https://editor.example/doc-123",
  findingCount: 3,
  variantId: "var-7",
  actor: "Sam Reviewer",
};

describe("EmailNotificationEventKind", () => {
  it("enumerates the six event kinds", () => {
    const kinds: EmailNotificationEventKind[] = [
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

describe("EMAIL_NOTIFICATION_EVENT_LABELS", () => {
  it("provides a label for every event kind", () => {
    expect(EMAIL_NOTIFICATION_EVENT_LABELS["preflight-blocked"]).toBe("Preflight blocked");
    expect(EMAIL_NOTIFICATION_EVENT_LABELS["preflight-cleared"]).toBe("Preflight cleared");
    expect(EMAIL_NOTIFICATION_EVENT_LABELS["job-submitted"]).toBe("Job submitted");
    expect(EMAIL_NOTIFICATION_EVENT_LABELS["variant-approved"]).toBe("Variant approved");
    expect(EMAIL_NOTIFICATION_EVENT_LABELS["approval-requested"]).toBe("Approval requested");
    expect(EMAIL_NOTIFICATION_EVENT_LABELS.custom).toBe("Custom message");
  });
});

describe("parseEmailList", () => {
  it("returns an empty array for empty / whitespace-only input", () => {
    expect(parseEmailList("")).toEqual([]);
    expect(parseEmailList("   ")).toEqual([]);
    expect(parseEmailList("\n\t")).toEqual([]);
  });

  it("splits on commas", () => {
    expect(parseEmailList("a@x.com, b@x.com")).toEqual(["a@x.com", "b@x.com"]);
  });

  it("splits on semicolons", () => {
    expect(parseEmailList("a@x.com; b@x.com")).toEqual(["a@x.com", "b@x.com"]);
  });

  it("splits on whitespace", () => {
    expect(parseEmailList("a@x.com b@x.com")).toEqual(["a@x.com", "b@x.com"]);
  });

  it("deduplicates case-insensitively, preserving first-seen casing + order", () => {
    expect(parseEmailList("A@X.com, a@x.com, B@X.com")).toEqual(["A@X.com", "B@X.com"]);
  });

  it("trims surrounding whitespace on each entry", () => {
    expect(parseEmailList("  a@x.com  ,  b@x.com  ")).toEqual(["a@x.com", "b@x.com"]);
  });
});

describe("composeEmailMessage", () => {
  it("preflight-blocked subject + body include the document name and count", () => {
    const payload = composeEmailMessage("preflight-blocked", FULL_CTX, {
      to: ["reviewer@x.com"],
    });
    expect(payload.subject).toBe("Preflight blocked: Acme 12oz Carton");
    expect(payload.body).toContain("3 findings");
    expect(payload.body).toContain("By: Sam Reviewer");
    expect(payload.body).toContain("https://editor.example/doc-123");
  });

  it("preflight-blocked drops the count fragment when absent", () => {
    const { findingCount: _omit, ...ctxNoCount } = FULL_CTX;
    void _omit;
    const payload = composeEmailMessage("preflight-blocked", ctxNoCount, {
      to: ["reviewer@x.com"],
    });
    expect(payload.body).not.toContain("0 finding");
    expect(payload.body).not.toContain("undefined");
  });

  it("preflight-blocked singularizes the count fragment for one finding", () => {
    const payload = composeEmailMessage(
      "preflight-blocked",
      { ...FULL_CTX, findingCount: 1 },
      { to: ["reviewer@x.com"] },
    );
    expect(payload.body).toContain("1 finding surfaced");
    expect(payload.body).not.toContain("findings");
  });

  it("variant-approved includes the variant id when present", () => {
    const payload = composeEmailMessage("variant-approved", FULL_CTX, {
      to: ["reviewer@x.com"],
    });
    expect(payload.subject).toBe("Variant approved: Acme 12oz Carton");
    expect(payload.body).toContain("variant var-7");
  });

  it("custom uses context.text verbatim when present", () => {
    const payload = composeEmailMessage(
      "custom",
      { ...FULL_CTX, text: "Please prioritize." },
      { to: ["reviewer@x.com"] },
    );
    expect(payload.subject).toBe("Update: Acme 12oz Carton");
    expect(payload.body).toBe("Please prioritize.");
  });

  it("custom falls back to a sensible default when context.text is empty", () => {
    const payload = composeEmailMessage("custom", FULL_CTX, { to: ["reviewer@x.com"] });
    expect(payload.body).toBe("Update on Acme 12oz Carton.");
  });

  it("falls back to documentId when documentName is absent", () => {
    const payload = composeEmailMessage(
      "preflight-cleared",
      { documentId: "doc-x" },
      { to: ["a@b.com"] },
    );
    expect(payload.subject).toBe("Preflight cleared: doc-x");
  });

  it("falls back to a generic placeholder when both name and id are absent", () => {
    const payload = composeEmailMessage("preflight-cleared", {}, { to: ["a@b.com"] });
    expect(payload.subject).toBe("Preflight cleared: an artwork document");
  });

  it("omits cc + bcc when the lists are empty", () => {
    const payload = composeEmailMessage("job-submitted", FULL_CTX, {
      to: ["a@x.com"],
      cc: [],
      bcc: [],
    });
    expect(payload.cc).toBeUndefined();
    expect(payload.bcc).toBeUndefined();
  });

  it("threads cc + bcc when present", () => {
    const payload = composeEmailMessage("job-submitted", FULL_CTX, {
      to: ["a@x.com"],
      cc: ["cc1@x.com"],
      bcc: ["bcc1@x.com"],
    });
    expect(payload.cc).toEqual(["cc1@x.com"]);
    expect(payload.bcc).toEqual(["bcc1@x.com"]);
  });

  it("appends note text after the canonical body when present", () => {
    const payload = composeEmailMessage(
      "approval-requested",
      { ...FULL_CTX, text: "ETA tomorrow." },
      { to: ["a@x.com"] },
    );
    expect(payload.body).toContain("Approval is requested on Acme 12oz Carton.");
    expect(payload.body).toContain("ETA tomorrow.");
  });
});

describe("EmailNotifyPanelProps type", () => {
  it("requires notify + context; everything else optional", () => {
    const notify: EmailNotifyFn = async () => undefined;
    const props: EmailNotifyPanelProps = {
      notify,
      context: {},
    };
    expect(props.notify).toBe(notify);
    expect(props.defaultEvent).toBeUndefined();
    expect(props.defaultTo).toBeUndefined();
    expect(props.defaultCc).toBeUndefined();
    expect(props.defaultBcc).toBeUndefined();
    expect(props.errorMessage).toBeUndefined();
    expect(props.onSuccess).toBeUndefined();
  });

  it("accepts every optional knob", () => {
    const props: EmailNotifyPanelProps = {
      notify: async () => undefined,
      context: FULL_CTX,
      defaultEvent: "preflight-blocked",
      defaultTo: "a@x.com",
      defaultCc: "b@x.com",
      defaultBcc: "c@x.com",
      errorMessage: (err) => `Custom: ${String(err)}`,
      onSuccess: () => undefined,
    };
    expect(props.defaultEvent).toBe("preflight-blocked");
    expect(props.defaultTo).toBe("a@x.com");
    expect(props.errorMessage?.(new Error("boom"))).toBe("Custom: Error: boom");
  });
});
