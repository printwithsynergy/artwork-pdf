# artworkPDF — Architecture

## Overview

artworkPDF is a synergy node: standalone-callable over HTTP and orchestratable
by the synergy engine in a `create → lint → trap → step-and-repeat → RIP` workflow.

It sits on top of two shared PWS packages:

- **`pws/compile-pdf`** (Python / FastAPI) — every PDF → PDF transform
  (compose, marks, trap, impose, rewrite). artwork-pdf calls it over
  HTTP via `apps/service/src/compile-pdf-client.ts`.
- **`pws/lens-pdf`** — host-agnostic React PDF viewer used after a
  successful render. artwork-pdf ships two first-party lens plugins
  from `@printwithsynergy/artwork-pdf-editor/lens`: a dieline overlay
  and a preflight-findings panel.

## Monorepo layout

```
artwork-pdf/
  apps/
    service/      Hono API — /jobs orchestrator that calls compile-pdf, plus
                  /healthz, /source, /.well-known/synergy-node.json
    editor/       Next.js 16 host — mounts @printwithsynergy/artwork-pdf-editor at /demo, /upload, /
  packages/
    editor-app/        Publishable React editor (host-customizable TopBar, EditorConfig flag
                       layer). Exports `Page` / `TemplateSet` / lens plugin pack
                       (`/lens` subpath).
    document-model/    TypeScript document schema; emits a JSON Schema at
                       `dist/schema/document-model.schema.json` for cross-language
                       consumers (compile-pdf).
    dieline-parser/    CF2/DDES/ARD structural dieline import
    flexo-distortion/  Flexo distortion compensation
    synergy-client/    Typed HTTP client for @synergy/client
```

`@printwithsynergy/artwork-pdf-editor` is published to npm so any host (the marketing
site, third-party integrations) can mount the editor directly with
their own logo, CTAs, and feature-flag set — no iframe needed. See the
"Embedding the editor" section in the [root README](README.md).

## End-to-end render pipeline

```
   Editor canvas (Konva, in @printwithsynergy/artwork-pdf-editor)
                    │ DocumentModel
                    ▼
   apps/service /jobs (Hono — thin orchestrator)
                    │ HTTP POST per producer
                    ▼
   pws/compile-pdf (FastAPI; PDF → PDF transforms)
     /v1/compose/apply → /v1/marks/apply → /v1/trap/apply → /v1/impose/apply
                    │ uses
                    ▼
   codex-pdf (Python; read-only geometry / color / OCG primitives)
```

Editor view path (after a successful render): `<LensPDF pdfUrl={blobUrl}
plugins={artworkLensPlugins}>` for analysis (separations, TAC heatmap,
layers, color picker, densitometer, annotation), with artwork's own
dieline overlay + preflight findings plugins registered.

## Node contract

artworkPDF is registered in the synergy engine as node type `artwork.*`:

- `artwork.render` — compose artwork layers → PDF/X-4 (orchestrator
  forwards to compile-pdf's producer chain)
- `artwork.thumbnail` — rasterize for preview
- `artwork.preview-separations` — emit per-separation PNGs

Registration is via TypeScript side-effect import in synergy's worker
(`packages/nodes-artwork` in the synergy monorepo).

## HTTP surface

| Method | Path | Description |
|---|---|---|
| POST | /jobs | Submit render/thumbnail/preview job |
| GET | /jobs/:id | Poll job status |
| GET | /jobs/:id/events | SSE stream — job progress |
| GET | /jobs/:id/result | Download result artifact |
| GET | /healthz | Health check |
| GET | /source | AGPL §13 — redirect to source archive |
| GET | /.well-known/synergy-node.json | Node capabilities descriptor |

## AGPL boundary

- artwork-pdf ⊥ platform (artwork-pdf never imports platform)
- platform → artwork-pdf allowed (embed only)
- synergy → artwork-pdf allowed (orchestration)

Enforced by `scripts/check-license-boundary.ts` in CI.

## Stack

- Hono (service), Next.js 15 (editor), react-konva (canvas)
- pdf-lib (PDF composition), Ghostscript (PDF/X-4 + ICC conformance)
- pg-boss (job queue), Drizzle ORM, Postgres (RLS)
- Biome (lint/format), Turbo (build), pnpm workspaces
