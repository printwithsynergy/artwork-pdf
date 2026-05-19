// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PreflightRule } from "@artworkpdf/document-model";
import { Hono } from "hono";

// Baseline rules shipped with the service.
// All thresholds are configurable via the preflight_rules table;
// Platform tenant config is merged on top of these defaults at query time.
const DEFAULT_RULES: PreflightRule[] = [
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

export const preflightRulesRouter = new Hono();

// GET /preflight-rules?label_class=flexo&label_type=wine&tenant_id=xxx
// Returns the effective rule set for the given context.
// Client-side rules are returned immediately for browser execution;
// server-side rules are run by the lint synergy node.
preflightRulesRouter.get("/", async (c) => {
  const labelClass = c.req.query("label_class") ?? null;
  const labelType = c.req.query("label_type") ?? null;
  const tenantId = c.req.query("tenant_id") ?? null;

  // TODO: load preflight_rules rows for (tenantId, labelClass, labelType)
  // and merge them over DEFAULT_RULES by checkName before returning.
  return c.json({
    rules: DEFAULT_RULES,
    context: { labelClass, labelType, tenantId },
    source: "defaults",
  });
});
