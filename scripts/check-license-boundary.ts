// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Checks:
 * 1. No source file imports from 'platform' or 'platform/recipes'
 * 2. Every .ts/.tsx source file has an SPDX-License-Identifier header
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const SOURCE_DIRS = ["apps", "packages", "scripts"];
const SOURCE_EXTS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const PLATFORM_IMPORT = /from ['"]platform[\/]/;
const SPDX = /SPDX-License-Identifier:/;

let violations = 0;

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === "dist" || entry === ".next") continue;
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else if (SOURCE_EXTS.has(extname(full))) files.push(full);
  }
  return files;
}

for (const dir of SOURCE_DIRS) {
  const files = walk(dir).catch ? [] : walk(dir);
  for (const file of files as string[]) {
    const content = readFileSync(file, "utf8");
    if (PLATFORM_IMPORT.test(content)) {
      console.error(`BOUNDARY VIOLATION: ${file} imports from 'platform'`);
      violations++;
    }
    if (!SPDX.test(content)) {
      console.error(`MISSING SPDX: ${file} lacks SPDX-License-Identifier header`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} license boundary violation(s) found.`);
  process.exit(1);
} else {
  console.log("License boundary check passed.");
}
