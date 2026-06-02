// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Wave 3 V1 — Variable-data merge helpers.
 *
 * V1 ships the data-side hooks that turn a Wave 2 V2 variant matrix
 * (rows of `{ tokenName: value }`) and a template string with
 * `{{token}}` placeholders into an ordered list of per-variant
 * rendered strings, ready for compose. The editor stays agnostic to
 * the actual PDF render — these helpers run in the browser to power
 * a preview, then the same logic runs server-side (or in compose)
 * for the final merge.
 *
 * Tokens use double-curly delimiters (`{{firstName}}`). Whitespace
 * inside the delimiters is tolerated (`{{ firstName }}`) — the
 * extracted name is trimmed. Adjacent or nested delimiters are not
 * supported (and would generate invalid PDF text anyway).
 *
 * @public
 */

/**
 * One row in a variant matrix. Keyed by token name, valued by the
 * substitute string. Mirrors the shape produced by Wave 2 V2's
 * {@link import("../components/VariantMatrixPanel").VariantMatrixPanelVariant}.
 *
 * @public
 */
export type MergeRow = Record<string, string>;

/**
 * Result of validating a merge manifest. Empty arrays mean the
 * manifest is valid for this row; `missingTokens` is the list of
 * placeholders in the template that have no entry in the row;
 * `unusedColumns` is the inverse — keys in the row that the template
 * doesn't reference (useful for warning hosts about typos in
 * column names).
 *
 * @public
 */
export type MergeValidationResult = {
  missingTokens: string[];
  unusedColumns: string[];
};

const TOKEN_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * Extract every `{{token}}` name (deduplicated, in first-occurrence
 * order) from a template string. Whitespace inside the delimiters
 * is tolerated and the returned names are trimmed.
 *
 * @public
 */
export function extractMergeTokens(template: string): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null = TOKEN_RE.exec(template);
  while (m !== null) {
    const name = m[1];
    if (name !== undefined && !seen.has(name)) {
      seen.add(name);
      order.push(name);
    }
    m = TOKEN_RE.exec(template);
  }
  return order;
}

/**
 * Replace every `{{token}}` in `template` with the matching value
 * from `row`. Tokens with no entry in the row are replaced with the
 * empty string and surfaced via the second return value so the host
 * can warn the user.
 *
 * @public
 */
export function mergeRow(
  template: string,
  row: MergeRow,
): { merged: string; missingTokens: string[] } {
  const missingSet = new Set<string>();
  // `String.prototype.replace` with a `/g` regex doesn't read
  // `lastIndex`, but the same regex is reused by `extractMergeTokens`
  // via `.exec`. Resetting up front decouples call ordering and avoids
  // a class of stateful-regex bugs.
  TOKEN_RE.lastIndex = 0;
  const merged = template.replace(TOKEN_RE, (_match, rawName: string) => {
    const name = rawName.trim();
    const value = row[name];
    if (value === undefined) {
      missingSet.add(name);
      return "";
    }
    return value;
  });
  return { merged, missingTokens: [...missingSet] };
}

/**
 * Validate a row against a template — quick check before kicking
 * off a compose-side merge. Returns the list of `missingTokens` the
 * row lacks and the list of `unusedColumns` (row keys the template
 * doesn't reference).
 *
 * @public
 */
export function validateMergeManifest(template: string, row: MergeRow): MergeValidationResult {
  const tokens = new Set(extractMergeTokens(template));
  const columns = new Set(Object.keys(row));
  const missingTokens: string[] = [];
  const unusedColumns: string[] = [];
  for (const token of tokens) {
    if (!columns.has(token)) missingTokens.push(token);
  }
  for (const column of columns) {
    if (!tokens.has(column)) unusedColumns.push(column);
  }
  return { missingTokens, unusedColumns };
}

/**
 * Merge every row in a variant matrix against a template. Returns
 * one merged string per row, plus a per-row missing-token list so
 * the host can surface a "row N missing tokens X/Y" warning.
 *
 * @public
 */
export function mergeAllRows(
  template: string,
  rows: readonly MergeRow[],
): { merged: string; missingTokens: string[] }[] {
  return rows.map((row) => mergeRow(template, row));
}
