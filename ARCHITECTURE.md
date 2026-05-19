# artworkPDF — Architecture

## Overview

artworkPDF is a synergy node: standalone-callable over HTTP and orchestratable
by the synergy engine in a `create → lint → trap → step-and-repeat → RIP` workflow.

## Monorepo layout

```
artwork-pdf/
  apps/
    service/      Hono API — /jobs, SSE, /healthz, /source, /.well-known/synergy-node.json
    editor/       Next.js 15 — react-konva WYSIWYG editor
  packages/
    document-model/    TypeScript document schema
    pdf-writer/        pdf-lib + Ghostscript PDF/X-4 composer
    dieline-parser/    CF2/DDES/ARD structural dieline import
    flexo-distortion/  Flexo distortion compensation
    synergy-client/    Typed HTTP client for @synergy/client
```

## Node contract

artworkPDF is registered in the synergy engine as node type `artwork.*`:

- `artwork.render` — compose artwork layers → PDF/X-4 (via pdf-lib + Ghostscript)
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
