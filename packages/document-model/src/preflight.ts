// SPDX-License-Identifier: AGPL-3.0-or-later

export type PreflightSeverity = "block" | "warn";

export type PreflightRule = {
  checkName: string;
  enabled: boolean;
  severity: PreflightSeverity;
  clientSide: boolean;
  params: Record<string, unknown>;
};

export type PreflightIssue = {
  checkName: string;
  severity: PreflightSeverity;
  message: string;
  page?: number;
  detail?: Record<string, unknown>;
};

export type PreflightReport = {
  passed: boolean;
  hasBlockingIssues: boolean;
  issues: PreflightIssue[];
  skippedChecks: string[];
  checkedAt: string;
};

export type LabelClass = "flexo" | "offset" | "digital" | "screen" | "gravure";
