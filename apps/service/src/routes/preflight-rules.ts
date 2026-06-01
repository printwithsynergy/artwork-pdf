// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  DEFAULT_PREFLIGHT_RULES,
  type PreflightRule,
  type PreflightSeverity,
} from "@artworkpdf/document-model";
import { and, eq, isNull, or } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { preflightRules } from "../db/schema.js";

export const preflightRulesRouter = new Hono();

// GET /preflight-rules?label_class=flexo&label_type=wine&tenant_id=xxx
// Merges tenant/label overrides from DB over the compiled defaults.
// Resolution: global defaults < labelClass match < labelType match < tenantId match.
preflightRulesRouter.get("/", async (c) => {
  const labelClass = c.req.query("label_class") ?? null;
  const labelType = c.req.query("label_type") ?? null;
  const tenantId = c.req.query("tenant_id") ?? null;

  const db = getDb();
  if (!db) {
    return c.json({
      rules: DEFAULT_PREFLIGHT_RULES,
      context: { labelClass, labelType, tenantId },
      source: "defaults",
    });
  }

  const rows = await db
    .select()
    .from(preflightRules)
    .where(
      and(
        or(isNull(preflightRules.tenantId), eq(preflightRules.tenantId, tenantId ?? "")),
        or(isNull(preflightRules.labelClass), eq(preflightRules.labelClass, labelClass ?? "")),
        or(isNull(preflightRules.labelType), eq(preflightRules.labelType, labelType ?? "")),
      ),
    );

  if (rows.length === 0) {
    return c.json({
      rules: DEFAULT_PREFLIGHT_RULES,
      context: { labelClass, labelType, tenantId },
      source: "defaults",
    });
  }

  const merged: PreflightRule[] = DEFAULT_PREFLIGHT_RULES.map((rule) => {
    const override = rows.find((r) => r.checkName === rule.checkName);
    if (!override) return rule;
    return {
      ...rule,
      enabled: override.enabled,
      severity: override.severity as PreflightSeverity,
      clientSide: override.clientSide,
      params: (override.params as Record<string, unknown>) ?? rule.params,
    };
  });

  return c.json({ rules: merged, context: { labelClass, labelType, tenantId }, source: "db" });
});
