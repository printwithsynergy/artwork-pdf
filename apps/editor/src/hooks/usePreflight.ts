// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import type { PreflightReport, PreflightRule } from "@artworkpdf/document-model";
import { useCallback, useState } from "react";
import { runClientChecks } from "../lib/preflight/index.js";

type PreflightState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "done"; report: PreflightReport }
  | { phase: "error"; message: string };

const SERVICE_URL = (process.env.NEXT_PUBLIC_SERVICE_URL ?? "http://localhost:3001").replace(
  /\/$/,
  "",
);

export function usePreflight() {
  const [state, setState] = useState<PreflightState>({ phase: "idle" });

  const run = useCallback(
    async (file: File, opts?: { labelClass?: string; labelType?: string; tenantId?: string }) => {
      setState({ phase: "loading" });
      try {
        const params = new URLSearchParams();
        if (opts?.labelClass) params.set("label_class", opts.labelClass);
        if (opts?.labelType) params.set("label_type", opts.labelType);
        if (opts?.tenantId) params.set("tenant_id", opts.tenantId);

        const res = await fetch(`${SERVICE_URL}/preflight-rules?${params}`);
        const { rules }: { rules: PreflightRule[] } = await res.json();

        const { issues, skippedChecks } = await runClientChecks(file, rules);
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
    [],
  );

  return { state, run };
}
