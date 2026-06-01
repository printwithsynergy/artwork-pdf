// SPDX-License-Identifier: AGPL-3.0-or-later
import PgBoss from "pg-boss";

let _boss: PgBoss | null = null;
let _started = false;

/**
 * Get the shared pg-boss instance, lazily constructed and started on
 * first call.
 *
 * Returns `null` when `DATABASE_URL` is unset (same HTTP-only fallback
 * pattern as {@link getDb}). When set, pg-boss is configured to use
 * the schema named by `PG_BOSS_SCHEMA` (default `"pgboss"`) — this
 * keeps the queue tables out of the application schema so they can be
 * managed/dropped independently.
 *
 * `start()` is idempotent in practice but we guard it with an
 * `_started` flag to avoid the double-start warning pg-boss emits
 * when `getBoss()` is racy on cold start (`index.ts` calls it before
 * registering work handlers; `routes/jobs.ts` calls it on the first
 * `POST /jobs`).
 */
export async function getBoss(): Promise<PgBoss | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  if (!_boss) {
    _boss = new PgBoss({
      connectionString: url,
      schema: process.env.PG_BOSS_SCHEMA ?? "pgboss",
    });
  }

  if (!_started) {
    await _boss.start();
    _started = true;
  }

  return _boss;
}
