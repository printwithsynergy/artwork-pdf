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

/**
 * `/preflight-rules` — read the effective preflight ruleset for a
 * given label scope.
 *
 * `GET /preflight-rules?label_class=flexo&label_type=wine&tenant_id=xxx`
 *
 * Returns `{ rules, context, source }` where:
 * - `rules` is the merged {@link PreflightRule}[] for the scope.
 * - `context` echoes the query parameters back.
 * - `source` is `"defaults"` (no DB rows matched / no DB configured)
 *   or `"db"` (at least one override row applied).
 *
 * The compiled defaults from `@artworkpdf/document-model` are the
 * floor; matching rows in `preflight_rules` override individual
 * checks (enabled, severity, clientSide, params). See the docstring
 * on {@link preflightRules} for the full scope-resolution order.
 *
 * The editor (`@printwithsynergy/artwork-pdf-editor`) fetches this
 * on mount to drive client-side inline validation; platform pulls
 * the same data at job-submit time to seed `preflight_report` for
 * the compose call.
 */
export const preflightRulesRouter = new Hono();

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
