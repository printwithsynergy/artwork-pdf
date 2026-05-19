// SPDX-License-Identifier: AGPL-3.0-or-later
// Checks: (1) no imports from 'platform', (2) SPDX header on every .ts/.tsx file.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const SOURCE_DIRS = ['apps', 'packages', 'scripts'];
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts', '.mjs']);
const PLATFORM_IMPORT = /from ['"](platform|platform\/)/;
const SPDX = /SPDX-License-Identifier:/;

let violations = 0;

function walk(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else if (SOURCE_EXTS.has(extname(full))) files.push(full);
  }
  return files;
}

for (const dir of SOURCE_DIRS) {
  for (const file of walk(dir)) {
    const content = readFileSync(file, 'utf8');
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
  console.log('License boundary check passed.');
}
