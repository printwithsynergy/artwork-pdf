// SPDX-License-Identifier: AGPL-3.0-or-later
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Render/thumbnail/preview-separations job lifecycle row.
 *
 * One row per `POST /jobs` submission. `status` transitions
 * `queued → done | failed`; pg-boss owns the actual queue, this
 * table owns the externally-visible job state that `/jobs/:id`,
 * `/jobs/:id/events`, and `/jobs/:id/result` serve. `request` is the
 * full {@link JobSubmitRequest}; `result` is shape-of-handler — for
 * render jobs that's `{ format, pdfBase64, filename, cacheKey }`, for
 * failures it's `{ error }`.
 */
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull().default("queued"),
  request: jsonb("request").notNull(),
  result: jsonb("result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Tenant-scoped preflight-rule overrides.
 *
 * Scoped by (tenantId, labelClass, labelType). NULL in any scope
 * column means "applies to all" at that level. Resolution order
 * (lowest → highest priority):
 *
 *   global defaults  <  labelClass  <  labelType  <  tenantId
 *
 * The `DEFAULT_PREFLIGHT_RULES` constant in `@artworkpdf/document-model`
 * is the floor; rows here override individual checks (enabled,
 * severity, params, clientSide). Platform stores tenant overrides
 * and passes the effective config to Synergy at enqueue time; the
 * service exposes `GET /preflight-rules` so the editor can fetch the
 * same merged config client-side for inline validation.
 */
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

/**
 * Uploaded asset (images, dieline files) referenced by document models.
 *
 * Bytes live on disk at `diskPath` under `ASSET_DIR` (default
 * `./uploads`); the row owns the metadata. `GET /assets/:id` streams
 * the bytes with an immutable `Cache-Control` since UUIDs are
 * content-stable. Lifecycle is intentionally undefined — we never
 * delete rows here; cleanup is a platform concern when a tenant is
 * removed.
 */
export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  diskPath: text("disk_path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
