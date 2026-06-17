// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Drop-in embeddable artwork editor.
 *
 * `EmbeddableEditor` is the host-injection entry point for
 * `@printwithsynergy/artwork-pdf-editor`, modeled on lens-pdf's
 * `<LensPDF services={…}>` story. A host mounts it once, injects the
 * services its backend supports, and every service-backed tool
 * self-hides when its service isn't wired:
 *
 * ```tsx
 * import { EmbeddableEditor } from "@printwithsynergy/artwork-pdf-editor";
 *
 * <EmbeddableEditor
 *   services={{
 *     preflightRules: { getRules: () => myClient.preflightRules() },
 *     spotSearch:     { search:   (o) => myClient.spotSearch(o) },
 *   }}
 * />
 * ```
 *
 * What it adds over the lower-level {@link EditorApp}:
 *   - Wraps the tree in an {@link EditorServicesProvider} so tools read
 *     host services through {@link useServiceFallbackMode} /
 *     {@link useEditorService}.
 *   - **Capability auto-posture:** when `autoHideUnwired` is on
 *     (default), services the host did *not* inject flip their matching
 *     `EditorConfig.capabilities` flag off, so those tools self-hide
 *     through the existing four-gate {@link showFeature} path with no
 *     per-tool wiring. The host can still override any flag explicitly
 *     via `config`.
 *
 * The compile boundary is preserved: the editor expresses intent
 * through the injected services; it never embeds policy verdicts or a
 * PDF writer.
 *
 * @packageDocumentation
 */

import { useMemo } from "react";
import { type EditorConfig, type FeatureKey, resolveConfig } from "../lib/editor-config";
import { EditorServicesProvider } from "../services/context";
import {
  defaultEditorServices,
  type EditorServiceName,
  type EditorServices,
  isServiceUnwired,
} from "../services/services";
import { EditorApp, type EditorAppProps } from "./EditorApp";

/**
 * Maps each `EditorConfig` feature that depends on a host service to
 * the service it needs. When `autoHideUnwired` is on, every feature in
 * this table whose service is unwired has its capability gate forced
 * closed. The table is the single source of truth for "which tools are
 * backend-backed" — extend it when a new service-backed tool lands.
 *
 * @public
 */
export const SERVICE_BACKED_FEATURES: ReadonlyArray<{
  feature: FeatureKey;
  service: EditorServiceName;
}> = [
  // Preflight-rules service.
  { feature: "process_preflight", service: "preflightRules" },
  // Spot / PANTONE search service.
  { feature: "swatches", service: "spotSearch" },
  { feature: "smart_spot_match", service: "spotSearch" },
  { feature: "palette_to_spot", service: "spotSearch" },
  // Separations service.
  { feature: "inks_panel", service: "separations" },
  // AI assist service.
  { feature: "copy_generation", service: "ai" },
  { feature: "image_generation", service: "ai" },
  { feature: "auto_layout", service: "ai" },
  { feature: "ocr_rebuild", service: "ai" },
  { feature: "design_suggestions", service: "ai" },
  { feature: "preflight_autofix", service: "ai" },
  // Notification service.
  { feature: "slack_notify", service: "notifications" },
  { feature: "email_notify", service: "notifications" },
  { feature: "webhook_notify", service: "notifications" },
];

/**
 * Compute the `capabilities` overrides that force every backend-backed
 * feature whose service is unwired to `false`. Host-supplied
 * `capabilities` always win (merged on top), so a host can re-enable a
 * tool it knows works even if it didn't go through the typed service
 * seam. Pure + exported for unit testing the self-hide posture without
 * a DOM.
 *
 * @public
 */
export function capabilitiesForServices(
  services: EditorServices,
  hostCapabilities?: Record<string, boolean>,
): Record<string, boolean> {
  const caps: Record<string, boolean> = {};
  for (const { feature, service } of SERVICE_BACKED_FEATURES) {
    if (isServiceUnwired(services[service])) {
      caps[feature] = false;
    }
  }
  return { ...caps, ...(hostCapabilities ?? {}) };
}

/**
 * Props for {@link EmbeddableEditor}. A superset of {@link EditorAppProps}
 * with the host-injection surface.
 *
 * @public
 */
export interface EmbeddableEditorProps extends EditorAppProps {
  /**
   * Host-injected services. Any service left out falls through to an
   * unwired no-op stub and its tools self-hide. Omit entirely for a
   * fully offline embed (marketing demo, client preview).
   */
  services?: Partial<EditorServices>;
  /**
   * When `true` (default), services the host didn't inject force their
   * matching `EditorConfig.capabilities` flag off so the tool
   * self-hides via {@link showFeature}. Set `false` to keep tools
   * visible regardless of service wiring (e.g. a host that wires
   * services lazily after mount and renders empty states meanwhile).
   */
  autoHideUnwired?: boolean;
}

/**
 * Mount the editor with a host-injected service surface + capability
 * self-hide. See the {@link EmbeddableEditor module docs} for the
 * full contract.
 *
 * @public
 */
export function EmbeddableEditor({
  services,
  autoHideUnwired = true,
  config: configOverrides,
  preferMode = "auto",
  ...rest
}: EmbeddableEditorProps) {
  const resolved = useMemo(() => defaultEditorServices(services), [services]);

  // Resolve the config the same way EditorApp does so the provider and
  // the rendered editor agree on the active flags. EditorApp resolves
  // again internally from the merged overrides we pass down, so the
  // posture stays consistent across both.
  const mode: "basic" | "pro" = preferMode === "basic" ? "basic" : "pro";
  const mergedOverrides = useMemo<Partial<EditorConfig>>(() => {
    if (!autoHideUnwired) return configOverrides ?? {};
    return {
      ...configOverrides,
      capabilities: capabilitiesForServices(resolved, configOverrides?.capabilities),
    };
  }, [autoHideUnwired, configOverrides, resolved]);

  const resolvedConfig = useMemo(
    () => resolveConfig(mode, mergedOverrides),
    [mode, mergedOverrides],
  );

  return (
    <EditorServicesProvider
      {...(services !== undefined ? { services } : {})}
      config={resolvedConfig}
    >
      <EditorApp {...rest} preferMode={preferMode} config={mergedOverrides} />
    </EditorServicesProvider>
  );
}
