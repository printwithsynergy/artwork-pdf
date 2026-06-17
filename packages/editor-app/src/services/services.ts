// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Editor services — host-supplied data-source protocols.
 *
 * This is the artwork-pdf analogue of lens-pdf's `ViewerServices`
 * capability registry. Tools reach their backing functionality (spot
 * search, separations extraction, AI generators, preflight rules,
 * notifications, …) through these protocols rather than the library
 * hardcoding `fetch("/api/…")`. **Hosts inject; the library never
 * dials a backend on its own.**
 *
 * Each service the host doesn't wire falls through to a no-op default
 * tagged via {@link markServiceUnwired}; the consuming tool detects
 * the unwired default with {@link isServiceUnwired} and self-hides
 * (see {@link import("./fallback-mode").resolveServiceFallbackMode}).
 *
 * **Compile boundary (load-bearing):** these services carry *intent*
 * — the editor expresses what the user wants (a spot to register, a
 * white-underbase to compute, a preflight finding to surface). It
 * never becomes a policy producer; pass/fail verdicts stay in lint-pdf
 * and deterministic PDF writes stay in compile-pdf. A host wires a
 * service to *an engine call*; the editor only describes the request.
 *
 * @packageDocumentation
 */

import type { Spot } from "../components/SwatchesPicker";
import type { PreflightRule } from "../lib/preflight/types";

/**
 * Preflight-rule source. The editor's client-side preflight pass needs
 * a rule set; in a wired host that comes from the tenant's preflight
 * service (artwork apps/service `/preflight-rules`, a lint-pdf profile,
 * etc.). Hosts that don't wire one leave the no-op default and the
 * editor falls back to {@link import("../lib/preflight/types").DEFAULT_PREFLIGHT_RULES}.
 *
 * @public
 */
export interface PreflightRulesService {
  /**
   * Resolve the rule set for a job. The optional label class / type /
   * tenant let a host return a profile-specific rule set; an
   * implementation that ignores them (returns one global set) is
   * valid.
   */
  getRules(args?: {
    labelClass?: string;
    labelType?: string;
    tenantId?: string;
  }): Promise<ReadonlyArray<PreflightRule>>;
}

/**
 * Spot / PANTONE search source. Backs the swatches picker, smart
 * spot-match, and palette-to-spot tools. Mirrors compile-pdf's
 * `/v1/spots/*` shape but stays structural so editor-app keeps no hard
 * dependency on apps/service. Hosts that don't run compile-pdf's spots
 * router leave the no-op default and those tools self-hide.
 *
 * @public
 */
export interface SpotSearchService {
  /** Search the catalogue by query string + optional library filter. */
  search(args: {
    q?: string;
    library?: string;
    limit?: number;
  }): Promise<{ results: Spot[]; total: number; limit: number }>;
}

/**
 * Ink-separations source. Backs the inks palette + separation-aware
 * surfaces; a wired host returns the live ink list extracted from the
 * most recently composed PDF (compile-pdf `/v1/separations/list`).
 * Hosts that don't expose separations leave the no-op default and the
 * inks palette self-hides.
 *
 * @public
 */
export interface SeparationsService {
  /** List the ink channels present on the active document. */
  listInks(): Promise<ReadonlyArray<{ name: string; isSpot: boolean }>>;
}

/**
 * Generic AI-assist source. Backs the AI panels (copy generation,
 * image generation, auto-layout, OCR rebuild, design suggestions).
 * The editor only forwards a typed request and renders the result; the
 * model + prompt + cost-cap live in the host (or, downstream, a synergy
 * node). Hosts that don't wire an AI backend leave the no-op default
 * and every AI tool self-hides.
 *
 * `kind` discriminates the request so one wired service can fan out to
 * the right backend; an implementation may support a subset and throw
 * `"unsupported"` for the rest.
 *
 * @public
 */
export interface AiAssistService {
  /**
   * Run an AI assist request. The opaque `request` / `result` payloads
   * are owned by the individual panel adapters — this service is the
   * transport, not the schema.
   */
  run(args: { kind: string; request: unknown }): Promise<unknown>;
}

/**
 * Outbound-notification source. Backs the Slack / email / webhook
 * notify panels. The editor composes a structured event; the host
 * delivers it (or hands it to a synergy `*.notify` node). Hosts that
 * don't wire any transport leave the no-op default and the notify
 * panels self-hide.
 *
 * @public
 */
export interface NotificationService {
  /** Deliver one composed notification event through the host transport. */
  notify(args: { channel: string; payload: unknown }): Promise<void>;
}

/**
 * Telemetry / analytics. No-op default keeps embeds fast and silent.
 *
 * @public
 */
export interface TelemetryService {
  track(event: string, properties?: Record<string, unknown>): void;
}

/**
 * Deterministic-correction source. Backs the editor's auto-fix flow: the
 * editor expresses *intent* (an ordered list of named correction
 * operations — set bleed, normalize an ink name, force black overprint, …)
 * and the host applies them deterministically, returning the corrected
 * document. In a wired host this is artwork apps/service's `POST
 * /v1/correct` (or a synergy `artwork.correct` node); hosts that don't run
 * a corrector leave the no-op default and the auto-fix UI self-hides.
 *
 * **Compile boundary (load-bearing):** corrections mutate the *authoring*
 * document model — they are intent edits, not policy verdicts and not a
 * PDF write. The pass/fail decision stays in lint-pdf; the PDF bytes stay
 * in compile-pdf. This service is the transport for an intent edit, never
 * a producer.
 *
 * The `operations` / `document` payloads are intentionally structural
 * (`unknown` / `Record`) so editor-app keeps no hard dependency on
 * `@artworkpdf/document-model`'s `CorrectionOp` union — a host passes the
 * service's calls straight through to the typed `/v1/correct` endpoint,
 * mirroring lens-pdf's structural `MinimalCodexClient` approach.
 *
 * @public
 */
export interface CorrectionsService {
  /**
   * Apply an ordered list of correction operations to a document and
   * resolve the corrected document plus its deterministic content hash.
   * Implementations must be deterministic — identical inputs resolve to
   * an identical `contentHash`.
   */
  correct(args: {
    document: unknown;
    operations: ReadonlyArray<Record<string, unknown>>;
  }): Promise<{ document: unknown; contentHash: string }>;
}

/**
 * Aggregate service surface a host injects into the embeddable editor.
 *
 * Every field is **optional**: a host wires only the services its
 * backend supports. The {@link defaultEditorServices} factory fills
 * the gaps with unwired no-op stubs so consumers always read a
 * concrete object and never branch on `undefined`.
 *
 * @public
 */
export interface EditorServices {
  readonly preflightRules?: PreflightRulesService;
  readonly spotSearch?: SpotSearchService;
  readonly separations?: SeparationsService;
  readonly ai?: AiAssistService;
  readonly notifications?: NotificationService;
  readonly telemetry?: TelemetryService;
  readonly corrections?: CorrectionsService;
}

/**
 * The set of well-known service keys. Used by capability self-hide so
 * a tool can name the service it depends on with compile-time safety.
 *
 * @public
 */
export type EditorServiceName = keyof EditorServices;

// ---------------------------------------------------------------------------
// Unwired marker
// ---------------------------------------------------------------------------

/**
 * Non-enumerable marker tagged onto every no-op default service so a
 * tool can tell "host didn't wire this" apart from "host wired
 * something that returned no data". The former self-hides; the latter
 * renders an empty state because the host explicitly opted in.
 *
 * `Symbol.for` (not a fresh `Symbol`) so the marker survives a service
 * passed across module-instance boundaries (duplicated package copies
 * in a host's bundle).
 */
const UNWIRED_MARKER = Symbol.for("@printwithsynergy/artwork-pdf-editor:service-unwired");

/**
 * Tag a service object as a no-op default ("host did not wire this").
 * Hosts almost never call this — it's used by {@link defaultEditorServices}
 * and exposed only so tests / advanced hosts can simulate the unwired
 * state. Idempotent and returns the same object for chaining.
 *
 * @public
 */
export function markServiceUnwired<T extends object>(service: T): T {
  if (!(UNWIRED_MARKER in service)) {
    Object.defineProperty(service, UNWIRED_MARKER, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }
  return service;
}

/**
 * Returns `true` when a service is the unwired no-op default — i.e. the
 * host did not inject a real implementation (or injected `undefined` /
 * `null`). Tools call this to choose between self-hiding (unwired) and
 * rendering an empty state (wired but no data).
 *
 * @public
 */
export function isServiceUnwired(service: object | null | undefined): boolean {
  if (!service) return true;
  return (service as Record<symbol, unknown>)[UNWIRED_MARKER] === true;
}

// ---------------------------------------------------------------------------
// No-op stubs + default factory
// ---------------------------------------------------------------------------

/**
 * Resolve a host-supplied partial service surface into a complete
 * {@link EditorServices} where every gap is filled with an unwired
 * no-op stub. Consumers always read a concrete service and decide
 * visibility via {@link isServiceUnwired} rather than `undefined`
 * checks scattered across components.
 *
 * The stubs are deliberately *typed* (they satisfy the protocol) but
 * tagged unwired, so a tool that ignores the wired/unwired distinction
 * still won't crash — it just gets empty results.
 *
 * @public
 */
export function defaultEditorServices(injected?: Partial<EditorServices>): EditorServices {
  return {
    preflightRules:
      injected?.preflightRules ??
      markServiceUnwired<PreflightRulesService>({
        getRules: async () => [],
      }),
    spotSearch:
      injected?.spotSearch ??
      markServiceUnwired<SpotSearchService>({
        search: async (args) => ({ results: [], total: 0, limit: args.limit ?? 0 }),
      }),
    separations:
      injected?.separations ??
      markServiceUnwired<SeparationsService>({
        listInks: async () => [],
      }),
    ai:
      injected?.ai ??
      markServiceUnwired<AiAssistService>({
        run: async () => {
          throw new Error("ai service not wired");
        },
      }),
    notifications:
      injected?.notifications ??
      markServiceUnwired<NotificationService>({
        notify: async () => {},
      }),
    telemetry:
      injected?.telemetry ??
      markServiceUnwired<TelemetryService>({
        track: () => {},
      }),
    corrections:
      injected?.corrections ??
      markServiceUnwired<CorrectionsService>({
        // Unwired default: echo the document back unchanged with a stable
        // empty-hash sentinel. The auto-fix UI self-hides on this stub, so
        // it should never actually be invoked.
        correct: async ({ document }) => ({ document, contentHash: "" }),
      }),
  };
}
