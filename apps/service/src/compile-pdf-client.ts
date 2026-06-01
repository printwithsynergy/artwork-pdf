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
};

export type RewritePlan = {
  /** Set or override PDF metadata fields. */
  metadata?: Record<string, string>;
  /** Color overrides keyed by source ink name. */
  colorOverrides?: Record<string, string>;
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
