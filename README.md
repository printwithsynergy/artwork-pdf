# artworkPDF

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Node: >=22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)

WYSIWYG label & packaging artwork editor for the Print With Synergy stack. Full flexo support: spot/Pantone, white/varnish/dieline/technical separations, flexo distortion compensation, variable data, structural dielines (CF2/DDES/ARD). PDF/X-4 output via pdf-lib + Ghostscript.

Workflow: **create → lint → trap → step-and-repeat → RIP**

Self-hostable OSS engine. Hosted at [artworkpdf.com](https://artworkpdf.com).

## Quick start (Docker)

```bash
docker compose up -d
curl http://localhost:3001/healthz
```

## Quick start (Node)

```bash
pnpm install
pnpm build
DATABASE_URL=postgresql://user:pass@localhost/artworkpdf pnpm --filter @artworkpdf/service start
```

## Submit a render job

```bash
curl -X POST http://localhost:3001/jobs \
  -H 'Content-Type: application/json' \
  -d '{"document":{"layers":[]},"output":{"format":"pdf-x4"}}'
```

## Auth

The data routes — `/jobs`, `/assets`, `/preflight-rules` — support **optional
bearer-token auth**, gated by the `ARTWORK_SERVICE_TOKEN` env var:

- **unset** (default) — routes are open. Suitable when the service only sits
  behind a trusted gateway (e.g. synergy) on a private network. A single
  startup warning is logged so the open posture is visible.
- **set** — every data-route request must send `Authorization: Bearer <token>`
  matching it (constant-time compare); anything else gets `401`.

```bash
export ARTWORK_SERVICE_TOKEN=$(openssl rand -hex 32)
curl -X POST http://localhost:3001/jobs \
  -H "Authorization: Bearer $ARTWORK_SERVICE_TOKEN" \
  -H 'Content-Type: application/json' -d '{ ... }'
```

`/healthz`, `/source` (AGPL source offer), and `/.well-known/synergy-node.json`
are always public.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md).

## Embedding the editor

The WYSIWYG canvas ships as a host-customizable React package
[`@printwithsynergy/artwork-pdf-editor`](packages/editor-app/) so other apps (Next.js
routes, Astro pages, Remix, plain React) can mount it without an
iframe:

```tsx
import {
  EditorApp,
  getDefaultTemplate,
  templateToInitialState,
} from "@printwithsynergy/artwork-pdf-editor";

const { objects, pageSize } = templateToInitialState(getDefaultTemplate());

<EditorApp
  demo
  initialPhase="editor"
  initialObjects={objects}
  initialPageSize={pageSize}
  bleedMm={3.175}                                  // 0.125 in
  config={{ enable_separations_panel: false }}     // disable any feature
  topBar={{
    logo: <img src="/my-logo.svg" alt="Acme" />,
    extraButtons: [{ label: "← Back", href: "/" }],
  }}
/>
```

Full prop reference: [`packages/editor-app/src/lib/editor-config.ts`](packages/editor-app/src/lib/editor-config.ts)
and [`packages/editor-app/src/components/TopBar.tsx`](packages/editor-app/src/components/TopBar.tsx).

Hosts without a backend (offline editors, marketing demos) import
`NO_BACKEND_DEFAULTS` to disable every panel that needs a host
adapter — PANTONE search, AI generators, lint findings, etc. — so
the visible surface only includes panels that work in-browser. The
artworkpdf.com demo is a stock install of this preset; see
[`packages/editor-app/README.md`](packages/editor-app/README.md#hosts-without-a-backend-marketing-demos-offline-editors).

## AGPL §13 Network Use

If you run artworkPDF as a network service (SaaS), you must make the
complete corresponding source available. The `/source` HTTP route on any
running instance resolves to the source archive for the running commit:
`https://github.com/printwithsynergy/artwork-pdf/archive/<sha>.tar.gz`

A source link also appears in the editor footer.

## License

AGPL-3.0-or-later. Copyright © 2024–2026 Print with Synergy.
