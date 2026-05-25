# @artworkpdf/editor-host

Next.js 16 host for [`@artworkpdf/editor-app`](../../packages/editor-app/).
Deployed to `app.artworkpdf.com`. The editor itself lives in the
package; this app only owns the routes and the Next-specific glue.

## Routes

| Path        | Mounts                                                                  |
|-------------|-------------------------------------------------------------------------|
| `/`         | `MarketingPage` (homepage)                                              |
| `/demo`     | `<EditorApp demo initialPhase="editor" ...>` seeded from `?dieline=`    |
| `/upload`   | `<EditorApp>` (full preflight + service-backed export)                  |

### `/demo` URL params

- `?dieline=<id>` — preloads a specific dieline template. Unknown ids
  silently fall back to `isDefault: true`. Valid ids:
  `standup-pouch-4x6`, `standup-pouch-5x8`, `flat-pouch-3x5`,
  `flat-pouch-4x7`, `bottle-label-2in`, `bottle-label-3in`,
  `carton-6x4x2`, `carton-8x6x3`, `sachet-2x3`.
- `?bleed=<value>` — overrides the default 0.125 in bleed. Accepts
  `"0.125in"`, `"3mm"`, or a bare number (mm).

## Mobile breakpoint

Below 768 px CSS width, the toolbar collapses into a left-anchored
slide-in drawer behind a hamburger button in the top bar. The
basic/pro `ModeToggle` lives inside the drawer's "Mode" section.

## Develop

```sh
pnpm install
pnpm --filter @artworkpdf/editor-host dev
# http://localhost:3000
```

The host imports from `@artworkpdf/editor-app` via the workspace link;
Next's `transpilePackages` config (`next.config.ts`) transpiles the
TypeScript source on the fly. No package build step needed in dev.
