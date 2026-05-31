// SPDX-License-Identifier: AGPL-3.0-or-later
// Emits JSON Schemas for the DocumentModel types so cross-language
// consumers (compile-pdf's Python compose producer, etc.) can validate
// payloads against an authoritative single source.
//
// Outputs:
//   - dist/schema/document-model.v2.schema.json   (legacy flat DocumentModel)
//   - dist/schema/document-model.v3.schema.json   (pages-first DocumentV3)
//   - dist/schema/document-model.schema.json      (alias of v2 for backward-compat)
//
// Re-run via `pnpm --filter @artworkpdf/document-model schema:emit` after
// any type change in src/extended.ts, src/v3.ts, or src/preflight.ts.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGenerator } from "ts-json-schema-generator";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const outDir = resolve(pkgRoot, "dist/schema");
mkdirSync(outDir, { recursive: true });

function emit(typeName: string, outFile: string): void {
  const generator = createGenerator({
    path: resolve(pkgRoot, "src/index.ts"),
    tsconfig: resolve(pkgRoot, "tsconfig.json"),
    type: typeName,
    expose: "export",
    topRef: true,
    jsDoc: "extended",
    skipTypeCheck: false,
  });
  const schema = generator.createSchema(typeName);
  const outPath = resolve(outDir, outFile);
  writeFileSync(outPath, `${JSON.stringify(schema, null, 2)}\n`);
  console.log(`Wrote ${outPath} (${Object.keys(schema.definitions ?? {}).length} type defs)`);
}

emit("DocumentModel", "document-model.v2.schema.json");
emit("DocumentV3", "document-model.v3.schema.json");
emit("DocumentModel", "document-model.schema.json");
