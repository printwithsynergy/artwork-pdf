// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 I2 — Email notify panel.
 *
 * Third member of the Wave 4 integration family alongside I3
 * {@link SlackNotifyPanel} (Slack incoming webhooks) and I1
 * {@link WebhookNotifyPanel} (generic outbound webhooks). I2 targets
 * email — typically the longest-lived notification channel for
 * artwork-review workflows (approval pings, preflight blockers,
 * customer-facing job-submitted receipts).
 *
 * The host wires an {@link EmailNotifyFn} adapter (SMTP relay,
 * SendGrid, Postmark, AWS SES, internal Synergy node, etc.). The
 * panel handles event-template selection, recipient + cc + bcc
 * inputs, subject / body composition via {@link composeEmailMessage},
 * and the send-button state machine.
 *
 * Pairs with the synergy `email.notify` workflow node when one is
 * deployed; hosts without a synergy bridge can also POST straight to
 * their tenant SMTP / transactional-email provider — the adapter
 * shape is intentionally agnostic.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useState } from "react";

/**
 * The set of editor events that map to canonical email templates.
 * Mirrors I3's and I1's vocabulary so a single host-side trigger
 * source can fan out to all three integration panels.
 *
 * @public
 */
export type EmailNotificationEventKind =
  | "preflight-blocked"
  | "preflight-cleared"
  | "job-submitted"
  | "variant-approved"
  | "approval-requested"
  | "custom";

/**
 * Context passed to {@link composeEmailMessage}. Most fields are
 * optional and only render when the chosen template references them.
 *
 * @public
 */
export type EmailNotificationContext = {
  /** Human-readable document name surfaced in the subject + body. */
  documentName?: string;
  /** Stable identifier the host uses to link back to the document. */
  documentId?: string;
  /** Optional clickable URL — rendered as a "View artwork" link in
   *  the body so reviewers can jump straight into the editor. */
  documentUrl?: string;
  /** Preflight finding count (errors only for `"preflight-blocked"`,
   *  total resolved for `"preflight-cleared"`). */
  findingCount?: number;
  /** Variant id for `"variant-approved"`. */
  variantId?: string;
  /** Reviewer / submitter display name — surfaces as the byline in
   *  the body. */
  actor?: string;
  /** Free-form additional text appended to the canonical body (or,
   *  for `"custom"`, used as the entire body). */
  text?: string;
};

/**
 * Composed email payload — the panel emits this through the host
 * adapter. The subject + body split keeps the wire shape consumable
 * by SMTP / transactional-email APIs without further parsing. Plain
 * text only at this version; rich HTML can land in a future iteration
 * once hosts express a need.
 *
 * @public
 */
export type EmailNotificationPayload = {
  /** Primary recipients. At least one address is required at the
   *  panel level — the composer doesn't enforce that so it stays
   *  pure. */
  to: readonly string[];
  /** Optional carbon-copy list. */
  cc?: readonly string[];
  /** Optional blind carbon-copy list. */
  bcc?: readonly string[];
  /** Subject line. */
  subject: string;
  /** Plain-text body. */
  body: string;
};

const EMAIL_LIST_SEPARATOR = /[,;\s]+/;

/**
 * Pure helper — parses a comma / semicolon / whitespace-separated
 * address list into a deduplicated, trimmed array. Empty input
 * returns an empty array. Pure function; no I/O.
 *
 * @public
 */
export function parseEmailList(raw: string): readonly string[] {
  if (!raw.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(EMAIL_LIST_SEPARATOR)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Pure helper — composes an {@link EmailNotificationPayload} subject
 * and body from a kind + context + recipient lists. The subject is a
 * single canonical line per template; the body is a short multi-line
 * plaintext block that includes whatever fields the context supplies.
 *
 * `"custom"` uses `context.text` verbatim as the body and falls back
 * to a sensible default when the host left it empty — the helper
 * never silently drops the message.
 *
 * Pure function; no I/O.
 *
 * @public
 */
export function composeEmailMessage(
  kind: EmailNotificationEventKind,
  context: EmailNotificationContext,
  recipients: { to: readonly string[]; cc?: readonly string[]; bcc?: readonly string[] },
): EmailNotificationPayload {
  const subject = composeSubject(kind, context);
  const body = composeBody(kind, context);
  return {
    to: recipients.to,
    ...(recipients.cc && recipients.cc.length > 0 && { cc: recipients.cc }),
    ...(recipients.bcc && recipients.bcc.length > 0 && { bcc: recipients.bcc }),
    subject,
    body,
  };
}

function documentDisplayName(context: EmailNotificationContext): string {
  return context.documentName ?? context.documentId ?? "an artwork document";
}

function composeSubject(
  kind: EmailNotificationEventKind,
  context: EmailNotificationContext,
): string {
  const subject = documentDisplayName(context);
  switch (kind) {
    case "preflight-blocked":
      return `Preflight blocked: ${subject}`;
    case "preflight-cleared":
      return `Preflight cleared: ${subject}`;
    case "job-submitted":
      return `Job submitted: ${subject}`;
    case "variant-approved":
      return `Variant approved: ${subject}`;
    case "approval-requested":
      return `Approval requested: ${subject}`;
    case "custom":
      return `Update: ${subject}`;
  }
}

function composeBody(kind: EmailNotificationEventKind, context: EmailNotificationContext): string {
  if (kind === "custom") {
    const trailing = context.text?.trim();
    if (trailing) return trailing;
    return `Update on ${documentDisplayName(context)}.`;
  }
  const lines: string[] = [];
  const subject = documentDisplayName(context);
  switch (kind) {
    case "preflight-blocked": {
      const n = context.findingCount;
      const findingsFragment =
        typeof n === "number" ? ` ${n} finding${n === 1 ? "" : "s"} surfaced.` : "";
      lines.push(`Preflight is blocking ${subject}.${findingsFragment}`);
      break;
    }
    case "preflight-cleared":
      lines.push(`Preflight is now clear on ${subject}.`);
      break;
    case "job-submitted":
      lines.push(`A job has been submitted for ${subject}.`);
      break;
    case "variant-approved": {
      const v = context.variantId ? ` (variant ${context.variantId})` : "";
      lines.push(`A variant${v} was approved on ${subject}.`);
      break;
    }
    case "approval-requested":
      lines.push(`Approval is requested on ${subject}.`);
      break;
  }
  if (context.actor) lines.push(`By: ${context.actor}`);
  if (context.documentUrl) lines.push(`View artwork: ${context.documentUrl}`);
  if (context.text?.trim()) lines.push("", context.text.trim());
  return lines.join("\n");
}

/**
 * Host adapter — POSTs the composed payload to the wired email
 * provider (typically via a server-side proxy or the synergy
 * `email.notify` node). Resolves on accept; rejects on transport /
 * validation errors and the panel surfaces the message inline.
 *
 * @public
 */
export type EmailNotifyFn = (payload: EmailNotificationPayload) => Promise<void>;

/**
 * Human-readable labels for each event kind, in the order they
 * appear in the dropdown. Mirrors the I3 and I1 label maps so the
 * three integrations stay in lockstep.
 *
 * @public
 */
export const EMAIL_NOTIFICATION_EVENT_LABELS: Readonly<Record<EmailNotificationEventKind, string>> =
  {
    "preflight-blocked": "Preflight blocked",
    "preflight-cleared": "Preflight cleared",
    "job-submitted": "Job submitted",
    "variant-approved": "Variant approved",
    "approval-requested": "Approval requested",
    custom: "Custom message",
  };

/**
 * Configuration for the {@link EmailNotifyPanel}. The host always
 * supplies the {@link EmailNotifyFn}; the optional fields seed the
 * recipient + event dropdown defaults so the panel can open
 * prefilled for the common case.
 *
 * @public
 */
export type EmailNotifyPanelProps = {
  /** Host adapter, see {@link EmailNotifyFn}. */
  notify: EmailNotifyFn;
  /** Context the panel renders into the chosen template. */
  context: EmailNotificationContext;
  /** Optional initial event selection. Defaults to
   *  `"approval-requested"` — the most common email trigger. */
  defaultEvent?: EmailNotificationEventKind;
  /** Optional initial recipients (comma-separated for the input). */
  defaultTo?: string;
  /** Optional initial cc list. */
  defaultCc?: string;
  /** Optional initial bcc list. */
  defaultBcc?: string;
  /** Optional mapper that turns a notify error into a user-facing
   *  message. The default avoids leaking internal `Error.message`
   *  strings. */
  errorMessage?: (err: unknown) => string;
  /** Optional callback fired on successful notify so the host can
   *  show a confirmation toast / log analytics. */
  onSuccess?: (payload: EmailNotificationPayload) => void;
};

/**
 * Stateful panel — picks an event template, captures recipient
 * lists, lets the user append a custom note, composes the payload
 * via {@link composeEmailMessage}, and POSTs through the host
 * adapter.
 *
 * @public
 */
export function EmailNotifyPanel({
  notify,
  context,
  defaultEvent,
  defaultTo,
  defaultCc,
  defaultBcc,
  errorMessage,
  onSuccess,
}: EmailNotifyPanelProps): ReactElement {
  const [event, setEvent] = useState<EmailNotificationEventKind>(
    defaultEvent ?? "approval-requested",
  );
  const [toRaw, setToRaw] = useState(defaultTo ?? "");
  const [ccRaw, setCcRaw] = useState(defaultCc ?? "");
  const [bccRaw, setBccRaw] = useState(defaultBcc ?? "");
  const [note, setNote] = useState("");
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "sending" } | { kind: "ok" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  // Clear the outcome chip on any input edit — a "Sent" indicator
  // sitting next to an unsent payload reads as a lie.
  const resetOutcome = () => {
    setState((prev) => (prev.kind === "ok" || prev.kind === "error" ? { kind: "idle" } : prev));
  };

  const onClick = async () => {
    const to = parseEmailList(toRaw);
    if (to.length === 0) {
      setState({ kind: "error", message: "Add at least one recipient." });
      return;
    }
    setState({ kind: "sending" });
    const payload = composeEmailMessage(
      event,
      {
        ...context,
        ...(note.trim() && { text: note }),
      },
      {
        to,
        cc: parseEmailList(ccRaw),
        bcc: parseEmailList(bccRaw),
      },
    );
    try {
      await notify(payload);
      setState({ kind: "ok" });
      onSuccess?.(payload);
    } catch (err) {
      // Guard against a host-supplied errorMessage that throws or returns
      // a falsy / empty string — either would leave the user staring at a
      // blank error chip with no idea what happened.
      let message = "Couldn't send email notification.";
      if (errorMessage) {
        try {
          const candidate = errorMessage(err);
          if (candidate) message = candidate;
        } catch {
          // fall back to the default
        }
      }
      setState({ kind: "error", message });
    }
  };

  return (
    <div data-testid="email-notify-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Email notify</h3>
      </header>
      <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
        Event
        <select
          aria-label="Event"
          value={event}
          onChange={(e) => {
            setEvent(e.target.value as EmailNotificationEventKind);
            resetOutcome();
          }}
          style={{ display: "block", marginTop: "0.125rem", width: "100%" }}
        >
          {Object.entries(EMAIL_NOTIFICATION_EVENT_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
        To
        <input
          type="text"
          aria-label="To"
          placeholder="reviewer@example.com, …"
          value={toRaw}
          onChange={(e) => {
            setToRaw(e.target.value);
            resetOutcome();
          }}
          style={{ display: "block", marginTop: "0.125rem", width: "100%" }}
        />
      </label>
      <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
        Cc
        <input
          type="text"
          aria-label="Cc"
          placeholder="optional"
          value={ccRaw}
          onChange={(e) => {
            setCcRaw(e.target.value);
            resetOutcome();
          }}
          style={{ display: "block", marginTop: "0.125rem", width: "100%" }}
        />
      </label>
      <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
        Bcc
        <input
          type="text"
          aria-label="Bcc"
          placeholder="optional"
          value={bccRaw}
          onChange={(e) => {
            setBccRaw(e.target.value);
            resetOutcome();
          }}
          style={{ display: "block", marginTop: "0.125rem", width: "100%" }}
        />
      </label>
      <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
        Note
        <textarea
          aria-label="Note"
          placeholder="Optional — appended to the body"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            resetOutcome();
          }}
          rows={2}
          style={{ display: "block", marginTop: "0.125rem", width: "100%" }}
        />
      </label>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button
          type="button"
          onClick={onClick}
          disabled={state.kind === "sending"}
          aria-busy={state.kind === "sending"}
        >
          {state.kind === "sending" ? "Sending…" : "Send email"}
        </button>
        {state.kind === "ok" && (
          <output style={{ color: "#080", fontSize: "0.75rem" }}>Sent</output>
        )}
        {state.kind === "error" && (
          <span role="alert" style={{ color: "#a00", fontSize: "0.75rem" }}>
            {state.message}
          </span>
        )}
      </div>
    </div>
  );
}
