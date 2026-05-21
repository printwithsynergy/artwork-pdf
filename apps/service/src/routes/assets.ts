// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { assets } from "../db/schema.js";

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
