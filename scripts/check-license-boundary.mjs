// SPDX-License-Identifier: AGPL-3.0-or-later
// Checks two invariants across all TypeScript source files:
//   1. No file imports from the platform package (AGPL boundary)
//   2. Every file carries an SPDX-License-Identifier header
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const SOURCE_DIRS = ["apps", "packages", "scripts"];
const SOURCE_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs"]);

// Match actual TypeScript/JS import statements that resolve to the platform package.
// Pattern requires the import keyword so inline comments are not matched.
const PLATFORM_IMPORT = /^\s*(import|export)\b[^'"]*from\s+['"]platform(\/|['"])/m;
const SPDX_HEADER = /SPDX-License-Identifier:/;

let violations = 0;

function walk(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === "dist" || entry === ".next") continue;
    if (entry === "next-env.d.ts") continue;
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (SOURCE_EXTS.has(extname(full))) {
      files.push(full);
    }
  }
  return files;
}

for (const dir of SOURCE_DIRS) {
  for (const file of walk(dir)) {
    const content = readFileSync(file, "utf8");
    if (PLATFORM_IMPORT.test(content)) {
      console.error(`BOUNDARY VIOLATION: ${file} has a platform import`);
      violations++;
    }
    if (!SPDX_HEADER.test(content)) {
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
