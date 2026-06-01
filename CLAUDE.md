# artwork-pdf

artworkPDF

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

- **Public exports** — every exported function, class, type, interface,
  and React component should carry a TSDoc/JSDoc docstring describing
  what it does, what it returns, and any non-obvious invariants. One
  short paragraph is the target; multi-paragraph is fine when the
  contract warrants it (HTTP shape, schema-version constraints, AGPL
  boundary, PDF/X-4 conformance notes, etc.).
- **Non-obvious WHY** — inline comments are encouraged anywhere the
  *reason* for the code is not self-evident from the names:
  workarounds, performance trade-offs, references to external specs
  (PDF/X-4, ICC, ISO TS), AGPL §13 boundary notes, pg-boss handler
  contracts, compile-pdf HTTP error semantics.
- **Avoid** comments that restate the code, narrate task history
  ("added for X", "used by Y"), reference removed code, or duplicate
  type signatures verbatim.

This policy is enforced as part of Wave 1 of the comment-pass effort —
see [`docs/wave-1-comment-pass.md`](docs/wave-1-comment-pass.md) for
the per-area schedule and progress tracker. Future edits should
preserve it.
