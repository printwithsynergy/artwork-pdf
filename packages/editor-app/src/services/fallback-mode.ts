// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Capability self-hide — the pure resolution logic behind the
 * embeddable editor's "tools self-hide when their backing service
 * isn't wired" behaviour.
 *
 * This mirrors lens-pdf's `useFallbackMode()` three-state model but
 * keeps the decision in a **pure function** so it's unit-testable
 * without a DOM (the editor-app test setup ships no jsdom). The React
 * hook in `./context` is a one-line wrapper over
 * {@link resolveServiceFallbackMode}.
 *
 * It composes the two gating layers already in the editor:
 *   1. {@link import("../lib/editor-config").showFeature} — the host's
 *      `EditorConfig` flag / plan-gate / capability / unwired-UI layer.
 *   2. {@link import("./services").isServiceUnwired} — whether the host
 *      injected a real backing service for the tool.
 *
 * @packageDocumentation
 */

import { type EditorConfig, type FeatureKey, showFeature } from "../lib/editor-config";
import { type EditorServiceName, type EditorServices, isServiceUnwired } from "./services";

/**
 * Resolved visibility mode for a service-backed tool. Mirrors
 * lens-pdf's vocabulary.
 *
 * - `wired` — the feature flag is open **and** the host injected a
 *   real backing service: render the live tool.
 * - `fallback` — the feature flag is open but the service is unwired,
 *   and the tool declared it has a useful client-only fallback (e.g.
 *   the editor's built-in `DEFAULT_PREFLIGHT_RULES` when no preflight
 *   service is wired): render the degraded-but-functional tool.
 * - `hidden` — the flag is closed, or the service is unwired with no
 *   fallback: render nothing (the capability self-hides).
 *
 * @public
 */
export type ServiceFallbackMode = "wired" | "fallback" | "hidden";

/**
 * Options for {@link resolveServiceFallbackMode}.
 *
 * @public
 */
export interface ResolveServiceFallbackModeOptions {
  /** The resolved editor config (flags / plan-gates / capabilities). */
  config: EditorConfig;
  /** The aggregate (host-injected + stub-filled) service surface. */
  services: EditorServices;
  /**
   * The `EditorConfig` feature key that gates this tool's UI (the
   * `<feature>` half of `enable_<feature>`). When omitted, only the
   * service-wired check applies — useful for chrome that has a service
   * dependency but no dedicated flag.
   */
  feature?: FeatureKey;
  /** The service this tool depends on. */
  service: EditorServiceName;
  /**
   * Whether the tool has a useful client-only fallback when its
   * service is unwired. Default `false` — most tools hide outright
   * (no point showing a spot picker with no catalogue). Set `true`
   * only for tools that genuinely degrade gracefully.
   */
  hasFallback?: boolean;
}

/**
 * Resolve the visibility mode for one service-backed tool.
 *
 * Decision table (first match wins):
 *   1. feature flag closed  → `hidden`
 *   2. service wired         → `wired`
 *   3. service unwired + fallback → `fallback`
 *   4. otherwise             → `hidden`
 *
 * Pure and side-effect-free; call {@link logUnwiredHide} separately
 * when you want the dev-time warning on a `hidden`/`fallback` result.
 *
 * @public
 */
export function resolveServiceFallbackMode(
  opts: ResolveServiceFallbackModeOptions,
): ServiceFallbackMode {
  const { config, services, feature, service, hasFallback = false } = opts;

  if (feature !== undefined && !showFeature(config, feature)) {
    return "hidden";
  }

  const wired = !isServiceUnwired(services[service]);
  if (wired) return "wired";
  return hasFallback ? "fallback" : "hidden";
}

/** Module-scoped guard so each unwired warning fires at most once. */
const WARNED = new Set<string>();

/**
 * Emit a single dev-time console warning the first time a tool hides
 * (or degrades to fallback) because its backing service is unwired.
 * Mirrors lens-pdf's `logUnwiredHide()` so a contributor notices a
 * feature self-hid during development instead of silently vanishing.
 *
 * No-op in production builds (`process.env.NODE_ENV === "production"`)
 * and deduped per `(service, mode)` for the process lifetime.
 *
 * @public
 */
export function logUnwiredHide(service: EditorServiceName, mode: ServiceFallbackMode): void {
  if (mode === "wired") return;
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") return;
  const key = `${service}:${mode}`;
  if (WARNED.has(key)) return;
  WARNED.add(key);
  console.warn(
    `[artwork-pdf-editor] service "${service}" is unwired — tool resolved to "${mode}". ` +
      "Inject the service via <EmbeddableEditor services={...}> to enable it.",
  );
}

/**
 * Test-only — clear the per-process warn-dedup set so a test can
 * assert {@link logUnwiredHide} fires. Not exported through the public
 * barrel.
 */
export function _resetUnwiredWarnings(): void {
  WARNED.clear();
}
