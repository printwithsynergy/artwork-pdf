# artwork-pdf

artworkPDF

> **Roadmap posture — back-burnered (2026-06-18 strategy pivot).** Per
> [`pdf-rd/STRATEGY_DISCOVERY.md` §3](https://github.com/printwithsynergy/pdf-rd/blob/main/STRATEGY_DISCOVERY.md)
> + [`pdf-rd/docs/PIVOT_PLAN.md`](https://github.com/printwithsynergy/pdf-rd/blob/main/docs/PIVOT_PLAN.md)
> (the decision log), artwork is **no longer a marketed company product**. A
> native editor / document-model is a weak prepress product (vs PACKZ/ArtPro+)
> but the best web-to-print fit, so artwork is **re-homed to the
> private/proprietary operator / web-to-print toolkit** as a storefront design
> surface, with **zero company roadmap priority** — touched only when a paying
> gig pulls it. This reframes the marketing/roadmap posture only; the docstring
> policy and all capability/contract docs below stand, and no shipped work is
> removed. (License changes, if any, are separately gated on the
> copyleft-dependency audit — not part of this posture note.)

## Code Review & Blast-Radius Protocol
- Before edits: run code-review-graph impact tools on changed symbols
- After edits: ensure tests pass before commit
- CodeRabbit reviews PRs automatically; Cursor BugBot provides second opinion
- Never disable the code-review-graph Launch Agent

## Comment & docstring policy

This monorepo intentionally allows comments and docstrings beyond the
default Claude Code "no comments" stance. The reason: artworkPDF is a
multi-package library surface (`@printwithsynergy/artwork-pdf-editor`,
`@artworkpdf/document-model`, the `apps/service` HTTP API, etc.)
consumed by external hosts and orchestrated by the synergy engine — a
documented contract on every public symbol is part of the deliverable,
not noise.

Specifically:

- **Public exports** — every symbol that is part of a package's public
  API surface should carry a TSDoc/JSDoc docstring describing what it
  does, what it returns, and any non-obvious invariants. One short
  paragraph is the target; multi-paragraph is fine when the contract
  warrants it (HTTP shape, schema-version constraints, AGPL boundary,
  PDF/X-4 conformance notes, etc.).

  **What counts as "public":** anything re-exported through a
  package's barrel — `src/index.ts` (or any path listed in
  `package.json`'s `exports` field, e.g. `./lens` for
  `@printwithsynergy/artwork-pdf-editor`). Symbols whose only consumer
  is another file inside the same package (intra-package `export` used
  for module composition only) are *not* public API and don't need
  docstrings — they're treated like file-scoped helpers. If unsure,
  check: would removing this from the barrel break a downstream
  consumer? If yes, it's public.
- **Non-obvious WHY** — inline comments are encouraged anywhere the
  *reason* for the code is not self-evident from the names:
  workarounds, performance trade-offs, references to external specs
  (PDF/X-4, ICC, ISO TS), AGPL §13 boundary notes, pg-boss handler
  contracts, compile-pdf HTTP error semantics.
- **Avoid** comments that restate the code, narrate task history
  ("added for X", "used by Y"), reference removed code, or duplicate
  type signatures verbatim.

This policy was rolled out as a per-area pass across `artwork-pdf` —
see the archived [`comment-pass.md`](https://github.com/printwithsynergy/pdf-rd/blob/main/archive/artwork-pdf/docs/comment-pass.md)
(in the `pdf-rd` repo) for the completed tracker and the per-PR recipe
(kept as a reference for future similar passes). Future edits should
preserve the policy.
