// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 3 G3 — GS1 Digital Link composer panel.
 *
 * GS1 Digital Link (ISO/IEC 15459 + GS1 Digital Link Standard v1.3) is
 * a structured URL form for product identifiers that can be encoded
 * into a single QR code and resolved on-device. Shape:
 *
 *   `https://<domain>/01/<gtin>[/22/<cpv>][/10/<lot>][/21/<serial>][?...]`
 *
 * Path AIs (Application Identifiers) carry the "primary key" segments
 * — `01` (GTIN) is mandatory, then `22`/`10`/`21` in canonical order.
 * Query-string AIs carry the long tail (expiration date, batch, etc.)
 * via `<ai>=<value>` pairs.
 *
 * The panel handles URL composition only — emitting the URL via
 * `onLink`. Hosts that also want a rendered QR bitmap wire the Wave 3
 * G2g {@link import("./BarcodeGeneratorPanel").BarcodeRenderFn} shape
 * via the optional `renderer` prop and receive the bitmap via
 * `onRendered`. This keeps the composer free of any rendering library
 * dep and lets G2g + G3 share one adapter.
 *
 * @public
 */
import { useState } from "react";

import type { BarcodeRenderFn, BarcodeRenderResult } from "./BarcodeGeneratorPanel";

/**
 * One additional GS1 Application Identifier carried in either the URL
 * path or query string. `ai` is the numeric AI (e.g. `"10"` for lot,
 * `"17"` for expiration date `YYMMDD`); `value` is the raw payload
 * before percent-encoding.
 *
 * The composer percent-encodes `value` automatically; callers should
 * pass the human-readable form.
 *
 * @public
 */
export type Gs1AiEntry = {
  ai: string;
  value: string;
};

/**
 * Result returned by {@link composeGs1DigitalLink}. `url` is the
 * canonical GS1 Digital Link form ready to be QR-encoded;
 * `pathSegment` and `querySegment` are the split halves the host can
 * surface separately (e.g. a "preview" UI that highlights mandatory
 * vs. optional segments).
 *
 * @public
 */
export type Gs1DigitalLinkResult = {
  url: string;
  pathSegment: string;
  querySegment: string;
};

/**
 * @public
 */
export type Gs1DigitalLinkPanelProps = {
  /** Optional renderer (typically the same adapter wired for
   *  {@link import("./BarcodeGeneratorPanel").BarcodeGeneratorPanel}).
   *  When supplied, "Generate QR" calls it with `format: "QR"` and the
   *  composed Digital Link URL; the bitmap flows to `onRendered`. When
   *  absent, the panel only emits the URL via `onLink`. */
  renderer?: BarcodeRenderFn;
  /** Fired whenever the composed URL changes (debounced — see
   *  implementation note). The host can preview the URL or feed it
   *  to a separate QR renderer. */
  onLink?: (result: Gs1DigitalLinkResult) => void;
  /** Fired with the rendered bitmap when the host has wired a
   *  `renderer` and the user clicks "Generate QR". */
  onRendered?: (result: BarcodeRenderResult) => void;
  /** Default resolver domain — typically `"id.gs1.org"` or a
   *  brand-owned alternate. Defaults to `"id.gs1.org"` (the GS1
   *  community default) when omitted. */
  defaultDomain?: string;
};

/**
 * The GS1 community-default resolver domain. Re-exported for hosts
 * that want to display it as a hint or seed a settings UI.
 *
 * @public
 */
export const DEFAULT_GS1_DOMAIN = "id.gs1.org";

const PATH_AIS_IN_ORDER = ["22", "10", "21"] as const;

/**
 * Compose a canonical GS1 Digital Link URL from a GTIN + optional
 * path-AIs + optional query-AIs. Pure function — exported so server
 * components (Next.js RSC, Astro frontmatter) can pre-compute URLs
 * without bundling the panel.
 *
 * Path-AI order is `22 → 10 → 21` per the GS1 Digital Link Standard;
 * any other AIs flow into the query string in the order supplied.
 *
 * @public
 */
export function composeGs1DigitalLink(input: {
  domain: string;
  gtin: string;
  pathAis?: readonly Gs1AiEntry[];
  queryAis?: readonly Gs1AiEntry[];
}): Gs1DigitalLinkResult {
  const domain = input.domain.replace(/\/+$/, "");
  const pathAisByCode = new Map<string, string>();
  for (const entry of input.pathAis ?? []) {
    pathAisByCode.set(entry.ai, entry.value);
  }
  let pathSegment = `/01/${encodeURIComponent(input.gtin)}`;
  for (const code of PATH_AIS_IN_ORDER) {
    const value = pathAisByCode.get(code);
    if (value !== undefined && value !== "") {
      pathSegment += `/${code}/${encodeURIComponent(value)}`;
    }
  }
  const querySegments = (input.queryAis ?? [])
    .filter((entry) => entry.value !== "")
    .map((entry) => `${encodeURIComponent(entry.ai)}=${encodeURIComponent(entry.value)}`);
  const querySegment = querySegments.length > 0 ? `?${querySegments.join("&")}` : "";
  return {
    url: `https://${domain}${pathSegment}${querySegment}`,
    pathSegment,
    querySegment,
  };
}

/**
 * GS1 Digital Link composer panel. The user picks a domain, types a
 * GTIN, optionally adds CPV / lot / serial path-AIs and free-form
 * query-AIs; the panel emits the composed URL via `onLink`. When the
 * host wires a `renderer`, a "Generate QR" button hands the URL to
 * the adapter with `format: "QR"` and forwards the bitmap to
 * `onRendered`.
 *
 * @public
 */
export function Gs1DigitalLinkPanel({
  renderer,
  onLink,
  onRendered,
  defaultDomain = DEFAULT_GS1_DOMAIN,
}: Gs1DigitalLinkPanelProps) {
  const [domain, setDomain] = useState(defaultDomain);
  const [gtin, setGtin] = useState("");
  const [cpv, setCpv] = useState("");
  const [lot, setLot] = useState("");
  const [serial, setSerial] = useState("");
  const [expiration, setExpiration] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function compose(): Gs1DigitalLinkResult {
    return composeGs1DigitalLink({
      domain,
      gtin: gtin.trim(),
      pathAis: [
        ...(cpv.trim() ? [{ ai: "22", value: cpv.trim() }] : []),
        ...(lot.trim() ? [{ ai: "10", value: lot.trim() }] : []),
        ...(serial.trim() ? [{ ai: "21", value: serial.trim() }] : []),
      ],
      queryAis: [...(expiration.trim() ? [{ ai: "17", value: expiration.trim() }] : [])],
    });
  }

  function handlePreview() {
    if (!gtin.trim()) {
      setError("GTIN is required.");
      return;
    }
    setError(null);
    onLink?.(compose());
  }

  async function handleGenerate() {
    if (!gtin.trim()) {
      setError("GTIN is required.");
      return;
    }
    if (!renderer) {
      setError("No QR renderer wired.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = compose();
      onLink?.(result);
      const bitmap = await renderer({ format: "QR", payload: result.url });
      onRendered?.(bitmap);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="gs1-digital-link-panel" style={{ padding: "0.5rem" }}>
      <h3 style={{ margin: "0 0 0.5rem 0" }}>GS1 Digital Link</h3>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Resolver domain
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          aria-label="GS1 resolver domain"
          style={{ marginLeft: "0.5rem", width: "16em" }}
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        GTIN (AI 01)
        <input
          type="text"
          value={gtin}
          onChange={(e) => setGtin(e.target.value)}
          aria-label="GTIN"
          style={{ marginLeft: "0.5rem", width: "16em" }}
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        CPV (AI 22, optional)
        <input
          type="text"
          value={cpv}
          onChange={(e) => setCpv(e.target.value)}
          aria-label="Consumer product variant"
          style={{ marginLeft: "0.5rem", width: "12em" }}
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Lot (AI 10, optional)
        <input
          type="text"
          value={lot}
          onChange={(e) => setLot(e.target.value)}
          aria-label="Lot or batch"
          style={{ marginLeft: "0.5rem", width: "12em" }}
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Serial (AI 21, optional)
        <input
          type="text"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          aria-label="Serial number"
          style={{ marginLeft: "0.5rem", width: "12em" }}
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Expiration date (AI 17, YYMMDD, optional)
        <input
          type="text"
          value={expiration}
          onChange={(e) => setExpiration(e.target.value)}
          aria-label="Expiration date"
          style={{ marginLeft: "0.5rem", width: "8em" }}
        />
      </label>
      <button
        type="button"
        onClick={handlePreview}
        style={{ padding: "0.4rem 0.8rem", marginRight: "0.5rem" }}
      >
        Preview URL
      </button>
      {renderer && (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy}
          style={{ padding: "0.4rem 0.8rem" }}
        >
          {busy ? "Generating…" : "Generate QR"}
        </button>
      )}
      {error && (
        <div role="alert" style={{ marginTop: "0.5rem", color: "#a00" }}>
          {error}
        </div>
      )}
    </div>
  );
}
