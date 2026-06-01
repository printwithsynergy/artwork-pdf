# Comment & Docstring Pass — artwork-pdf

> Status: **complete** (all 9 PRs merged).
>
> Tracker for the per-area docstring pass authorized by
> [`CLAUDE.md` § Comment & docstring policy](../CLAUDE.md#comment--docstring-policy).
> Every exported symbol in `artwork-pdf` carries a TSDoc/JSDoc
> docstring; every non-obvious branch carries a WHY comment.

## Naming note

This pass was originally labeled "Wave 1" in PRs #50-#59, but that
conflicted with the **canonical Wave 1** of the artworkPDF program
sequence (held outside this repo as the planning brief that gates the
broader 42-feature build). Canonical Wave 1 is a 9-feature *feature*
wave — S2 (dieline import wire-up), C3 (spot library), C4 (live TAC),
D1 (background trap preview), D2 (interactive trap editor), G2v
(barcode validate), O1 (impose builder), X2 (history scrubber), AI4
(palette → spot).

The comment pass sits between Wave 0 and the canonical Wave 1 —
foundation work in its own right, but not part of the numbered wave
sequence. The original PR titles ("Wave 1 PR-N") remain in git
history; this doc and `CLAUDE.md` are the durable references and
have been corrected.

## Completed PRs

| # | PR | Area | Scope | Status |
|---|----|------|-------|--------|
| 1 | #50 | _meta_ | `CLAUDE.md` policy + this plan doc | **merged** |
| 2 | #52 | `apps/service/src/` | Hono handlers, routes, pg-boss worker, `CompilePdfClient`, DB client, schema | **merged** |
| 3 | #53 | `packages/document-model/src/` | DocumentModel TS schema (v2 + v3), migration, preflight types | **merged** |
| 4 | #54 | `packages/editor-app/src/` | `EditorApp`, `TopBar`, `MobileToolDrawer`, `EditorConfig`, lens plugin pack, dieline/bleed helpers | **merged** |
| 5 | #55 | `packages/compose/src/` | compose-producer renderer (DocumentV3 → PDF via pdf-lib) | **merged** |
| 6 | #56 | `packages/dieline-parser/src/` | CF2 / DDES / ARD parsers | **merged** |
| 7 | #57 | `packages/flexo-distortion/src/` | flexo distortion compensation math | **merged** |
| 8 | #58 | `packages/synergy-client/src/` | typed HTTP client for the synergy workflow API (`@printwithsynergy/artwork-pdf` package) | **merged** |
| 9 | #59 | `apps/editor/src/` | Next.js host, `MarketingPage`, route handlers | **merged** |

## Per-PR recipe (for future similar passes)

For each area PR:

- [x] Every public-API symbol has a docstring covering: purpose,
      parameters worth naming, return shape, and any non-obvious
      invariant.
- [x] WHY comments added at: external-spec touchpoints (PDF/X-4, ICC,
      ISO TS), AGPL §13 boundaries, pg-boss handler contracts,
      compile-pdf HTTP error semantics, performance trade-offs, and
      schema-version constraints.
- [x] No noise: nothing that restates code, narrates task history, or
      duplicates type signatures verbatim. CLAUDE.md's "Avoid" rules
      apply.
- [x] Scoped typecheck — clean.
- [x] Scoped tests — clean.
- [x] `pnpm -r typecheck` — clean across the whole monorepo
      (no regressions outside the touched area).
- [x] `node scripts/check-license-boundary.mjs` — passes.

### Verification commands per area (reference)

| PR | Scoped typecheck | Scoped tests |
|---|---|---|
| PR-2 (`apps/service`) | `pnpm --filter @artworkpdf/service typecheck` | `pnpm --filter @artworkpdf/service test` |
| PR-3 (`document-model`) | `pnpm --filter @artworkpdf/document-model typecheck` | `pnpm --filter @artworkpdf/document-model test` |
| PR-4 (`editor-app`) | `pnpm --filter @printwithsynergy/artwork-pdf-editor typecheck` | `pnpm --filter @printwithsynergy/artwork-pdf-editor test` |
| PR-5 (`compose`) | `pnpm --filter @artworkpdf/compose typecheck` | `pnpm --filter @artworkpdf/compose test` |
| PR-6 (`dieline-parser`) | `pnpm --filter @artworkpdf/dieline-parser typecheck` | `pnpm --filter @artworkpdf/dieline-parser test` |
| PR-7 (`flexo-distortion`) | `pnpm --filter @artworkpdf/flexo-distortion typecheck` | `pnpm --filter @artworkpdf/flexo-distortion test` |
| PR-8 (`synergy-client`) | `pnpm --filter @printwithsynergy/artwork-pdf typecheck` | `pnpm --filter @printwithsynergy/artwork-pdf test` |
| PR-9 (`apps/editor`) | `pnpm --filter @artworkpdf/editor-host typecheck` | `pnpm --filter @artworkpdf/editor-host test` |

Repo-wide gates:

```bash
pnpm -r typecheck
node scripts/check-license-boundary.mjs
```

## What's next

The canonical wave sequence resumes from the program brief:

- **Wave 0** — foundation. Mostly shipped (PR-A compile-pdf compose
  scaffold; PR-B `document-model` v3 + F1 Separation + F2
  PrintContext; PR-D service → `CompilePdfClient` HTTP pipeline; PR-F
  delete `pdf-writer`). **PR-E is still outstanding** — editor F0
  (palettes) + capabilities layer + `JobSetupPanel` (F2 UI). A
  "Wave 0 PR-E retro" PR will backfill it.
- **Wave 1** (canonical) — 9-feature feature wave (S2 / C3 / C4 / D1
  / D2 / G2v / O1 / X2 / AI4). Triggered by a fresh plan-mode prompt.
  Most depend on Wave 0's compose; D1/D2 also need compile-pdf's trap
  producer extensions (cross-repo).
- **Wave 2** — 9 features (S1 / S3 / S4 / C1 / C5 / P1 / P3 / V2 /
  O2). Parametric dielines, panel-anchored objects, 3D fold preview,
  inks panel, ICC soft proof, process-aware preflight, compliance
  engine, variant matrix, estimate-manifest → MIS via synergy.
- **Wave 3** — 7 features (C2 / P5 / G1 / G2g / G3 / V1 / O3).
  Auto-white/underbase, Braille layout, nutrition generator, barcode
  generate, GS1 Digital Link QR, variable-data merge, streaming
  render. All write new bytes — strictly require a stable compose.
- **Wave 4** — long tail, ~16 features (S5/S6, P2/P4, B1/B2, X1, X3,
  AI1/2/3/5, V3, I1/2/3, M1). Can interleave once started.
- **Post-Wave 4** — full docs sweep across `README.md`,
  `ARCHITECTURE.md`, `SYMBOLS.md`, this doc, plus per-package
  READMEs; reconcile against the final shipped state. Then update
  the `synergy-mcp` repo (cross-repo via curl +
  `$GITHUB_PAT` env var, since the GitHub MCP scope is restricted to
  `artwork-pdf` only).

Each wave runs in its own plan-mode session because the codebase
will drift between waves, and lessons from earlier waves materially
change later designs.
