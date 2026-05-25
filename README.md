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

## AGPL §13 Network Use

If you run artworkPDF as a network service (SaaS), you must make the
complete corresponding source available. The `/source` HTTP route on any
running instance resolves to the source archive for the running commit:
`https://github.com/printwithsynergy/artwork-pdf/archive/<sha>.tar.gz`

A source link also appears in the editor footer.

## License

AGPL-3.0-or-later. Copyright © 2024–2026 Print with Synergy.
