// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 3 C2 — White / underbase auto-generation panel.
 *
 * Many packaging substrates (foils, dark plastics, kraft) require an
 * opaque white layer printed *under* the CMYK / spots so the
 * subsequent ink lays down with the colour the designer specified
 * rather than being tinted by the substrate. Manually authoring this
 * separation is tedious and error-prone — C2 asks compile-pdf's
 * `white_underbase` producer to compute the union of CMYK fill
 * coverage on the page and emit a new `White` separation matching
 * that union, optionally choked inward by a small amount so the
 * white doesn't peek out from underneath the chromatic ink.
 *
 * Pure-adapter design (same shape as the rest of the AI / I family
 * panels): the host wires a {@link WhiteUnderbaseGeneratorFn} that
 * fronts the producer; the panel owns config inputs and lifecycle
 * state.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useCallback, useState } from "react";

/**
 * Spec for one underbase-generation request. Mirrors the
 * `WhiteUnderbaseOptions` shape on compile-pdf's
 * `/v1/white-underbase/apply` endpoint so a host can pass the value
 * straight through.
 *
 * @public
 */
export type WhiteUnderbaseSpec = {
  /** Name to assign the new separation. Default `"White"`. */
  separationName: string;
  /** Opacity of the underbase (0..1). 1 = solid white. */
  opacity: number;
  /** Distance (in mm) to choke the white inward from the chromatic
   *  ink edges. Prevents the white from peeking out around the
   *  printed colour. 0 = no choke. */
  chokeMm: number;
  /** How the underbase relates to overlapping chromatic ink:
   *  - `solid` — white covers the entire chromatic region (default)
   *  - `subtract-cmyk` — white opacity is scaled down where CMYK
   *    coverage approaches 100% (lighter inks need less underbase) */
  knockoutMode: "solid" | "subtract-cmyk";
};

/**
 * Default spec values — sensible for the most common case
 * (white-ink underbase on dark substrate, no choke).
 *
 * @public
 */
export const DEFAULT_WHITE_UNDERBASE_SPEC: WhiteUnderbaseSpec = {
  separationName: "White",
  opacity: 1,
  chokeMm: 0,
  knockoutMode: "solid",
};

/**
 * Result returned by the host generator. The host typically wires
 * this to `CompilePdfClient.whiteUnderbase()` which calls
 * `/v1/white-underbase/apply` and returns the producer's
 * `separation_name` + `coverage_pct` fields.
 *
 * @public
 */
export type WhiteUnderbaseResult = {
  separationName: string;
  /** Percentage of the page area covered by the new underbase
   *  separation. Useful as a sanity check (e.g. > 95 % suggests the
   *  page is mostly chromatic — review the choke). */
  coveragePct: number;
};

/**
 * Host adapter — generates the white underbase for the active
 * document. Rejects on transport / validation errors and the panel
 * surfaces the message inline.
 *
 * @public
 */
export type WhiteUnderbaseGeneratorFn = (
  spec: WhiteUnderbaseSpec,
) => Promise<WhiteUnderbaseResult>;

/**
 * Pure helper — validates a spec. Returns the first error message
 * encountered or `null` when the spec is valid. Hosts can call this
 * to disable the "Generate" button preemptively. Pure function.
 *
 * @public
 */
export function validateWhiteUnderbaseSpec(spec: WhiteUnderbaseSpec): string | null {
  // Defensive against partial-spec merges that leave fields undefined
  // (Partial<WhiteUnderbaseSpec> lets a host pass `{ separationName:
  // undefined }`, which would otherwise throw on `.trim()`).
  const name = spec.separationName ?? "";
  if (!name.trim()) return "Separation name is required.";
  if (!Number.isFinite(spec.opacity) || spec.opacity < 0 || spec.opacity > 1) {
    return "Opacity must be between 0 and 1.";
  }
  if (!Number.isFinite(spec.chokeMm)) return "Choke must be a number.";
  if (spec.chokeMm < 0) return "Choke can't be negative.";
  if (spec.chokeMm > 5) return "Choke above 5 mm is implausibly large; double-check.";
  return null;
}

/**
 * Configuration for the {@link WhiteUnderbasePanel}.
 *
 * @public
 */
export type WhiteUnderbasePanelProps = {
  /** Initial spec values — `DEFAULT_WHITE_UNDERBASE_SPEC` if absent. */
  initialSpec?: Partial<WhiteUnderbaseSpec>;
  /** Generator adapter — when absent, the panel renders in
   *  read-only mode (config inputs disabled). Useful when the host
   *  wants to surface the controls but defer the network wire. */
  generator?: WhiteUnderbaseGeneratorFn;
  /** Fired after a successful generation — typically used to refresh
   *  the editor's separations registry / inks panel. */
  onGenerated?: (result: WhiteUnderbaseResult) => void;
};

/**
 * Stateful panel — exposes inputs for every {@link WhiteUnderbaseSpec}
 * field, dispatches the generator, and surfaces the result chip /
 * inline error. Handles loading, validation, and success states.
 *
 * @public
 */
export function WhiteUnderbasePanel({
  initialSpec,
  generator,
  onGenerated,
}: WhiteUnderbasePanelProps): ReactElement {
  const [spec, setSpec] = useState<WhiteUnderbaseSpec>(() => {
    // Field-wise merge — skip undefined values in initialSpec so hosts
    // passing `{ separationName: undefined }` don't clobber the
    // defaults and leave required fields unset.
    const merged: WhiteUnderbaseSpec = { ...DEFAULT_WHITE_UNDERBASE_SPEC };
    if (!initialSpec) return merged;
    for (const key of Object.keys(initialSpec) as Array<keyof WhiteUnderbaseSpec>) {
      const value = initialSpec[key];
      if (value !== undefined) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic keyed assignment
        (merged as any)[key] = value;
      }
    }
    return merged;
  });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<WhiteUnderbaseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const validationError = validateWhiteUnderbaseSpec(spec);
  const canGenerate = !!generator && status !== "loading" && !validationError;

  const generate = useCallback(async () => {
    if (!generator) return;
    setStatus("loading");
    setErrorMsg(null);
    try {
      const next = await generator(spec);
      setResult(next);
      setStatus("done");
      onGenerated?.(next);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed.";
      setErrorMsg(msg);
      setStatus("error");
    }
  }, [generator, spec, onGenerated]);

  const update = <K extends keyof WhiteUnderbaseSpec>(key: K, value: WhiteUnderbaseSpec[K]) => {
    setSpec((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div data-testid="white-underbase-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>White underbase</h3>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <label style={{ fontSize: "0.75rem", display: "flex", flexDirection: "column" }}>
          <span style={{ color: "#595959", marginBottom: "0.125rem" }}>Separation name</span>
          <input
            type="text"
            value={spec.separationName}
            onChange={(e) => update("separationName", e.target.value)}
            disabled={!generator}
            style={{ fontSize: "0.8125rem", padding: "0.25rem 0.375rem" }}
          />
        </label>
        <label style={{ fontSize: "0.75rem", display: "flex", flexDirection: "column" }}>
          <span style={{ color: "#595959", marginBottom: "0.125rem" }}>
            Opacity ({spec.opacity.toFixed(2)})
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={spec.opacity}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next)) update("opacity", next);
            }}
            disabled={!generator}
          />
        </label>
        <label style={{ fontSize: "0.75rem", display: "flex", flexDirection: "column" }}>
          <span style={{ color: "#595959", marginBottom: "0.125rem" }}>Choke (mm)</span>
          <input
            type="number"
            min={0}
            max={5}
            step={0.05}
            value={spec.chokeMm}
            onChange={(e) => {
              // Empty number input → "" → NaN, which would bypass
              // validation and slip through to the generator. Treat a
              // cleared field as 0 (the no-choke default).
              const next = e.target.value === "" ? 0 : Number(e.target.value);
              if (Number.isFinite(next)) update("chokeMm", next);
            }}
            disabled={!generator}
            style={{ fontSize: "0.8125rem", padding: "0.25rem 0.375rem" }}
          />
        </label>
        <label style={{ fontSize: "0.75rem", display: "flex", flexDirection: "column" }}>
          <span style={{ color: "#595959", marginBottom: "0.125rem" }}>Knockout mode</span>
          <select
            value={spec.knockoutMode}
            onChange={(e) =>
              update("knockoutMode", e.target.value as WhiteUnderbaseSpec["knockoutMode"])
            }
            disabled={!generator}
            style={{ fontSize: "0.8125rem", padding: "0.25rem 0.375rem" }}
          >
            <option value="solid">solid — full coverage</option>
            <option value="subtract-cmyk">subtract-cmyk — scale by ink density</option>
          </select>
        </label>
      </div>
      {validationError && (
        <div role="alert" style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#a60" }}>
          {validationError}
        </div>
      )}
      <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={generate}
          disabled={!canGenerate}
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}
        >
          {status === "loading" ? "Generating…" : "Generate"}
        </button>
        {status === "done" && result && (
          <span style={{ fontSize: "0.75rem", color: "#595959" }}>
            {result.separationName} · {result.coveragePct.toFixed(1)}% coverage
          </span>
        )}
        {status === "error" && errorMsg && (
          <span role="alert" style={{ fontSize: "0.75rem", color: "#a00" }}>
            {errorMsg}
          </span>
        )}
      </div>
    </div>
  );
}
