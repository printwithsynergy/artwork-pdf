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
    enable_separations_panel: false,
    enable_layers_panel: false,
    enable_source_link: false,
  }}
/>
```

Resolution order: `DEFAULT_EDITOR_CONFIG` → `{BASIC,PRO}_MODE_OVERRIDES`
→ instance overrides. The full flag list is in
[`src/lib/editor-config.ts`](src/lib/editor-config.ts).

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

Hosted routes can deep-link with `?dieline=<id>`.

## License

AGPL-3.0-or-later. Source:
<https://github.com/printwithsynergy/artwork-pdf>.
