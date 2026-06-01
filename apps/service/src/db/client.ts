// SPDX-License-Identifier: AGPL-3.0-or-later
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | null = null;

/**
 * Get the shared Drizzle DB handle, lazily constructed on first call.
 *
 * Returns `null` (not a thrown error) when `DATABASE_URL` is unset, so
 * apps/service can boot in HTTP-only mode for environments without
 * Postgres (local smoke tests, `/healthz`-only deployments). Every
 * caller is responsible for null-checking and degrading gracefully —
 * the `/jobs` route, for example, returns a synthetic queued response
 * when `db === null` so the synergy engine can still receive a job ID.
 *
 * The handle is memoized at module scope; pool size is fixed at 10.
 * Returning the same instance across calls is intentional: pg-boss,
 * Drizzle queries, and route handlers all share the same connection
 * pool to avoid exhausting Postgres connection slots under load.
 */
export function getDb(): Db | null {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const client = postgres(url, { max: 10 });
  _db = drizzle(client, { schema });
  return _db;
}
