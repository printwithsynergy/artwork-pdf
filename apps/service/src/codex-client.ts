// SPDX-License-Identifier: AGPL-3.0-or-later
//
// HTTP client for `codex-pdf` — the read-only extraction engine that turns a
// PDF into normalized facts + visual findings. The artwork service calls it
// *after render* to emit `CodexFinding[]` (positional preflight findings) from
// the produced PDF, replacing the service's legacy `PreflightIssue[]` shape on
// the ecosystem seam (see the org cross-stack notes: artwork → codex after
// render → `codexFindings`).
//
// Base URL is read from `CODEX_API_BASE_URL`; an optional bearer token from
// `CODEX_API_TOKEN`. When the base URL is unset the client is **unconfigured**
// and callers skip codex (service-skip pattern) rather than failing the render.
//
// This is the integration seam — tests inject a fetcher via the `fetch` option
// so no running codex instance is required.

const CODEX_API_BASE_URL = process.env.CODEX_API_BASE_URL?.replace(/\/$/, "");
const CODEX_API_TOKEN = process.env.CODEX_API_TOKEN;

/**
 * A located preflight finding as emitted by codex-pdf — the ecosystem-canonical
 * shape (1-indexed `page`, `bbox` in PDF points). `bbox` is `null` only for
 * document-level findings. Maps directly onto lens-pdf's `OverlayItem` via
 * `fromCodexFindings()`.
 */
export type CodexFinding = {
  /** Stable finding id, e.g. `"low_dpi-img-p1-xref42"`. */
  id: string;
  /** Machine-readable finding type, e.g. `"low_dpi"`. */
  type: string;
  /** Severity, sharing lens-pdf's tier vocabulary. */
  severity: "error" | "warning" | "advisory" | "info";
  /** 1-indexed page number. */
  page: number;
  /** `(x0, y0, x1, y1)` in PDF points (origin bottom-left); `null` for doc-level. */
  bbox: [number, number, number, number] | null;
  /** Human-readable message. */
  message: string;
  /** Optional short code, e.g. `"LOW_DPI_72"`. */
  code?: string;
  /** Extractor-specific payload. */
  data?: Record<string, unknown>;
};

/** Construction options for {@link CodexClient}. */
export type CodexClientOptions = {
  /** Override the base URL (default: `CODEX_API_BASE_URL` env). */
  baseUrl?: string;
  /** Bearer token (default: `CODEX_API_TOKEN` env). */
  token?: string;
  /** Inject a custom fetcher (used in tests). Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
};

/** Raised when codex returns a non-2xx response. */
export class CodexError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CodexError";
  }
}

/**
 * Minimal codex-pdf client: a single `extractFindings` call that uploads a PDF
 * and returns its `findings[]`, using sparse field projection
 * (`X-Codex-Fields: findings`) so codex skips the work the service doesn't need.
 */
export class CodexClient {
  private readonly baseUrl: string | undefined;
  private readonly token: string | undefined;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(opts: CodexClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? CODEX_API_BASE_URL)?.replace(/\/$/, "");
    this.token = opts.token ?? CODEX_API_TOKEN;
    this.fetcher = opts.fetch ?? globalThis.fetch;
  }

  /**
   * True when a base URL is configured. Callers MUST check this and skip codex
   * (service-skip pattern) when false — an unwired codex must degrade to "no
   * findings", never fail the render.
   */
  isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  /**
   * Upload `pdfBytes` to codex and return its visual `findings[]`. Throws
   * {@link CodexError} on a non-2xx response or {@link Error} when the client is
   * unconfigured — callers should gate on {@link isConfigured} and treat any
   * throw as "no findings" so codex never blocks the writer path.
   */
  async extractFindings(pdfBytes: ArrayBuffer | Uint8Array): Promise<CodexFinding[]> {
    if (!this.baseUrl) {
      throw new Error("CodexClient is not configured (CODEX_API_BASE_URL unset)");
    }
    // Copy into a fresh Uint8Array<ArrayBuffer>: BlobPart (TS 6 lib types)
    // rejects Uint8Array<ArrayBufferLike>, which a caller-supplied view may be.
    const bytes = new Uint8Array(
      pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes),
    );
    const form = new FormData();
    // codex's POST /v1/extract requires the multipart field named `pdf`.
    form.append("pdf", new Blob([bytes], { type: "application/pdf" }), "artwork.pdf");

    const headers: Record<string, string> = { "X-Codex-Fields": "findings" };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await this.fetcher(`${this.baseUrl}/v1/extract`, {
      method: "POST",
      headers,
      body: form,
    });
    if (!res.ok) {
      throw new CodexError(`codex extract failed (${res.status})`, res.status);
    }
    const doc = (await res.json()) as { findings?: unknown };
    return Array.isArray(doc.findings) ? (doc.findings as CodexFinding[]) : [];
  }
}
