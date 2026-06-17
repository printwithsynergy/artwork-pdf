// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Deterministic document-correction engine.
//
// This is the pure core behind the headless `POST /v1/correct` edit API
// (apps/service) that synergy drives to apply deterministic corrections
// to an artwork document. It is the **intent** half of the artwork ↔
// compile boundary: corrections mutate the {@link DocumentV3} authoring
// model (set bleed, normalize an ink name, force black overprint, hide a
// layer, …). It never writes a PDF and never makes a pass/fail policy
// verdict — those stay in compile-pdf (the only writer) and lint-pdf
// (rules/reporting) respectively.
//
// Determinism contract (load-bearing for synergy job caching):
//   - `applyCorrections` is pure: same `(document, operations)` in →
//     byte-identical `{ document, applied, contentHash }` out, with no
//     wall-clock / RNG / ambient-env reads.
//   - `contentHash` is a content address over a canonical (sorted-key)
//     JSON encoding of the corrected document, so two structurally-equal
//     documents hash identically regardless of key insertion order.
//   - Operations apply in array order; the result is the left fold of
//     each op over the document. Order is significant and preserved.
//
// Package-boundary note: `@artworkpdf/document-model`'s `src/` is
// deliberately runtime-free (it emits JSON Schema for cross-language
// consumers and must compile without `@types/node`). So the hash
// function is *injected* — the caller passes a `sha256` digest fn
// (apps/service supplies `node:crypto`'s). The default hasher is a
// dependency-free, deterministic non-cryptographic digest so the engine
// stays usable standalone; production callers inject SHA-256.

import type { Separation } from "./extended.js";
import { ensureV3 } from "./migrate.js";
import type { DocumentModel } from "./extended.js";
import type { DocumentV3, PageV3 } from "./v3.js";

/**
 * Stable identifier for the correction-operation vocabulary. Bumped
 * (semver-minor for additive ops, major for a breaking op-shape change)
 * so a synergy node pinning a version can detect drift. Surfaced on the
 * `/v1/contract` descriptor and the correction response.
 *
 * @public
 */
export const CORRECTION_SCHEMA_VERSION = "1.0.0";

/**
 * One deterministic correction operation.
 *
 * A discriminated union on `op`. Each variant is an explicit, narrowly
 * scoped *intent* edit — there is intentionally no free-form "patch any
 * field" escape hatch, so every correction synergy can drive is named,
 * validated, and auditable. Extend the union additively (and bump
 * {@link CORRECTION_SCHEMA_VERSION}) when a new correction is needed.
 *
 * `pageId` selects the target page by {@link PageV3.id}; when omitted on
 * a page-scoped op the correction applies to **every** page (a document-
 * wide normalization). Separation ops match by case-sensitive `name`.
 *
 * @public
 */
export type CorrectionOp =
  | {
      /** Set the bleed (mm) on the target page(s). */
      op: "set.page.bleed";
      pageId?: string;
      bleedMm: number;
    }
  | {
      /** Toggle a layer's visibility on the target page(s). */
      op: "set.layer.visibility";
      pageId?: string;
      layerId: string;
      visible: boolean;
    }
  | {
      /** Lock / unlock a layer on the target page(s). */
      op: "set.layer.locked";
      pageId?: string;
      layerId: string;
      locked: boolean;
    }
  | {
      /** Force overprint on/off for a named separation on the target page(s). */
      op: "set.separation.overprint";
      pageId?: string;
      separation: string;
      overprint: boolean;
    }
  | {
      /** Force knockout on/off for a named separation on the target page(s). */
      op: "set.separation.knockout";
      pageId?: string;
      separation: string;
      knockout: boolean;
    }
  | {
      /** Rename a separation across the target page(s) (ink-name normalization). */
      op: "rename.separation";
      pageId?: string;
      from: string;
      to: string;
    }
  | {
      /** Remove a named separation from the target page(s) (drop a stray ink). */
      op: "remove.separation";
      pageId?: string;
      separation: string;
    }
  | {
      /** Set the document-level print-context color profile name. */
      op: "set.print.colorProfile";
      colorProfile: string;
    };

/**
 * The `op` discriminator values, as a runtime set — used by the route's
 * request validator and by tests to assert the vocabulary stays in sync
 * with the {@link CorrectionOp} union.
 *
 * @public
 */
export const CORRECTION_OPS = [
  "set.page.bleed",
  "set.layer.visibility",
  "set.layer.locked",
  "set.separation.overprint",
  "set.separation.knockout",
  "rename.separation",
  "remove.separation",
  "set.print.colorProfile",
] as const;

/** A correction `op` discriminator value. @public */
export type CorrectionOpName = (typeof CORRECTION_OPS)[number];

/**
 * Machine-readable failure code for a rejected correction request.
 *
 * - `invalid_operation` — the op shape is malformed (unknown `op`,
 *   missing/ill-typed field, out-of-range value).
 * - `target_not_found` — the op is well-formed but its target (page,
 *   layer, or separation) does not exist in the document.
 * - `conflict` — the op cannot apply against the current state (e.g. a
 *   rename whose destination name already exists on the page).
 * - `invalid_document` — the supplied document failed schema coercion.
 *
 * @public
 */
export type CorrectionErrorCode =
  | "invalid_operation"
  | "target_not_found"
  | "conflict"
  | "invalid_document";

/**
 * Error thrown by {@link applyCorrections} when an operation is invalid
 * or its target is missing. Carries a stable {@link CorrectionErrorCode}
 * and a `pointer` (the 0-based index of the failing op in the request,
 * formatted as `operations/<i>`) so a caller — or the HTTP route's RFC
 * 7807 mapping — can report exactly which correction failed and why.
 *
 * @public
 */
export class CorrectionError extends Error {
  constructor(
    readonly code: CorrectionErrorCode,
    message: string,
    /** JSON-pointer-style path to the failing op (e.g. `operations/2`). */
    readonly pointer: string,
  ) {
    super(message);
    this.name = "CorrectionError";
  }
}

/**
 * Per-operation outcome record. One entry per input op, in order, so a
 * caller can audit exactly what each correction did. `changed` is `false`
 * when the op was a no-op against the current state (e.g. setting bleed
 * to its existing value, or hiding an already-hidden layer) — a no-op is
 * **not** an error; idempotent re-application is a first-class case for a
 * deterministic correction node.
 *
 * @public
 */
export type CorrectionApplied = {
  op: CorrectionOpName;
  /** Whether the op mutated the document (false = idempotent no-op). */
  changed: boolean;
  /** Number of discrete sites mutated (pages/layers/separations touched). */
  sites: number;
};

/**
 * A digest function: maps a canonical JSON string to a hex digest. Inject
 * a real SHA-256 (apps/service passes `node:crypto`'s) to get a
 * cryptographic content address; the {@link applyCorrections} default is a
 * dependency-free non-cryptographic fallback so the engine stays
 * standalone-usable.
 *
 * @public
 */
export type Sha256Fn = (input: string) => string;

/**
 * Options for {@link applyCorrections}.
 *
 * @public
 */
export type ApplyCorrectionsOptions = {
  /**
   * Hex-digest function used to build `contentHash`. Defaults to a
   * deterministic non-cryptographic digest; production callers inject a
   * real SHA-256 so the address is collision-resistant.
   */
  sha256?: Sha256Fn;
};

/**
 * Result of {@link applyCorrections}.
 *
 * `document` is always a {@link DocumentV3} (v2 input is lifted via
 * {@link ensureV3} first) — corrections target the canonical pages-first
 * shape. `applied` mirrors `operations` element-for-element.
 *
 * `contentHash` is the deterministic content address of `document`
 * (`<algo>:<hexdigest>`); `canonicalJson` is the exact byte string that
 * was hashed, so a caller can re-hash with a different algorithm without
 * re-deriving the canonical encoding.
 *
 * @public
 */
export type CorrectionResult = {
  document: DocumentV3;
  applied: CorrectionApplied[];
  /** `<algo>:<hexdigest>` content address of the corrected document. */
  contentHash: string;
  /** The canonical (sorted-key) JSON string that `contentHash` digests. */
  canonicalJson: string;
  schemaVersion: string;
};

/**
 * Apply an ordered list of deterministic corrections to a document.
 *
 * The input may be v2 or v3 — it is lifted to {@link DocumentV3} via
 * {@link ensureV3} before any op runs. The function is pure and never
 * mutates its `document` argument: it deep-clones once up front and folds
 * each op over the clone.
 *
 * Throws {@link CorrectionError} on the first invalid op (fail-fast, so a
 * partially-applied document is never returned). A valid op that matches
 * nothing because the document already satisfies it is a no-op, recorded
 * with `changed: false` — not an error.
 *
 * @param document the document to correct (v2 or v3)
 * @param operations the ordered corrections to apply
 * @param options inject a `sha256` digest fn for a cryptographic
 *        `contentHash` (default: a non-cryptographic deterministic digest)
 * @returns the corrected v3 document, a per-op audit trail, the canonical
 *          JSON, and the deterministic content hash
 * @throws {CorrectionError} when an operation is malformed, targets a
 *         missing page/layer/separation, or conflicts with current state
 * @public
 */
export function applyCorrections(
  document: DocumentModel | DocumentV3,
  operations: readonly CorrectionOp[],
  options: ApplyCorrectionsOptions = {},
): CorrectionResult {
  // Lift to v3, then deep-clone so the caller's object is never touched.
  // structuredClone is available on Node 22 (the engine's runtime floor).
  // Wrap schema/coercion failures as a structured `invalid_document` so the
  // HTTP boundary surfaces a 422 with a `code`, not a generic 500.
  let doc: DocumentV3;
  try {
    doc = structuredClone(ensureV3(document));
  } catch (err) {
    throw new CorrectionError(
      "invalid_document",
      err instanceof Error ? err.message : "document failed schema coercion",
      "document",
    );
  }

  const applied: CorrectionApplied[] = [];
  operations.forEach((rawOp, i) => {
    applied.push(applyOne(doc, rawOp, `operations/${i}`));
  });

  const canonical = canonicalJson(doc);
  return {
    document: doc,
    applied,
    contentHash: hashCanonical(canonical, options.sha256),
    canonicalJson: canonical,
    schemaVersion: CORRECTION_SCHEMA_VERSION,
  };
}

/**
 * Resolve the set of pages an op targets: a single page when `pageId` is
 * given (404 if it does not exist), else every page.
 */
function targetPages(doc: DocumentV3, pageId: string | undefined, pointer: string): PageV3[] {
  if (pageId === undefined) return doc.pages;
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) {
    throw new CorrectionError("target_not_found", `page "${pageId}" not found`, pointer);
  }
  return [page];
}

/** Apply one validated op in place; return its audit record. */
function applyOne(doc: DocumentV3, op: CorrectionOp, pointer: string): CorrectionApplied {
  switch (op.op) {
    case "set.page.bleed": {
      requireFiniteNumber(op.bleedMm, "bleedMm", pointer);
      if (op.bleedMm < 0) {
        throw new CorrectionError("invalid_operation", "bleedMm must be >= 0", pointer);
      }
      let sites = 0;
      for (const page of targetPages(doc, op.pageId, pointer)) {
        if (page.bleedMm !== op.bleedMm) {
          page.bleedMm = op.bleedMm;
          sites++;
        }
      }
      return { op: op.op, changed: sites > 0, sites };
    }

    case "set.layer.visibility":
    case "set.layer.locked": {
      requireNonEmptyString(op.layerId, "layerId", pointer);
      const wantVisible = op.op === "set.layer.visibility";
      const value = wantVisible ? op.visible : op.locked;
      requireBoolean(value, wantVisible ? "visible" : "locked", pointer);
      let sites = 0;
      let foundAnywhere = false;
      for (const page of targetPages(doc, op.pageId, pointer)) {
        const layer = page.layers.find((l) => l.id === op.layerId);
        if (!layer) continue;
        foundAnywhere = true;
        if (wantVisible) {
          if (layer.visible !== value) {
            layer.visible = value;
            sites++;
          }
        } else if ((layer.locked ?? false) !== value) {
          layer.locked = value;
          sites++;
        }
      }
      if (!foundAnywhere) {
        throw new CorrectionError("target_not_found", `layer "${op.layerId}" not found`, pointer);
      }
      return { op: op.op, changed: sites > 0, sites };
    }

    case "set.separation.overprint":
    case "set.separation.knockout": {
      requireNonEmptyString(op.separation, "separation", pointer);
      const isOverprint = op.op === "set.separation.overprint";
      const value = isOverprint ? op.overprint : op.knockout;
      requireBoolean(value, isOverprint ? "overprint" : "knockout", pointer);
      let sites = 0;
      let foundAnywhere = false;
      for (const page of targetPages(doc, op.pageId, pointer)) {
        for (const sep of page.separations) {
          if (sep.name !== op.separation) continue;
          foundAnywhere = true;
          if (isOverprint) {
            if ((sep.overprint ?? false) !== value) {
              sep.overprint = value;
              sites++;
            }
          } else if ((sep.knockout ?? false) !== value) {
            sep.knockout = value;
            sites++;
          }
        }
      }
      if (!foundAnywhere) {
        throw new CorrectionError(
          "target_not_found",
          `separation "${op.separation}" not found`,
          pointer,
        );
      }
      return { op: op.op, changed: sites > 0, sites };
    }

    case "rename.separation": {
      requireNonEmptyString(op.from, "from", pointer);
      requireNonEmptyString(op.to, "to", pointer);
      let sites = 0;
      let foundAnywhere = false;
      for (const page of targetPages(doc, op.pageId, pointer)) {
        const source = page.separations.find((s) => s.name === op.from);
        if (!source) continue;
        foundAnywhere = true;
        // A rename onto an existing distinct ink would silently merge two
        // colorants — reject as a conflict rather than corrupt the page.
        if (op.from !== op.to && page.separations.some((s) => s.name === op.to)) {
          throw new CorrectionError(
            "conflict",
            `separation "${op.to}" already exists on page "${page.id}"`,
            pointer,
          );
        }
        if (source.name !== op.to) {
          renameSeparationOnPage(page, op.from, op.to);
          sites++;
        }
      }
      if (!foundAnywhere) {
        throw new CorrectionError("target_not_found", `separation "${op.from}" not found`, pointer);
      }
      return { op: op.op, changed: sites > 0, sites };
    }

    case "remove.separation": {
      requireNonEmptyString(op.separation, "separation", pointer);
      let sites = 0;
      let foundAnywhere = false;
      for (const page of targetPages(doc, op.pageId, pointer)) {
        const before = page.separations.length;
        page.separations = page.separations.filter((s) => s.name !== op.separation);
        if (page.separations.length !== before) {
          foundAnywhere = true;
          sites++;
        }
      }
      if (!foundAnywhere) {
        throw new CorrectionError(
          "target_not_found",
          `separation "${op.separation}" not found`,
          pointer,
        );
      }
      return { op: op.op, changed: sites > 0, sites };
    }

    case "set.print.colorProfile": {
      requireNonEmptyString(op.colorProfile, "colorProfile", pointer);
      const ctx = doc.printContext;
      const changed = ctx?.colorProfile !== op.colorProfile;
      if (ctx) {
        ctx.colorProfile = op.colorProfile;
      } else {
        // No print context yet — seed a minimal one carrying only the
        // profile. process/substrate stay at the renderer defaults
        // (this op expresses *only* the color-profile intent).
        doc.printContext = {
          process: "offset",
          substrate: { id: "", color: "#ffffff", opacity: 1, finish: "matte" },
          colorProfile: op.colorProfile,
        };
      }
      return { op: op.op, changed, sites: changed ? 1 : 0 };
    }

    default: {
      // Exhaustiveness guard: an unknown `op` (e.g. from an untyped JSON
      // body) lands here. The route validates `op` against CORRECTION_OPS
      // before calling, but defend in depth.
      const unknown = (op as { op?: unknown }).op;
      throw new CorrectionError(
        "invalid_operation",
        `unknown correction op: ${JSON.stringify(unknown)}`,
        pointer,
      );
    }
  }
}

/**
 * Rename a separation on a page, keeping the {@link Separation.name} and
 * any layer whose `separation` mirror references the same ink in sync.
 */
function renameSeparationOnPage(page: PageV3, from: string, to: string): void {
  for (const sep of page.separations) {
    if (sep.name === from) sep.name = to;
  }
  for (const layer of page.layers) {
    if (layer.separation?.name === from) {
      layer.separation = { ...layer.separation, name: to } satisfies Separation;
    }
  }
}

// ---------------------------------------------------------------------------
// Field validators — throw `invalid_operation` with the field path on a
// malformed value so the route's RFC 7807 mapping has a precise pointer.
// ---------------------------------------------------------------------------

function requireFiniteNumber(
  value: unknown,
  field: string,
  pointer: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CorrectionError(
      "invalid_operation",
      `${field} must be a finite number`,
      `${pointer}/${field}`,
    );
  }
}

function requireBoolean(value: unknown, field: string, pointer: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new CorrectionError(
      "invalid_operation",
      `${field} must be a boolean`,
      `${pointer}/${field}`,
    );
  }
}

function requireNonEmptyString(
  value: unknown,
  field: string,
  pointer: string,
): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new CorrectionError(
      "invalid_operation",
      `${field} must be a non-empty string`,
      `${pointer}/${field}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Deterministic content hashing
// ---------------------------------------------------------------------------

/**
 * Deterministic content address of a document.
 *
 * Canonicalizes the document (object keys sorted recursively) then digests
 * it with the injected `sha256` (or the non-cryptographic default). Two
 * structurally-equal documents that differ only in key insertion order
 * hash identically — this is the value a synergy correction node keys its
 * cache on, so identical `(document, operations)` always yields the same
 * address.
 *
 * @param doc the document to address
 * @param sha256 optional hex-digest fn (inject `node:crypto`'s SHA-256 for
 *        a cryptographic address; omit for the portable default)
 * @public
 */
export function hashDocument(doc: DocumentV3, sha256?: Sha256Fn): string {
  return hashCanonical(canonicalJson(doc), sha256);
}

/**
 * Serialize a {@link DocumentV3} to its canonical (sorted-key) JSON — the
 * exact byte string {@link hashDocument} digests. Exposed so a caller can
 * hash with its own algorithm without re-deriving the canonical encoding.
 *
 * @public
 */
export function canonicalDocumentJson(doc: DocumentV3): string {
  return canonicalJson(doc);
}

/** Digest a pre-canonicalized JSON string into an `<algo>:<hex>` address. */
function hashCanonical(canonical: string, sha256?: Sha256Fn): string {
  if (sha256) return `sha256:${sha256(canonical)}`;
  return `fnv1a64:${fnv1a64(canonical)}`;
}

/**
 * Serialize a JSON-compatible value with object keys sorted recursively.
 * Arrays keep their order (order is meaningful for layers / separations /
 * pages); only object key order is normalized. `undefined` properties are
 * omitted, matching `JSON.stringify`.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/**
 * Dependency-free 64-bit FNV-1a digest (16 hex chars). Deterministic and
 * portable — used only as the {@link applyCorrections} default when no
 * cryptographic `sha256` is injected. Not collision-resistant; production
 * content-addressing injects SHA-256.
 */
function fnv1a64(input: string): string {
  // FNV-1a over UTF-16 code units. BigInt keeps the 64-bit arithmetic
  // exact (JS numbers lose precision past 2^53).
  const PRIME = 1099511628211n;
  const MASK = (1n << 64n) - 1n;
  let hash = 14695981039346656037n;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * PRIME) & MASK;
  }
  return hash.toString(16).padStart(16, "0");
}
