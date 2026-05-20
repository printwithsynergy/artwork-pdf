// SPDX-License-Identifier: AGPL-3.0-or-later
import PgBoss from "pg-boss";

let _boss: PgBoss | null = null;
let _started = false;

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
