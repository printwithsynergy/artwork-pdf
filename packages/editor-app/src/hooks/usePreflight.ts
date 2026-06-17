// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { useCallback, useState } from "react";
import { runClientChecks } from "../lib/preflight/index";
import {
  DEFAULT_PREFLIGHT_RULES,
  type PreflightReport,
  type PreflightRule,
} from "../lib/preflight/types";
import { useEditorService } from "../services/context";
import { isServiceUnwired } from "../services/services";

type PreflightState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "done"; report: PreflightReport }
  | { phase: "error"; message: string };

const SERVICE_URL = (process.env.NEXT_PUBLIC_SERVICE_URL ?? "http://localhost:3001").replace(
  /\/$/,
  "",
);

/**
 * Resolve the preflight rule set, preferring the host-injected
 * {@link import("../services/services").PreflightRulesService}. When no
 * service is wired the hook keeps its legacy behaviour: demo mode uses
 * the bundled {@link DEFAULT_PREFLIGHT_RULES}; otherwise it falls back
 * to the env-configured `apps/service` `/preflight-rules` fetch.
 *
 * Injecting the service is the embeddable path — it removes the
 * hardcoded backend route so a host points the editor at its own
 * tenant's rule source without the `NEXT_PUBLIC_SERVICE_URL` env.
 */
export function usePreflight() {
  const [state, setState] = useState<PreflightState>({ phase: "idle" });
  const preflightRules = useEditorService("preflightRules");

  const run = useCallback(
    async (
      file: File,
      opts?: {
        labelClass?: string;
        labelType?: string;
        tenantId?: string;
        demoMode?: boolean;
      },
    ) => {
      setState({ phase: "loading" });
      try {
        let rules: ReadonlyArray<PreflightRule>;

        if (opts?.demoMode) {
          rules = DEFAULT_PREFLIGHT_RULES;
        } else if (preflightRules && !isServiceUnwired(preflightRules)) {
          // Host wired a rules service — use it (no hardcoded route).
          rules = await preflightRules.getRules({
            ...(opts?.labelClass !== undefined ? { labelClass: opts.labelClass } : {}),
            ...(opts?.labelType !== undefined ? { labelType: opts.labelType } : {}),
            ...(opts?.tenantId !== undefined ? { tenantId: opts.tenantId } : {}),
          });
        } else {
          // Legacy fallback: env-configured apps/service route.
          const params = new URLSearchParams();
          if (opts?.labelClass) params.set("label_class", opts.labelClass);
          if (opts?.labelType) params.set("label_type", opts.labelType);
          if (opts?.tenantId) params.set("tenant_id", opts.tenantId);
          const res = await fetch(`${SERVICE_URL}/preflight-rules?${params}`);
          const body: { rules: PreflightRule[] } = await res.json();
          rules = body.rules;
        }

        const { issues, skippedChecks } = await runClientChecks(file, [...rules]);
        const hasBlockingIssues = issues.some((i) => i.severity === "block");

        const report: PreflightReport = {
          passed: !hasBlockingIssues,
          hasBlockingIssues,
          issues,
          skippedChecks,
          checkedAt: new Date().toISOString(),
        };

        setState({ phase: "done", report });
        return report;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Preflight check failed";
        setState({ phase: "error", message });
        return null;
      }
    },
    [preflightRules],
  );

  return { state, run };
}
