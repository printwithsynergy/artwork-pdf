// SPDX-License-Identifier: AGPL-3.0-or-later
import { sql } from "drizzle-orm";
import { getDb } from "./client.js";

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
}
