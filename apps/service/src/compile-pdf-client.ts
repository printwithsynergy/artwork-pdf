// SPDX-License-Identifier: AGPL-3.0-or-later
//
// HTTP client for `pws/compile-pdf` — the Python "only writer" service
// that owns every PDF → PDF transform (compose, marks, trap, impose,
// rewrite). One method per producer, all synchronous, all returning a
// `{ bytes, cacheKey }` pair.
//
// Base URL is read from the `COMPILE_PDF_URL` env var. In CI / smoke
// tests the client falls back to `http://localhost:8000`.
//
// This file is the integration seam. Tests stub the fetcher via the
// `fetch` option so we don't need a running compile-pdf instance.

import type { DocumentModel, PreflightReport } from "@artworkpdf/document-model";

const COMPILE_PDF_URL = process.env.COMPILE_PDF_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export type CompilePdfClientOptions = {
  /** Override the base URL (default: `COMPILE_PDF_URL` env). */
  baseUrl?: string;
  /** Inject a custom fetcher (used in tests). Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
};

export type ProducerResponse = {
  /** The PDF bytes returned by the producer. */
  bytes: ArrayBuffer;
  /** Lineage-addressable cache key from compile-pdf. */
  cacheKey: string;
};

export type ComposeOptions = {
  /** Embed all fonts. Default: true. */
  embedFonts?: boolean;
  /** ICC color profile name. Default: `"ISOcoated_v2_eci"`. */
  colorProfile?: string;
};

export type MarksPlan = {
  /** Registration marks at each corner. */
  registration?: boolean;
  /** Trim marks at each corner. */
  trim?: boolean;
  /** Bleed marks at each corner. */
  bleed?: boolean;
  /** Color bars along the margin. */
  colorBars?: boolean;
};

export type TrapPolicy = {
  widthMm: number;
  /** Whether to spread or choke at each edge type. */
  mode?: "auto" | "spread" | "choke";
};

/**
 * One trap operation as returned by {@link CompilePdfClient.trapPreview}.
 *
 * Mirrors compile-pdf's `trap_diff.operations[i]` shape: a 1-indexed
 * page number, a pixel-space bounding rectangle, and the ink-pair
 * direction. Used by the editor's D1 background trap-preview overlay
 * to draw where traps would land on the canvas.
 */
export type TrapOperation = {
  page_index: number;
  rect_pt: [number, number, number, number];
  from_ink: string;
  to_ink: string;
  width_pt: number;
  direction: "spread" | "choke" | "auto";
};

/**
 * Wire shape of `POST /v1/trap/preview`. Same trap-analysis fields as
 * {@link ProducerResponse}'s producer-specific body, but without the
 * `output_pdf_b64` / `pdf_sha256` — the preview endpoint returns
 * metadata only so the D1 overlay can re-fire on every editor change
 * without paying PDF egress.
 */
export type TrapPreviewResponse = {
  input_sha256: string;
  policy_sha256: string;
  cache_key: string;
  engine: string;
  engine_fingerprint: string;
  operations_count: number;
  trap_diff: {
    schema_version: string;
    engine: string;
    operations: TrapOperation[];
    [key: string]: unknown;
  };
  trap_findings: Array<Record<string, unknown>>;
  schema_version: string;
  compile_version: string;
};

export type ImposeTemplate = {
  /** Sheet size in PDF points (1 pt = 1/72 in). The `Pt` suffix
   *  matches the document-model wire shape; see producer-plans.ts. */
  sheetWidthPt: number;
  sheetHeightPt: number;
  /** Cell layout: rows × cols of source pages. */
  rows: number;
  cols: number;
  /** "sequential" maps source page N → cell N; "repeat" reuses page 0. */
  pageMapping?: "sequential" | "repeat";
  /** Uniform inter-cell spacing in millimeters. Converted to points
   *  at submission. Defaults to 0 (cells touch). */
  gutterMm?: number;
  /** Uniform sheet-edge margin in millimeters reserved for marks and
   *  bleed handling. Converted to points + projected onto the
   *  server's `marks_zone` (top/right/bottom/left) at submission.
   *  Defaults to 0. */
  marginMm?: number;
  /** When true, request four-color registration targets in the
   *  reserved margin area. Wired to compile-pdf's
   *  `ImposePlan.registration_marks` (Wave 1 PR-14); engine rendering
   *  lands in a follow-up. */
  registrationMarks?: boolean;
  /** When true, request crop marks at per-cell trim corners. Wired
   *  to compile-pdf's `ImposePlan.crop_marks`; same plumb-only
   *  semantics as `registrationMarks`. */
  cropMarks?: boolean;
};

export type RewritePlan = {
  /** Set or override PDF metadata fields. */
  metadata?: Record<string, string>;
  /** Color overrides keyed by source ink name. */
  colorOverrides?: Record<string, string>;
};

/**
 * One PANTONE catalogue entry. Mirrors `codex_pdf.color.PantoneEntry`
 * via the `/v1/spots/{search,lookup,libraries}` HTTP surface.
 */
export type SpotEntry = {
  name: string;
  library?: string | null;
  lab?: [number, number, number] | null;
  cmyk_bridge?: [number, number, number, number] | null;
  lab_source?: string | null;
  cmyk_source?: string | null;
};

/** Wire shape of `GET /v1/spots/search`. */
export type SpotSearchResponse = {
  results: SpotEntry[];
  /** Number of catalogue entries that matched the query (pre-limit). */
  total: number;
  limit: number;
};

/** One row from `GET /v1/spots/libraries`. */
export type SpotLibrary = {
  id: string;
  count: number;
};

/** Wire shape of `GET /v1/spots/libraries`. */
export type SpotLibrariesResponse = {
  libraries: SpotLibrary[];
};

/**
 * Minimal HTTP client for the compile-pdf service.
 *
 * Usage:
 *
 * ```ts
 * const client = new CompilePdfClient();
 * const composed = await client.compose(document);
 * const withMarks = await client.marks({ trim: true, bleed: true }, composed.bytes);
 * const trapped = await client.trap({ widthMm: 0.1 }, withMarks.bytes);
 * const imposed = await client.impose({ ... }, trapped.bytes);
 * ```
 */
export class CompilePdfClient {
  readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(opts: CompilePdfClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? COMPILE_PDF_URL).replace(/\/$/, "");
    this.fetcher = opts.fetch ?? globalThis.fetch;
  }

  /**
   * Render a DocumentModel to PDF via compile-pdf's `compose` producer.
   *
   * @throws when the response is not 200 or the JSON is missing
   *         `output_pdf_b64`.
   */
  async compose(
    document: DocumentModel,
    options: ComposeOptions = {},
    preflightReport?: PreflightReport,
  ): Promise<ProducerResponse> {
    return this.postProducer("/v1/compose/apply", {
      document,
      options: {
        embed_fonts: options.embedFonts ?? true,
        color_profile: options.colorProfile ?? "ISOcoated_v2_eci",
      },
      ...(preflightReport ? { preflight_report: preflightReport } : {}),
    });
  }

  /** Add printer marks (registration, trim, bleed, color bars). */
  async marks(plan: MarksPlan, pdfBytes: ArrayBuffer | Uint8Array): Promise<ProducerResponse> {
    return this.postProducer("/v1/marks/apply", {
      input_pdf_b64: toBase64(pdfBytes),
      plan,
    });
  }

  /** Apply color trapping. Optional Ghostscript-backed path on the server. */
  async trap(policy: TrapPolicy, pdfBytes: ArrayBuffer | Uint8Array): Promise<ProducerResponse> {
    return this.postProducer("/v1/trap/apply", {
      input_pdf_b64: toBase64(pdfBytes),
      policy,
    });
  }

  /**
   * D1 background trap preview — runs the same trap-policy analysis
   * as {@link trap} but returns metadata only (no `output_pdf_b64`).
   *
   * Used by the editor's `TrapPreviewOverlay` to show where trap
   * regions would land without the egress cost of a full PDF
   * rewrite. Cache-key is distinct from `trap()` so the two paths
   * don't collide server-side.
   */
  async trapPreview(
    policy: TrapPolicy,
    pdfBytes: ArrayBuffer | Uint8Array,
  ): Promise<TrapPreviewResponse> {
    const res = await this.fetcher(`${this.baseUrl}/v1/trap/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input_pdf_b64: toBase64(pdfBytes), policy }),
    });
    if (!res.ok) {
      const detail = await safeReadText(res);
      throw new CompilePdfError(
        `compile-pdf /v1/trap/preview ${res.status}: ${detail || res.statusText}`,
        res.status,
        "/v1/trap/preview",
      );
    }
    return (await res.json()) as TrapPreviewResponse;
  }

  /** Multi-up sheet imposition. */
  async impose(
    template: ImposeTemplate,
    pdfBytes: ArrayBuffer | Uint8Array,
  ): Promise<ProducerResponse> {
    return this.postProducer("/v1/impose/apply", {
      input_pdf_b64: toBase64(pdfBytes),
      template,
    });
  }

  /** Metadata / color override rewrite. */
  async rewrite(plan: RewritePlan, pdfBytes: ArrayBuffer | Uint8Array): Promise<ProducerResponse> {
    return this.postProducer("/v1/rewrite/apply", {
      input_pdf_b64: toBase64(pdfBytes),
      plan,
    });
  }

  /**
   * Search compile-pdf's PANTONE catalogue (codex-pdf's
   * `pantone_reference.json`, ~23k entries, 16 sub-libraries).
   *
   * Substring + library filter. Backed by the C3 `GET /v1/spots/search`
   * endpoint. Empty / missing `q` returns the first `limit` entries
   * — useful for an initial "browse" view.
   */
  async spotSearch(opts: {
    q?: string;
    library?: string;
    limit?: number;
  }): Promise<SpotSearchResponse> {
    const params = new URLSearchParams();
    if (opts.q !== undefined) params.set("q", opts.q);
    if (opts.library !== undefined) params.set("library", opts.library);
    if (opts.limit !== undefined) params.set("limit", String(opts.limit));
    return this.getJson(`/v1/spots/search?${params.toString()}`);
  }

  /**
   * Exact lookup by canonical PANTONE name. Codex's
   * `lookup_pantone_spot` includes alternate-key fallback
   * (`PANTONE 485 C` ↔ `PANTONE 485C`).
   *
   * Resolves `null` on a 404 (unknown name) — this is *not* an
   * error, just an empty result. Other non-2xx responses throw
   * {@link CompilePdfError}.
   */
  async spotLookup(name: string): Promise<SpotEntry | null> {
    const path = `/v1/spots/lookup?name=${encodeURIComponent(name)}`;
    const res = await this.fetcher(`${this.baseUrl}${path}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      const detail = await safeReadText(res);
      throw new CompilePdfError(
        `compile-pdf ${path} ${res.status}: ${detail || res.statusText}`,
        res.status,
        path,
      );
    }
    return (await res.json()) as SpotEntry;
  }

  /**
   * Enumerate the catalogue's sub-libraries (Formula Guide Coated,
   * Color Bridge Uncoated, etc.) with per-library entry counts.
   * Backed by `GET /v1/spots/libraries`. Returned in declaration
   * order.
   */
  async spotLibraries(): Promise<SpotLibrariesResponse> {
    return this.getJson("/v1/spots/libraries");
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.fetcher(`${this.baseUrl}${path}`);
    if (!res.ok) {
      const detail = await safeReadText(res);
      throw new CompilePdfError(
        `compile-pdf ${path} ${res.status}: ${detail || res.statusText}`,
        res.status,
        path,
      );
    }
    return (await res.json()) as T;
  }

  private async postProducer(path: string, body: unknown): Promise<ProducerResponse> {
    const res = await this.fetcher(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await safeReadText(res);
      throw new CompilePdfError(
        `compile-pdf ${path} ${res.status}: ${detail || res.statusText}`,
        res.status,
        path,
      );
    }
    const json = (await res.json()) as { output_pdf_b64?: string; cache_key?: string };
    if (!json.output_pdf_b64) {
      throw new CompilePdfError(
        `compile-pdf ${path}: missing output_pdf_b64 in response`,
        res.status,
        path,
      );
    }
    return {
      bytes: fromBase64(json.output_pdf_b64),
      cacheKey: json.cache_key ?? "",
    };
  }
}

/** Error thrown by every {@link CompilePdfClient} call on a non-2xx response. */
export class CompilePdfError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "CompilePdfError";
  }
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i] ?? 0);
  return btoa(out);
}

function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
