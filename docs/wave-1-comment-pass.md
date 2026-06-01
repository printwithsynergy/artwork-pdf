# Wave 1 — Comment & Docstring Pass

> Status tracker for the per-area docstring pass authorized by
> [`CLAUDE.md` § Comment & docstring policy](../CLAUDE.md#comment--docstring-policy).
>
> **Goal:** every exported symbol in `artwork-pdf` carries a TSDoc/JSDoc
> docstring; every non-obvious branch carries a WHY comment. The policy
> codifies the *what*; this doc tracks the *where* and *when*.

## Order of operations

Each row is one PR. PRs land sequentially (no stacking — main is the
base for each). Per-area scope keeps blast radius small and review
cycles tight; CI/typecheck/test must stay green at every step.

| # | PR | Area | Scope | Status |
|---|----|------|-------|--------|
| 1 | Wave 1 PR-1 | _meta_ | `CLAUDE.md` policy + this plan doc | **in flight** |
| 2 | Wave 1 PR-2 | `apps/service/src/` | Hono handlers, routes, pg-boss worker, `CompilePdfClient`, DB client, schema | queued |
| 3 | Wave 1 PR-3 | `packages/document-model/src/` | DocumentModel TS schema, JSON-Schema emitter | queued |
| 4 | Wave 1 PR-4 | `packages/editor-app/src/` | `EditorApp`, `TopBar`, `MobileToolDrawer`, `EditorConfig`, lens plugin pack, dieline/bleed helpers | queued |
| 5 | Wave 1 PR-5 | `packages/compose/src/` | compose-producer renderer (DocumentV3 → PDF via pdf-lib) | queued |
| 6 | Wave 1 PR-6 | `packages/dieline-parser/src/` | CF2 / DDES / ARD parsers | queued |
| 7 | Wave 1 PR-7 | `packages/flexo-distortion/src/` | flexo distortion compensation math | queued |
| 8 | Wave 1 PR-8 | `packages/synergy-client/src/` | typed HTTP client for `@synergy/client` | queued |
| 9 | Wave 1 PR-9 | `apps/editor/src/` | Next.js host, `MarketingPage`, `EditorCanvas`, route handlers | queued |

## Per-PR checklist

For each area PR:

- [ ] Every exported function/class/type/interface/component has a
      docstring covering: purpose, parameters worth naming, return
      shape, and any non-obvious invariant.
- [ ] WHY comments added at: external-spec touchpoints (PDF/X-4, ICC,
      ISO TS), AGPL §13 boundaries, pg-boss handler contracts,
      compile-pdf HTTP error semantics, performance trade-offs, and
      schema-version constraints.
- [ ] No noise: nothing that restates code, narrates task history, or
      duplicates type signatures verbatim. CLAUDE.md's "Avoid" rules
      apply.
- [ ] `pnpm --filter <pkg> typecheck` — clean.
- [ ] `pnpm --filter <pkg> test` — clean.
- [ ] `pnpm -r typecheck` — still clean across the whole monorepo
      (no regressions outside the touched area).
- [ ] `node scripts/check-license-boundary.mjs` — passes.

## Non-goals

- **No code changes** — comment-pass PRs do not refactor, rename, or
  alter behavior. If a docstring reveals a bug or schema mismatch
  during the pass, file a follow-up; do not fix in the comment PR.
- **No CLAUDE.md edits in area PRs** — the policy lives in PR-1.
  Area PRs only update this tracker (status column).
- **No cross-repo work** — Wave 1 is artwork-pdf only. The synergy
  monorepo and `pws/compile-pdf` get their own waves once Wave 1 is
  done.

## Done criteria

Wave 1 is complete when:

1. All 9 PRs have merged to `main`.
2. The "Status" column on every row reads **merged**.
3. `pnpm -r typecheck` is clean.
4. A spot-check sample of exported symbols (one per package) has a
   docstring matching the policy.

After that, the next wave (cross-repo: synergy + compile-pdf comment
pass, or whatever the user picks next) can begin.
