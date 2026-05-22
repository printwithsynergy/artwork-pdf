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

## AGPL §13 Network Use

If you run artworkPDF as a network service (SaaS), you must make the
complete corresponding source available. The `/source` HTTP route on any
running instance resolves to the source archive for the running commit:
`https://github.com/printwithsynergy/artwork-pdf/archive/<sha>.tar.gz`

A source link also appears in the editor footer.

## License

AGPL-3.0-or-later. Copyright © 2024–2026 Print with Synergy.
