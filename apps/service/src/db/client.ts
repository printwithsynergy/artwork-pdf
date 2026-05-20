// SPDX-License-Identifier: AGPL-3.0-or-later
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | null = null;

export function getDb(): Db | null {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const client = postgres(url, { max: 10 });
  _db = drizzle(client, { schema });
  return _db;
}
