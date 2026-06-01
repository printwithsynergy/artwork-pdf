// SPDX-License-Identifier: AGPL-3.0-or-later
import { sql } from "drizzle-orm";
import { getDb } from "./client.js";

/**
 * Idempotent boot-time schema bootstrap.
 *
 * Runs `CREATE TABLE IF NOT EXISTS` for the three application tables
 * (`jobs`, `preflight_rules`, `assets`). Intentionally not using a
 * proper migration framework — apps/service owns a tiny, append-only
 * schema and the synergy engine treats artworkPDF as ephemeral
 * (state-of-record lives in platform), so the "create on boot if
 * missing" model is enough. Re-running is safe.
 *
 * Resolves with no-op when `DATABASE_URL` is unset.
 *
 * pg-boss owns its own schema (`pgboss` by default; see
 * {@link getBoss}) and runs its own migrations internally — those
 * tables are not managed here.
 */
export async function runMigrations(): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      status      TEXT        NOT NULL DEFAULT 'queued',
      request     JSONB       NOT NULL DEFAULT '{}',
      result      JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS preflight_rules (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   TEXT,
      label_class TEXT,
      label_type  TEXT,
      check_name  TEXT        NOT NULL,
      enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
      severity    TEXT        NOT NULL DEFAULT 'block',
      client_side BOOLEAN     NOT NULL DEFAULT FALSE,
      params      JSONB       NOT NULL DEFAULT '{}',
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS assets (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      filename    TEXT        NOT NULL,
      mime_type   TEXT        NOT NULL,
      size_bytes  INTEGER     NOT NULL,
      disk_path   TEXT        NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
