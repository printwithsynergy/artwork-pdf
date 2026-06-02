// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 I3 — Slack-notify panel.
 *
 * A small panel that lets the user emit a Slack notification keyed
 * to a typed editor event (preflight cleared, job submitted, variant
 * approved, …). The panel handles the UI; the actual webhook POST
 * is host-wired via a {@link SlackNotifyFn} adapter so the editor
 * stays runtime-free of any Slack SDK / fetch wrapper.
 *
 * Pairs with the synergy `slack.notify` workflow node when one is
 * deployed — the host typically wires `notify` to that node so the
 * webhook URL stays server-side. Hosts without a synergy bridge can
 * also POST straight to a Slack incoming-webhook URL from their own
 * client code; the adapter shape is intentionally agnostic.
 *
 * Designed around the same loader/adapter pattern as
 * {@link MisEstimateButton}, {@link SwatchesPicker}, etc.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useState } from "react";

/**
 * The set of editor events that map to canonical Slack message
 * templates. `"custom"` is the escape hatch — when the user wants to
 * send a free-form message that isn't tied to an event,
 * {@link composeSlackMessage} renders just `context.text` and ignores
 * the rest of the context.
 *
 * @public
 */
export type SlackNotificationEventKind =
  | "preflight-blocked"
  | "preflight-cleared"
  | "job-submitted"
  | "variant-approved"
  | "approval-requested"
  | "custom";

/**
 * Context passed to {@link composeSlackMessage}. Most fields are
 * optional and only render when the chosen event template references
 * them — e.g. `findingCount` is consulted by `"preflight-blocked"` and
 * `"preflight-cleared"` and ignored otherwise.
 *
 * @public
 */
export type SlackNotificationContext = {
  /** Human-readable document name surfaced as the message subject. */
  documentName?: string;
  /** Stable identifier the host uses to link back to the document. */
  documentId?: string;
  /** Optional clickable URL — Slack renders this as a link below the
   *  subject line so reviewers can jump straight into the editor. */
  documentUrl?: string;
  /** Preflight finding count (errors only for `"preflight-blocked"`,
   *  total resolved for `"preflight-cleared"`). */
  findingCount?: number;
  /** Variant id for `"variant-approved"`. */
  variantId?: string;
  /** Reviewer / submitter display name surfaced as the message
   *  byline. */
  actor?: string;
  /** Free-form additional text appended to the canonical template
   *  (or, for `"custom"`, used as the entire body). */
  text?: string;
};

/**
 * Canonical Slack incoming-webhook payload shape (subset: only the
 * fields the panel emits). Hosts that need richer payloads (`blocks`,
 * `attachments`, threading) wrap their own adapter that augments the
 * panel output before POSTing.
 *
 * @public
 */
export type SlackNotificationPayload = {
  /** Optional channel override (e.g. `"#preflight"`). When absent the
   *  host's webhook URL determines the channel. */
  channel?: string;
  /** Message text. Slack's webhook treats this as the fallback /
   *  notification text and the main body when no `blocks` are
   *  supplied. */
  text: string;
};

/**
 * Pure helper — renders a {@link SlackNotificationContext} into a
 * canonical Slack message payload. The mapping is intentionally
 * simple (one short line per event template) so hosts that want
 * richer messages can post-process the output. Pure function; no I/O.
 *
 * `"custom"` returns `context.text` verbatim (or a placeholder when
 * empty) — the helper never silently drops the message.
 *
 * @public
 */
export function composeSlackMessage(
  kind: SlackNotificationEventKind,
  context: SlackNotificationContext,
): SlackNotificationPayload {
  const subject = context.documentName ?? context.documentId ?? "an artwork document";
  const actor = context.actor ? ` by ${context.actor}` : "";
  const link = context.documentUrl ? ` <${context.documentUrl}|open>` : "";
  const trailer = context.text ? ` — ${context.text}` : "";

  switch (kind) {
    case "preflight-blocked": {
      const n = context.findingCount ?? 0;
      return {
        text: `Preflight blocked on ${subject}${actor}: ${n} finding${n === 1 ? "" : "s"}${link}${trailer}`,
      };
    }
    case "preflight-cleared":
      return {
        text: `Preflight cleared on ${subject}${actor}${link}${trailer}`,
      };
    case "job-submitted":
      return {
        text: `Job submitted for ${subject}${actor}${link}${trailer}`,
      };
    case "variant-approved": {
      const v = context.variantId ? ` (${context.variantId})` : "";
      return {
        text: `Variant approved on ${subject}${v}${actor}${link}${trailer}`,
      };
    }
    case "approval-requested":
      return {
        text: `Approval requested on ${subject}${actor}${link}${trailer}`,
      };
    case "custom":
      return {
        text: context.text?.trim() ? context.text : `Update on ${subject}${actor}${link}`,
      };
  }
}

/**
 * Host adapter — POSTs the composed payload to Slack (typically via
 * a server-side proxy or the synergy `slack.notify` node). Resolves
 * on accept; rejects on transport / validation errors and the panel
 * surfaces the message inline.
 *
 * @public
 */
export type SlackNotifyFn = (payload: SlackNotificationPayload) => Promise<void>;

/**
 * Human-readable labels for each event kind, in the order they
 * appear in the dropdown. Exported so hosts that re-use the picker
 * shape (e.g. in a settings page) stay in lockstep with the panel.
 *
 * @public
 */
export const SLACK_NOTIFICATION_EVENT_LABELS: Readonly<Record<SlackNotificationEventKind, string>> =
  {
    "preflight-blocked": "Preflight blocked",
    "preflight-cleared": "Preflight cleared",
    "job-submitted": "Job submitted",
    "variant-approved": "Variant approved",
    "approval-requested": "Approval requested",
    custom: "Custom message",
  };

/**
 * @public
 */
export type SlackNotifyPanelProps = {
  /** Host adapter, see {@link SlackNotifyFn}. */
  notify: SlackNotifyFn;
  /** Context the panel renders into the chosen event template. The
   *  host typically wires this to the active document. */
  context: SlackNotificationContext;
  /** Optional initial event selection. Defaults to
   *  `"preflight-blocked"` — the most common trigger. */
  defaultEvent?: SlackNotificationEventKind;
  /** Optional channel override. When absent, the panel's "Channel"
   *  input is empty and the host's webhook URL decides routing. */
  defaultChannel?: string;
  /** Optional mapper that turns a notify error into a user-facing
   *  message. The default avoids leaking internal `Error.message`
   *  strings; hosts that want richer surfaces (e.g. validation-error
   *  toasts) pass their own mapper. The original error is still
   *  passed in so hosts can log it. */
  errorMessage?: (err: unknown) => string;
  /** Optional callback fired on successful notify so the host can
   *  show a confirmation toast / log analytics. */
  onSuccess?: (payload: SlackNotificationPayload) => void;
};

/**
 * Stateful panel — picks an event template, lets the user override
 * channel + append a custom note, composes the payload via
 * {@link composeSlackMessage}, and POSTs through the host adapter.
 *
 * @public
 */
export function SlackNotifyPanel({
  notify,
  context,
  defaultEvent,
  defaultChannel,
  errorMessage,
  onSuccess,
}: SlackNotifyPanelProps): ReactElement {
  const [event, setEvent] = useState<SlackNotificationEventKind>(
    defaultEvent ?? "preflight-blocked",
  );
  const [channel, setChannel] = useState(defaultChannel ?? "");
  const [note, setNote] = useState("");
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "sending" } | { kind: "ok" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const onClick = async () => {
    setState({ kind: "sending" });
    const composed = composeSlackMessage(event, {
      ...context,
      ...(note.trim() && { text: note }),
    });
    const payload: SlackNotificationPayload = {
      ...composed,
      ...(channel.trim() && { channel: channel.trim() }),
    };
    try {
      await notify(payload);
      setState({ kind: "ok" });
      onSuccess?.(payload);
    } catch (err) {
      setState({
        kind: "error",
        message: errorMessage ? errorMessage(err) : "Couldn't send Slack notification.",
      });
    }
  };

  return (
    <div data-testid="slack-notify-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Slack notify</h3>
      </header>
      <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
        Event
        <select
          aria-label="Event"
          value={event}
          onChange={(e) => setEvent(e.target.value as SlackNotificationEventKind)}
          style={{ display: "block", marginTop: "0.125rem", width: "100%" }}
        >
          {Object.entries(SLACK_NOTIFICATION_EVENT_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
        Channel
        <input
          type="text"
          aria-label="Channel"
          placeholder="#preflight (optional)"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          style={{ display: "block", marginTop: "0.125rem", width: "100%" }}
        />
      </label>
      <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
        Note
        <textarea
          aria-label="Note"
          placeholder="Optional — appended to the message"
          value={note}
          onChange={(e) => setNote(e.target.value)}
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
          {state.kind === "sending" ? "Sending…" : "Notify Slack"}
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
