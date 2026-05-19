// SPDX-License-Identifier: AGPL-3.0-or-later
import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull().default("queued"),
  request: jsonb("request").notNull(),
  result: jsonb("result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// RLS policy (applied via migration):
// ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
// CREATE POLICY jobs_tenant_isolation ON jobs
//   USING (current_setting('app.tenant_id', true) = tenant_id::text);
