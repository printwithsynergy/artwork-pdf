// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { assets } from "../db/schema.js";

/**
 * `/assets` — upload + serve asset bytes referenced by document models.
 *
 * Two endpoints:
 *
 * - `POST /assets` — multipart form upload, field `file`. Writes
 *   bytes to disk under `ASSET_DIR` (default `./uploads`) at
 *   `{uuid}.{ext}`, inserts a metadata row, returns
 *   `201 { id, url: "/assets/:id" }`. Returns `400 { error: "no_file" }`
 *   if the `file` field is missing or not a `File`.
 * - `GET /assets/:id` — stream the bytes with the stored MIME type
 *   and an `inline; filename="<original>"` Content-Disposition. The
 *   `Cache-Control: public, max-age=31536000, immutable` header is
 *   intentional: asset IDs are UUIDs allocated at upload time, so
 *   the bytes-for-a-given-id never change. `404` if the row is
 *   missing; `503 { error: "no_db" }` when `DATABASE_URL` is unset
 *   (we *could* still read from disk for `POST`-then-`GET` round-trips
 *   in a single process, but without the DB row the MIME type is
 *   unknown — safer to fail loudly).
 */
export const assetsRouter = new Hono();

const assetDir = (): string => process.env.ASSET_DIR ?? "./uploads";

assetsRouter.post("/", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) {
    return c.json({ error: "no_file" }, 400);
  }

  const dir = assetDir();
  await mkdir(dir, { recursive: true });

  const id = crypto.randomUUID();
  const ext = file.name.split(".").pop() ?? "bin";
  const diskPath = join(dir, `${id}.${ext}`);
  const buffer = await file.arrayBuffer();
  await writeFile(diskPath, Buffer.from(buffer));

  const db = getDb();
  if (db) {
    await db.insert(assets).values({
      id,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buffer.byteLength,
      diskPath,
    });
  }

  return c.json({ id, url: `/assets/${id}` }, 201);
});

assetsRouter.get("/:id", async (c) => {
  const { id } = c.req.param();
  const db = getDb();

  if (!db) return c.json({ error: "no_db" }, 503);

  const [row] = await db.select().from(assets).where(eq(assets.id, id));
  if (!row) return c.json({ error: "not_found" }, 404);

  const buffer = await readFile(row.diskPath);
  return new Response(buffer, {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Disposition": `inline; filename="${row.filename}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
