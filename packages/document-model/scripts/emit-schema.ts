// SPDX-License-Identifier: AGPL-3.0-or-later
// Emits a JSON Schema for the DocumentModel type so cross-language
// consumers (compile-pdf's Python compose producer, etc.) can validate
// payloads against an authoritative single source.
//
// Output: dist/schema/document-model.schema.json
//
// Re-run via `pnpm --filter @artworkpdf/document-model schema:emit` after
// any type change in src/extended.ts or src/preflight.ts.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGenerator } from "ts-json-schema-generator";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");

const generator = createGenerator({
  path: resolve(pkgRoot, "src/index.ts"),
  tsconfig: resolve(pkgRoot, "tsconfig.json"),
  type: "DocumentModel",
  expose: "export",
  topRef: true,
  jsDoc: "extended",
  skipTypeCheck: false,
});

const schema = generator.createSchema("DocumentModel");

const outDir = resolve(pkgRoot, "dist/schema");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "document-model.schema.json");
writeFileSync(outPath, `${JSON.stringify(schema, null, 2)}\n`);

console.log(`Wrote ${outPath} (${Object.keys(schema.definitions ?? {}).length} type defs)`);
