// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 2 O2 — Send-to-MIS manifest emitter.
 *
 * A small button that gathers the current document's print-relevant
 * metadata (separations, material estimate, process class, due date)
 * into a structured manifest and hands it to a host-supplied
 * submitter. The host wires the submitter to the synergy queue's
 * `mis.estimate` node (`POST /synergy/workflows/<id>/submit` in the
 * canonical deploy); the editor stays runtime-free of the synergy
 * client.
 *
 * Designed around the host-adapter pattern that the rest of the
 * editor uses (see `SpotSearchFn`, `TrapPreviewFn`, `InksLoaderFn`).
 *
 * @public
 */
import { useEffect, useRef, useState } from "react";

/**
 * Manifest payload — the shape the synergy `mis.estimate` node
 * consumes. All fields except `documentId` and `processClass` are
 * optional so partial submissions still validate (hosts that don't
 * yet collect a due date can omit it).
 *
 * @public
 */
export type MisEstimateManifest = {
  /** Stable identifier the host uses to correlate this submission
   *  with the underlying document (e.g. a CMS row id). */
  documentId: string;
  /** Matches `PrintContext.process` from the document-model so the
   *  MIS can route to the right press cell. */
  processClass: "offset" | "flexo" | "gravure" | "digital" | "screen";
  /** Ordered ink list at submission time — typically the live ink
   *  list from PR-5's InksPanel. Names mirror the wire shape, not
   *  the human display string. */
  separations?: ReadonlyArray<{
    name: string;
    colorSpace: "Separation" | "DeviceN";
  }>;
  /** Substrate / coverage hints the MIS uses to estimate
   *  consumables. Free shape — different MIS vendors collect
   *  different fields. */
  materialEstimate?: Record<string, unknown>;
  /** ISO 8601 (date-only) string. Hosts that surface a date picker
   *  pass `value.toISOString().slice(0, 10)`. */
  dueDate?: string;
  /** Tenant-specific extras (`po_number`, `cost_center`, …). The
   *  synergy node copies the bag verbatim into the workflow
   *  payload. */
  extras?: Record<string, unknown>;
};

/**
 * Host adapter — POSTs the manifest to the synergy queue (or
 * whatever MIS bridge the host runs). Resolves with the workflow
 * id the synergy node assigned; rejects on transport / validation
 * errors and the button surfaces the message inline.
 *
 * @public
 */
export type MisSubmitFn = (manifest: MisEstimateManifest) => Promise<{ workflowId: string }>;

/**
 * @public
 */
export type MisEstimateButtonProps = {
  /** The current manifest. When `undefined` the button is disabled
   *  — hosts wire this to "we have enough data to submit". */
  manifest: MisEstimateManifest | undefined;
  /** Host adapter, see {@link MisSubmitFn}. */
  submit: MisSubmitFn;
  /** Optional button label override. Defaults to "Send to MIS". */
  label?: string;
  /** Optional callback fired on successful submission with the
   *  workflow id so the host can show a confirmation / link. */
  onSuccess?: (workflowId: string) => void;
  /** Optional mapper that turns a submit error into a user-facing
   *  message. The default (`"Couldn't send to MIS."`) avoids leaking
   *  internal `Error.message` strings; hosts that want richer
   *  surfaces (e.g. validation-error toasts) pass their own mapper.
   *  The original error is still passed in so hosts can log it. */
  errorMessage?: (err: unknown) => string;
};

/**
 * @public
 */
export function MisEstimateButton({
  manifest,
  submit,
  label,
  onSuccess,
  errorMessage,
}: MisEstimateButtonProps) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "ok"; workflowId: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  // Clear any lingering success/error chip when the host swaps in a
  // new manifest — the previous submission's outcome doesn't apply to
  // a different payload. Identity comparison only; hosts that mutate
  // the same object reference get the chip preserved (rare; almost
  // every host returns a new object on each edit).
  const lastManifestRef = useRef(manifest);
  useEffect(() => {
    if (lastManifestRef.current !== manifest) {
      lastManifestRef.current = manifest;
      setState((prev) => (prev.kind === "submitting" ? prev : { kind: "idle" }));
    }
  }, [manifest]);

  const disabled = !manifest || state.kind === "submitting";

  const onClick = async () => {
    if (!manifest) return;
    setState({ kind: "submitting" });
    try {
      const { workflowId } = await submit(manifest);
      setState({ kind: "ok", workflowId });
      onSuccess?.(workflowId);
    } catch (err) {
      setState({
        kind: "error",
        message: errorMessage ? errorMessage(err) : "Couldn't send to MIS.",
      });
    }
  };

  return (
    <div
      data-testid="mis-estimate-button"
      style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-busy={state.kind === "submitting"}
        aria-label={label ?? "Send to MIS"}
      >
        {state.kind === "submitting" ? "Sending…" : (label ?? "Send to MIS")}
      </button>
      {state.kind === "ok" && (
        <small style={{ color: "#080", opacity: 0.8 }} role="status">
          Submitted ({state.workflowId})
        </small>
      )}
      {state.kind === "error" && (
        <small style={{ color: "#a00", opacity: 0.8 }} role="alert">
          {state.message}
        </small>
      )}
    </div>
  );
}
