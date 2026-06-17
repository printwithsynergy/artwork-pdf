// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * React seam for the host-injected service surface.
 *
 * Hosts inject services once at the top of the embed (see
 * {@link import("../components/EmbeddableEditor").EmbeddableEditor});
 * every tool reads them through {@link useEditorServices} /
 * {@link useEditorService} and decides its own visibility via
 * {@link useServiceFallbackMode}. This is the artwork-pdf analogue of
 * lens-pdf's `ViewerServicesContext` + `useFallbackMode`.
 *
 * The provider is a thin wrapper — all the decision logic lives in the
 * pure {@link import("./fallback-mode").resolveServiceFallbackMode} so
 * it stays testable without a DOM.
 *
 * @packageDocumentation
 */

import { createContext, createElement, type ReactNode, useContext, useMemo } from "react";
import type { EditorConfig, FeatureKey } from "../lib/editor-config";
import {
  logUnwiredHide,
  resolveServiceFallbackMode,
  type ServiceFallbackMode,
} from "./fallback-mode";
import { defaultEditorServices, type EditorServiceName, type EditorServices } from "./services";

/**
 * Context value: the resolved (stub-filled) service surface plus the
 * resolved editor config the self-hide hook needs. Never `undefined`
 * to consumers — {@link useEditorServices} falls back to an all-unwired
 * surface when a tool is rendered outside a provider, so a stray mount
 * degrades to "everything hidden" rather than throwing.
 */
interface EditorServicesContextValue {
  readonly services: EditorServices;
  readonly config: EditorConfig | null;
}

const EditorServicesContext = createContext<EditorServicesContextValue | null>(null);

/**
 * Props for {@link EditorServicesProvider}.
 *
 * @public
 */
export interface EditorServicesProviderProps {
  /**
   * Host-injected services. Any field left out falls through to an
   * unwired no-op stub, so the matching tool self-hides. Pass `{}` (or
   * omit) for a fully offline embed.
   */
  services?: Partial<EditorServices>;
  /**
   * The resolved editor config, threaded so {@link useServiceFallbackMode}
   * can apply the flag / plan-gate / capability layer alongside the
   * service-wired check. Optional — when absent the self-hide hook
   * applies only the service layer.
   */
  config?: EditorConfig;
  children: ReactNode;
}

/**
 * Provide the host-injected service surface to every tool below it.
 * Mount once at the top of the embed. Memoizes the resolved surface so
 * a stable `services` prop doesn't re-fill stubs on every render.
 *
 * @public
 */
export function EditorServicesProvider({
  services,
  config,
  children,
}: EditorServicesProviderProps) {
  const value = useMemo<EditorServicesContextValue>(
    () => ({ services: defaultEditorServices(services), config: config ?? null }),
    [services, config],
  );
  return createElement(EditorServicesContext.Provider, { value }, children);
}

/**
 * Read the resolved (stub-filled) service surface. Rendered outside a
 * provider, returns an all-unwired surface so every service-backed
 * tool self-hides rather than the hook throwing.
 *
 * @public
 */
export function useEditorServices(): EditorServices {
  const ctx = useContext(EditorServicesContext);
  // Memo keyed on identity: a missing provider yields one stable
  // all-unwired surface for the component's lifetime.
  const fallback = useMemo(() => defaultEditorServices(), []);
  return ctx?.services ?? fallback;
}

/**
 * Read a single injected service by name. Equivalent to
 * `useEditorServices()[name]` but reads as intent at the call site.
 *
 * @public
 */
export function useEditorService<K extends EditorServiceName>(name: K): EditorServices[K] {
  return useEditorServices()[name];
}

/**
 * The capability self-hide hook — resolve a service-backed tool's
 * visibility mode (`wired` / `fallback` / `hidden`) from the injected
 * services and the active config. Thin wrapper over the pure
 * {@link resolveServiceFallbackMode}; emits a one-time dev warning via
 * {@link logUnwiredHide} when the tool isn't `wired`.
 *
 * Typical use:
 *
 * ```tsx
 * function SwatchesTool() {
 *   const mode = useServiceFallbackMode("spotSearch", "swatches");
 *   if (mode === "hidden") return null;
 *   const search = useEditorService("spotSearch")!;
 *   return <SwatchesPicker search={(o) => search.search(o)} />;
 * }
 * ```
 *
 * @public
 */
export function useServiceFallbackMode(
  service: EditorServiceName,
  feature?: FeatureKey,
  opts?: { hasFallback?: boolean },
): ServiceFallbackMode {
  const ctx = useContext(EditorServicesContext);
  const services = useEditorServices();
  // Without a config we can still apply the service-wired layer; the
  // flag layer is simply skipped (treated as open).
  const config = ctx?.config ?? null;
  const mode = resolveServiceFallbackMode({
    config: config ?? ({} as EditorConfig),
    services,
    ...(feature !== undefined ? { feature } : {}),
    service,
    ...(opts?.hasFallback !== undefined ? { hasFallback: opts.hasFallback } : {}),
  });
  if (mode !== "wired") logUnwiredHide(service, mode);
  return mode;
}
