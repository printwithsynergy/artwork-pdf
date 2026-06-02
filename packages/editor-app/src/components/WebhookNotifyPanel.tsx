// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 I1 — Generic webhook notify panel.
 *
 * Companion to the I3 {@link SlackNotifyPanel} (Wave 4 PR-11). Where
 * I3 targets a single integration (Slack incoming webhooks) with a
 * canned message template per event, I1 is the generic catch-all —
 * the host wires any outbound HTTP integration (Zapier, n8n, GitHub
 * Actions repository_dispatch, internal worker queues, custom tenant
 * endpoints) by supplying a {@link WebhookNotifyFn} adapter and the
 * panel emits a typed {@link WebhookNotificationEvent} payload.
 *
 * The wire shape is intentionally structured rather than free-form
 * text: downstream consumers can pattern-match on `kind` and read
 * typed fields off `context`, rather than parsing English. Hosts that
 * want a human-readable rendering on top of the structured payload
 * wrap their own adapter.
 *
 * Pairs with the synergy `webhook.notify` workflow node when one is
 * deployed; hosts running purely client-side `fetch()` calls wire a
 * local adapter in the meantime.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useState } from "react";

/**
 * The set of editor events the panel can emit. Mirrors
 * {@link SlackNotificationEventKind} for cross-integration parity —
 * the two panels respond to the same event vocabulary so a host can
 * wire I1 + I3 against the same trigger list.
 *
 * @public
 */
export type WebhookNotificationEventKind =
  | "preflight-blocked"
  | "preflight-cleared"
  | "job-submitted"
  | "variant-approved"
  | "approval-requested"
  | "custom";

/**
 * Context the host passes in alongside the chosen event. Mirrors
 * {@link SlackNotificationContext} so a single host-side state object
 * can feed both panels; the webhook payload preserves the structured
 * fields rather than rendering them into a single text line.
 *
 * @public
 */
export type WebhookNotificationContext = {
  /** Human-readable document name. */
  documentName?: string;
  /** Stable identifier the host uses to link back to the document. */
  documentId?: string;
  /** Optional clickable URL the downstream consumer can use to jump
   *  straight into the editor. */
  documentUrl?: string;
  /** Preflight finding count (errors only for `"preflight-blocked"`,
   *  total resolved for `"preflight-cleared"`). */
  findingCount?: number;
  /** Variant id for `"variant-approved"`. */
  variantId?: string;
  /** Reviewer / submitter display name. */
  actor?: string;
  /** Free-form additional text — the panel surfaces an optional note
   *  input that populates this; downstream consumers may render it as
   *  a description / commit message / etc. */
  text?: string;
};

/**
 * Canonical structured payload the panel POSTs to the host adapter.
 * The `kind` + `context` split keeps the wire shape pattern-matchable
 * (no English-parsing required on the receiver) while leaving the
 * envelope (`integration`, `sentAt`) free for routing.
 *
 * @public
 */
export type WebhookNotificationEvent = {
  /** Schema version — bump on breaking shape changes. */
  schemaVersion: 1;
  /** Event kind from {@link WebhookNotificationEventKind}. */
  kind: WebhookNotificationEventKind;
  /** Structured context — see {@link WebhookNotificationContext}. */
  context: WebhookNotificationContext;
  /** Optional integration identifier the host can use to route the
   *  event to one of many wired endpoints (e.g. `"zapier-main"`,
   *  `"github-actions-staging"`). When absent, the host adapter
   *  decides the default destination. */
  integration?: string;
  /** ISO 8601 timestamp the panel stamps at send time. */
  sentAt: string;
};

/**
 * Pure helper — composes a {@link WebhookNotificationEvent} from a
 * kind + context + optional integration. Stamps `sentAt` to the
 * passed-in `now()` so tests can pin the timestamp. Pure function;
 * no I/O.
 *
 * @public
 */
export function composeWebhookEvent(
  kind: WebhookNotificationEventKind,
  context: WebhookNotificationContext,
  options?: { integration?: string; now?: () => Date },
): WebhookNotificationEvent {
  const now = options?.now ?? (() => new Date());
  return {
    schemaVersion: 1,
    kind,
    context,
    ...(options?.integration && { integration: options.integration }),
    sentAt: now().toISOString(),
  };
}

/**
 * Host adapter — POSTs the composed payload to the wired endpoint
 * (typically via a server-side proxy or the synergy `webhook.notify`
 * node). Resolves on accept; rejects on transport / validation
 * errors and the panel surfaces the message inline.
 *
 * @public
 */
export type WebhookNotifyFn = (event: WebhookNotificationEvent) => Promise<void>;

/**
 * Human-readable labels for each event kind, in the order they appear
 * in the dropdown. Mirrors {@link SlackNotifyPanel}'s label map so the
 * two panels stay in lockstep.
 *
 * @public
 */
export const WEBHOOK_NOTIFICATION_EVENT_LABELS: Readonly<
  Record<WebhookNotificationEventKind, string>
> = {
  "preflight-blocked": "Preflight blocked",
  "preflight-cleared": "Preflight cleared",
  "job-submitted": "Job submitted",
  "variant-approved": "Variant approved",
  "approval-requested": "Approval requested",
  custom: "Custom event",
};

/**
 * Configuration for the {@link WebhookNotifyPanel}.
 *
 * The host supplies the {@link WebhookNotifyFn} adapter, the typed
 * {@link WebhookNotificationContext}, and (optionally) a list of
 * integration ids that populate the panel's "Integration" dropdown.
 * The panel handles event-kind selection, the optional free-form
 * note, the send button state machine, and surfaces success / error
 * inline.
 *
 * @public
 */
export type WebhookNotifyPanelProps = {
  /** Host adapter — see {@link WebhookNotifyFn}. */
  notify: WebhookNotifyFn;
  /** Typed context to bundle into the outgoing event. The host
   *  typically wires this from the active document. */
  context: WebhookNotificationContext;
  /** Optional initial event selection. Defaults to
   *  `"job-submitted"` — the most common webhook trigger across
   *  CI / queue / chat integrations. */
  defaultEvent?: WebhookNotificationEventKind;
  /** Optional list of integration ids the host has wired. Surfaces as
   *  a dropdown; when absent the panel omits the picker and the
   *  outgoing event has no `integration` field set. */
  integrations?: readonly string[];
  /** Optional initial integration selection. Must match one of
   *  `integrations`; when absent the first entry is selected. */
  defaultIntegration?: string;
  /** Optional mapper that turns a notify error into a user-facing
   *  message. The default avoids leaking internal `Error.message`
   *  strings; hosts that want richer surfaces pass their own mapper.
   *  The original error is still passed in so hosts can log it. */
  errorMessage?: (err: unknown) => string;
  /** Optional callback fired on successful notify so the host can
   *  show a confirmation toast / log analytics. */
  onSuccess?: (event: WebhookNotificationEvent) => void;
};

/**
 * Stateful panel — picks an event template + integration, lets the
 * user append a custom note, composes the typed event via
 * {@link composeWebhookEvent}, and POSTs through the host adapter.
 *
 * @public
 */
export function WebhookNotifyPanel({
  notify,
  context,
  defaultEvent,
  integrations,
  defaultIntegration,
  errorMessage,
  onSuccess,
}: WebhookNotifyPanelProps): ReactElement {
  const [event, setEvent] = useState<WebhookNotificationEventKind>(defaultEvent ?? "job-submitted");
  const [integration, setIntegration] = useState<string>(
    defaultIntegration ?? integrations?.[0] ?? "",
  );
  const [note, setNote] = useState("");
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "sending" } | { kind: "ok" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  // Clear the success / error chip when the user edits any input —
  // a "Sent" indicator next to an unsent payload reads as a lie.
  const resetOutcome = () => {
    setState((prev) => (prev.kind === "ok" || prev.kind === "error" ? { kind: "idle" } : prev));
  };

  const onClick = async () => {
    setState({ kind: "sending" });
    const payload = composeWebhookEvent(
      event,
      {
        ...context,
        ...(note.trim() && { text: note }),
      },
      integration ? { integration } : undefined,
    );
    try {
      await notify(payload);
      setState({ kind: "ok" });
      onSuccess?.(payload);
    } catch (err) {
      // Guard against a host-supplied errorMessage that throws.
      let message = "Couldn't send webhook notification.";
      if (errorMessage) {
        try {
          message = errorMessage(err);
        } catch {
          // fall back to the default
        }
      }
      setState({ kind: "error", message });
    }
  };

  return (
    <div data-testid="webhook-notify-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Webhook notify</h3>
      </header>
      <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
        Event
        <select
          aria-label="Event"
          value={event}
          onChange={(e) => {
            setEvent(e.target.value as WebhookNotificationEventKind);
            resetOutcome();
          }}
          style={{ display: "block", marginTop: "0.125rem", width: "100%" }}
        >
          {Object.entries(WEBHOOK_NOTIFICATION_EVENT_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {integrations && integrations.length > 0 && (
        <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
          Integration
          <select
            aria-label="Integration"
            value={integration}
            onChange={(e) => {
              setIntegration(e.target.value);
              resetOutcome();
            }}
            style={{ display: "block", marginTop: "0.125rem", width: "100%" }}
          >
            {integrations.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      )}
      <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
        Note
        <textarea
          aria-label="Note"
          placeholder="Optional — included as context.text"
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
          {state.kind === "sending" ? "Sending…" : "Send webhook"}
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
