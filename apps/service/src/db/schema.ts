// SPDX-License-Identifier: AGPL-3.0-or-later
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull().default("queued"),
  request: jsonb("request").notNull(),
  result: jsonb("result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Preflight rules are scoped by tenant + label class + label type.
// Null in any scope column means "applies to all" at that level.
// Resolution order: global defaults < labelClass < labelType < tenantId.
// Platform stores tenant overrides and passes the effective config to Synergy
// when enqueuing a job; the service exposes /preflight-rules for client-side fetch.
export const preflightRules = pgTable("preflight_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id"),
  labelClass: text("label_class"),
  labelType: text("label_type"),
  checkName: text("check_name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  severity: text("severity").notNull().default("block"),
  clientSide: boolean("client_side").notNull().default(false),
  params: jsonb("params").notNull().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  diskPath: text("disk_path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
