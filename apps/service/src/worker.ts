// SPDX-License-Identifier: AGPL-3.0-or-later
import PgBoss from "pg-boss";
import { renderJob } from "./handlers/render.js";

let boss: PgBoss | null = null;

export async function startWorker(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("DATABASE_URL not set — worker disabled");
    return;
  }
  boss = new PgBoss({ connectionString: databaseUrl, schema: process.env.PG_BOSS_SCHEMA ?? "pgboss" });
  await boss.start();
  await boss.work<Record<string, unknown>>("artwork.render", renderJob);
  await boss.work<Record<string, unknown>>("artwork.thumbnail", renderJob);
  await boss.work<Record<string, unknown>>("artwork.preview-separations", renderJob);
}
