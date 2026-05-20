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

export const DEFAULT_PREFLIGHT_RULES: PreflightRule[] = [
  {
    checkName: "dpi_min",
    enabled: true,
    severity: "block",
    clientSide: true,
    params: { minDpi: 300 },
  },
  {
    checkName: "font_embedding",
    enabled: true,
    severity: "block",
    clientSide: true,
    params: {},
  },
  {
    checkName: "bleed_required",
    enabled: true,
    severity: "block",
    clientSide: true,
    params: { bleedMm: 3 },
  },
  {
    checkName: "spot_color_validation",
    enabled: true,
    severity: "warn",
    clientSide: true,
    params: { allowUnknown: false },
  },
  {
    checkName: "min_font_size_pt",
    enabled: true,
    severity: "block",
    clientSide: false,
    params: { minPt: 4 },
  },
  {
    checkName: "min_line_weight_pt",
    enabled: true,
    severity: "block",
    clientSide: false,
    params: { minPt: 0.25 },
  },
  {
    checkName: "total_ink_coverage",
    enabled: true,
    severity: "warn",
    clientSide: false,
    params: { maxPercent: 300 },
  },
  {
    checkName: "color_profile",
    enabled: true,
    severity: "warn",
    clientSide: false,
    params: { allowedProfiles: ["ISOcoated_v2_eci", "Fogra51", "GRACoL2006_Coated"] },
  },
  {
    checkName: "overprint_settings",
    enabled: true,
    severity: "warn",
    clientSide: false,
    params: { requireBlackOverprint: true },
  },
  {
    checkName: "image_mode",
    enabled: true,
    severity: "block",
    clientSide: false,
    params: { allowedModes: ["CMYK", "Spot", "DeviceN", "Gray"] },
  },
];
