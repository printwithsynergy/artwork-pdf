# @printwithsynergy/artwork-pdf-editor

Host-customizable React editor for [artworkPDF](https://artworkpdf.com).
Drop into any React 19 host (Next.js, Astro `client:only`, Remix, plain
React) to give users a WYSIWYG packaging-artwork canvas with dieline
templates, bleed visualization, and PDF export. AGPL-3.0-or-later.

## Install

```sh
pnpm add @printwithsynergy/artwork-pdf-editor react react-dom react-konva konva
```

Peers: `react@^19`, `react-dom@^19`, `react-konva@^19`, `konva@^10`.
`pdf-lib` is a regular dependency — it comes along automatically and
powers the demo-mode client-side export.

## Quick start

```tsx
import {
  EditorApp,
  getDefaultTemplate,
  templateToInitialState,
} from "@printwithsynergy/artwork-pdf-editor";

const { objects, pageSize } = templateToInitialState(getDefaultTemplate());

export default function Page() {
  return (
    <EditorApp
      demo
      initialPhase="editor"
      initialObjects={objects}
      initialPageSize={pageSize}
    />
  );
}
```

In Astro with `output: "static"`, mount under `client:only="react"` and
seed initial state inside a `useEffect` (server has no `window`).

## Customizing the top bar

The editor's top bar is the only host-customizable chrome. Pass any
`logo` ReactNode (`null` to hide), wordmark text, and extra CTAs:

```tsx
<EditorApp
  topBar={{
    logo: <img src="/acme-logo.svg" alt="Acme" height={24} />,
    brandText: "Acme Designer",
    extraButtons: [
      { label: "Features", href: "/features" },
      { label: "Sign up", href: "/signup", primary: true },
    ],
  }}
/>
```

The hamburger button is always rendered at the leftmost position on
mobile so muscle memory is consistent across hosts.

## Feature flags (`EditorConfig`)

Disable any feature globally, per mode (basic/pro), or per instance.
Defaults to everything enabled.

```tsx
<EditorApp
  config={{
    enable_layers_panel: false,
    enable_source_link: false,
  }}
/>
```

Resolution order: `DEFAULT_EDITOR_CONFIG` → `{BASIC,PRO}_MODE_OVERRIDES`
→ instance overrides. The full flag list is in
[`src/lib/editor-config.ts`](src/lib/editor-config.ts).

### Stock right-rail panels

The editor mounts a `RightRailAccordion` next to the canvas on desktop
that surfaces every Wave 1–4 panel that works without a host-supplied
adapter: Job setup, dieline parameters, trap editor, impose builder,
fold editor, variant matrix, localization, nutrition facts, GS1
digital link, Braille layout, white underbase, streaming render.
Each section is gated by its own `enable_<feature>` flag, so the
existing config surface continues to control visibility.

### Hosts without a backend (marketing demos, offline editors)

Backend-dependent panels (PANTONE search, separations extraction, AI
generators, OCR, ICC soft proof, DAM / PIM / ecommerce, lint findings,
notifications) need host-supplied adapters. Hosts that don't wire them
import the `NO_BACKEND_DEFAULTS` preset and merge it into the config:

```tsx
import {
  EditorApp,
  DEFAULT_EDITOR_CONFIG,
  NO_BACKEND_DEFAULTS,
} from "@printwithsynergy/artwork-pdf-editor";

<EditorApp
  demo
  preferMode="pro"
  config={{ ...DEFAULT_EDITOR_CONFIG, ...NO_BACKEND_DEFAULTS }}
/>
```

The marketing demo at artworkpdf.com is a stock install of this
exact mount — every panel that's clickable in the live demo works
purely in-browser.

## Embeddable editor — host-injected services + capability self-hide

`EmbeddableEditor` is the drop-in entry point modeled on lens-pdf's
host-injection story. The **host injects services**; the library never
hardcodes a backend route. Any tool whose backing service isn't wired
**self-hides** — no broken buttons, no dead panels.

```tsx
import { EmbeddableEditor } from "@printwithsynergy/artwork-pdf-editor";

<EmbeddableEditor
  initialPhase="editor"
  services={{
    // Wire only what your backend supports; the rest self-hide.
    preflightRules: { getRules: () => myClient.preflightRules() },
    spotSearch:     { search:   (o) => myClient.spotSearch(o) },
    // ai / separations / notifications / telemetry omitted → those
    // tools (AI panels, inks palette, notify panels) self-hide.
  }}
/>;
```

`EditorServices` is the protocol family (`PreflightRulesService`,
`SpotSearchService`, `SeparationsService`, `AiAssistService`,
`NotificationService`, `TelemetryService`). Each is optional; omitted
services fall through to an unwired no-op stub. With `autoHideUnwired`
(default `true`), each unwired service flips its tools'
`EditorConfig.capabilities` flag off, so they hide through the same
four-gate `showFeature` path the config layer already uses. A host that
knows a tool works can re-enable it via `config.capabilities`.

Lower-level seam (for hosts composing their own chrome):

- `EditorServicesProvider` — wrap any subtree to inject services.
- `useEditorService(name)` / `useEditorServices()` — read injected services.
- `useServiceFallbackMode(service, feature?)` — resolve a tool's mode
  (`"wired" | "fallback" | "hidden"`); the pure
  `resolveServiceFallbackMode(...)` backs it for non-React callers.
- `isServiceUnwired(svc)` / `markServiceUnwired(svc)` — the
  wired/unwired marker.

**Compile boundary:** services carry *intent* (what the user wants).
The editor never becomes a policy producer — pass/fail verdicts stay in
lint-pdf and deterministic PDF writes stay in compile-pdf.

`usePreflight` reads the injected `preflightRules` service first; when
no service is wired it keeps its legacy `NEXT_PUBLIC_SERVICE_URL` fetch
so existing mounts are unchanged.

## Bleed

Bleed defaults to industry-standard 0.125 in (3.175 mm). Override per
mount or via URL on a hosted route:

```tsx
<EditorApp bleedMm={5} />
```

```
/demo?bleed=0.25in
/demo?bleed=3mm
/demo?bleed=3.175
```

`parseBleed()` is exported for hosts that need to map their own URL
contract.

## Dieline deep-links

Templates live in [`src/data/dielines.json`](src/data/dielines.json).
Each has a stable `id`; one is flagged `isDefault: true`.

```tsx
import { getTemplateById } from "@printwithsynergy/artwork-pdf-editor";
const tpl = getTemplateById("standup-pouch-4x6");
```

Hosted routes can deep-link with `?dieline=<id>`. The demo route also
accepts:

- A bundled multi-page set id (`?dieline=carton-6x4x2-set`) — see
  `TEMPLATE_SETS`.
- A comma-separated list of template ids
  (`?dieline=carton-6x4x2,carton-6x4x2`).

Unknown ids silently fall back to the default template.

## Multi-page documents

Each page in a multi-page artwork carries its own `objects`, `pageSize`,
`bleedMm`, and optional `templateId` + `name`. Seed via `initialPages`:

```tsx
import {
  EditorApp,
  getTemplateSetById,
  templateSetToPages,
} from "@printwithsynergy/artwork-pdf-editor";

const set = getTemplateSetById("carton-6x4x2-set");
const pages = templateSetToPages(set!, 3.175); // 0.125 in bleed

<EditorApp demo initialPhase="editor" initialPages={pages} />
```

Helpers:

- `templateToPage(template, bleedMm?, name?)` — single template → Page.
- `templatesToPages([{ template, name }], bleedMm?)` — ordered ad-hoc
  set → Page[].
- `templateSetToPages(set, bleedMm?)` — bundled set → Page[].

A `PageNavigator` strip renders above the canvas on desktop and a
"Pages" section appears in the mobile drawer. Users can switch
between pages, add (duplicate) pages, and delete pages. Per-page state
is preserved across switches; each page has its own undo history.

## Lens plugins (`/lens` subpath)

Hosts that mount [`@printwithsynergy/lens-pdf`](https://www.npmjs.com/package/@printwithsynergy/lens-pdf)
to display rendered output can register artwork-aware overlays:

```tsx
import { LensPDF } from "@printwithsynergy/lens-pdf";
import {
  dielineOverlayPlugin,
  preflightFindingsPlugin,
} from "@printwithsynergy/artwork-pdf-editor/lens";

<LensPDF
  pdfUrl={blobUrl}
  plugins={[
    dielineOverlayPlugin({ pages: { 1: { template: tpl, bleedMm: 3.175 } } }),
    preflightFindingsPlugin({ report }),
  ]}
/>
```

`@printwithsynergy/lens-pdf` is an **optional** peer dep — only required
when you import from the `/lens` subpath.

## License

AGPL-3.0-or-later. Source:
<https://github.com/printwithsynergy/artwork-pdf>.
