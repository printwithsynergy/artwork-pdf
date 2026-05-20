// SPDX-License-Identifier: AGPL-3.0-or-later
import { DEFAULT_PREFLIGHT_RULES } from "@artworkpdf/document-model";
import { Hono } from "hono";

export const preflightRulesRouter = new Hono();

// GET /preflight-rules?label_class=flexo&label_type=wine&tenant_id=xxx
preflightRulesRouter.get("/", async (c) => {
  const labelClass = c.req.query("label_class") ?? null;
  const labelType = c.req.query("label_type") ?? null;
  const tenantId = c.req.query("tenant_id") ?? null;

  // TODO: load preflight_rules rows for (tenantId, labelClass, labelType)
  // and merge over DEFAULT_PREFLIGHT_RULES by checkName.
  return c.json({
    rules: DEFAULT_PREFLIGHT_RULES,
    context: { labelClass, labelType, tenantId },
    source: "defaults",
  });
});
