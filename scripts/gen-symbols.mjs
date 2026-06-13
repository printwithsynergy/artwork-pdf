// SPDX-License-Identifier: AGPL-3.0-or-later
//
// gen-symbols.mjs — regenerate SYMBOLS.md from each package's public barrel.
//
// For every workspace package under packages/*, this resolves the public
// entry points declared in package.json `exports` to their TypeScript source
// barrels and lists the exported symbol names. `export *` re-exports are
// followed into their target files so the wildcard surface is enumerated too.
//
// Regex-based (no TS compiler) to stay dependency-free, matching the rest of
// scripts/. Run via `pnpm run symbols`.

import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES_DIR = join(ROOT, "packages");

/**
 * Map a built entry (dist/*.js|.d.ts) to its TypeScript source under src/.
 * Falls back to `.tsx` when the `.ts` file doesn't exist so React barrels
 * aren't silently dropped.
 */
function entryToSource(pkgDir, entry) {
  const rel = entry
    .replace(/^\.\//, "")
    .replace(/^dist\//, "src/")
    .replace(/\.d\.ts$/, ".ts")
    .replace(/\.js$/, ".ts");
  const ts = join(pkgDir, rel);
  if (existsSync(ts)) return ts;
  const tsx = ts.replace(/\.ts$/, ".tsx");
  return existsSync(tsx) ? tsx : ts;
}

/** Resolve a relative module specifier from a source file to a .ts file. */
function resolveSpecifier(fromFile, spec) {
  const base = join(dirname(fromFile), spec.replace(/\.js$/, ""));
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const NAMED = /export\s+(?:type\s+)?\{([^}]*)\}(?:\s+from\s+["'][^"']+["'])?/g;
const DECL =
  /export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(?:const|let|var|function\*?|class|type|interface|enum|namespace)\s+([A-Za-z0-9_$]+)/g;
const STAR = /export\s+\*\s+from\s+["']([^"']+)["']/g;

/** Collect exported symbol names from a source barrel, following `export *`. */
async function collectExports(file, seen = new Set()) {
  if (!file || seen.has(file) || !existsSync(file)) return new Set();
  seen.add(file);
  const src = await readFile(file, "utf8");
  const names = new Set();

  for (const m of src.matchAll(NAMED)) {
    for (const raw of m[1].split(",")) {
      const name = raw
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name && /^[A-Za-z0-9_$]+$/.test(name)) names.add(name);
    }
  }
  for (const m of src.matchAll(DECL)) names.add(m[1]);
  for (const m of src.matchAll(STAR)) {
    const target = resolveSpecifier(file, m[1]);
    for (const n of await collectExports(target, seen)) names.add(n);
  }
  return names;
}

/** Enumerate packages, collect their public symbols, and write SYMBOLS.md. */
async function main() {
  const pkgDirs = (await readdir(PACKAGES_DIR, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => join(PACKAGES_DIR, e.name));

  const sections = [];
  for (const pkgDir of pkgDirs) {
    const pkgJsonPath = join(pkgDir, "package.json");
    if (!existsSync(pkgJsonPath)) continue;
    const pkg = JSON.parse(await readFile(pkgJsonPath, "utf8"));
    const lines = [`## ${pkg.name}`, ""];
    if (pkg.description) lines.push(`> ${pkg.description}`, "");

    const exportsField = pkg.exports ?? { ".": pkg.main ?? "./dist/index.js" };
    const subpaths = typeof exportsField === "string" ? { ".": exportsField } : exportsField;

    for (const [subpath, target] of Object.entries(subpaths)) {
      const entry =
        typeof target === "string"
          ? target
          : (target.import ?? target.types ?? target.require ?? target.default);
      if (!entry) continue;
      const label = subpath === "." ? pkg.name : `${pkg.name}${subpath.slice(1)}`;

      if (entry.endsWith(".json")) {
        lines.push(`- \`${label}\` — JSON Schema artifact (\`${entry}\`)`);
        continue;
      }
      const source = entryToSource(pkgDir, entry);
      const names = [...(await collectExports(source))].sort((a, b) => a.localeCompare(b));
      if (subpath !== ".") lines.push(`**Subpath \`${subpath}\`:**`);
      if (names.length === 0) {
        lines.push("_no exported symbols found_");
      } else {
        lines.push(names.map((n) => `\`${n}\``).join(", "));
      }
      lines.push("");
    }
    sections.push({ name: pkg.name, body: lines.join("\n").trimEnd() });
  }

  sections.sort((a, b) => a.name.localeCompare(b.name));

  const out = [
    "# artworkPDF — Symbols",
    "",
    "> Auto-generated from package exports by `scripts/gen-symbols.mjs`.",
    "> Re-run `pnpm run symbols` to update.",
    "",
    ...sections.flatMap((s, i) => (i === 0 ? [s.body] : ["", s.body])),
    "",
  ].join("\n");

  await writeFile(join(ROOT, "SYMBOLS.md"), out, "utf8");
  console.log(`gen-symbols: wrote SYMBOLS.md (${sections.length} packages)`);
}

main().catch((err) => {
  console.error("gen-symbols failed:", err);
  process.exit(1);
});
