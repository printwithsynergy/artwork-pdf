// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 long-tail — consolidated panels for the playbook's
 * remaining loader-adapter surfaces. Each export is a small,
 * focused React panel + its adapter type, sharing the same
 * load-on-mount / render-list / surface-error lifecycle as the
 * rest of the AI / I family. Hosts wire one
 * {@link FeatureLoaderFn} per panel; this module hosts no
 * network calls of its own.
 *
 * Features in this bundle:
 *
 * - **B2** {@link DamAssetsPanel} (DAM hookup) — list of
 *   approved assets pulled from the host's DAM connector.
 * - **X3** {@link ApprovedMasterDiffPanel} — visual diff vs the
 *   pinned master version.
 * - **AI1** {@link CopyGenerationPanel} — Claude-style copy
 *   generation with length-to-fit constraint.
 * - **AI2** {@link ImageGenerationPanel} — CMYK-aware image gen
 *   with DPI guarantees.
 * - **AI3** {@link AutoLayoutPanel} — auto-arrange/fit solver.
 * - **AI5** {@link OcrRebuildPanel} — OCR a reference pack
 *   image and reconstruct editable objects.
 * - **V3** {@link LocalizationPanel} — per-language variants
 *   with text-expansion warnings.
 * - **I1** {@link DesignHandoffPanel} — Figma / Adobe import.
 * - **I2** {@link EcommerceConnectorPanel} — Shopify product
 *   pull / SKU variants.
 * - **I3** {@link PimConnectorPanel} — PIM bind for merge
 *   fields.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useEffect, useState } from "react";

// ── B2 DAM hookup ────────────────────────────────────────────

/** @public */
export type DamAsset = {
  id: string;
  name: string;
  kind: "image" | "logo" | "font" | "swatch" | "other";
  url?: string;
  rights?: string;
};

/** @public */
export type DamAssetsLoaderFn = (query?: string) => Promise<readonly DamAsset[]>;

/** @public */
export type DamAssetsPanelProps = {
  loader: DamAssetsLoaderFn;
  onSelect?: (asset: DamAsset) => void;
};

/**
 * B2 — DAM assets browser. The host wires a
 * {@link DamAssetsLoaderFn} adapter that fronts Bynder /
 * Brandfolder / any DAM API; this panel renders the asset list
 * with usage-rights chips when supplied.
 *
 * @public
 */
export function DamAssetsPanel({ loader, onSelect }: DamAssetsPanelProps): ReactElement {
  return (
    <LoaderPanel
      testId="dam-assets-panel"
      title="DAM assets"
      loader={() => loader()}
      renderRow={(a) => (
        <span>
          {a.name}
          <span style={{ fontSize: "0.625rem", color: "#595959", marginLeft: "0.375rem" }}>
            {a.kind}
            {a.rights ? ` · ${a.rights}` : ""}
          </span>
        </span>
      )}
      onSelect={onSelect}
    />
  );
}

// ── X3 Approved-master diff ──────────────────────────────────

/** @public */
export type ApprovedMasterDiffChange = {
  id: string;
  kind: "text" | "color" | "moved" | "added" | "removed";
  summary: string;
  objectId?: string;
};

/** @public */
export type ApprovedMasterDiffLoaderFn = () => Promise<readonly ApprovedMasterDiffChange[]>;

/** @public */
export type ApprovedMasterDiffPanelProps = {
  loader: ApprovedMasterDiffLoaderFn;
  onSelect?: (change: ApprovedMasterDiffChange) => void;
};

/**
 * X3 — Diff vs the pinned approved master. Each change row
 * shows kind + summary; the host wires the actual diff
 * computation (typically codex `vision/phash` + per-separation
 * structural diff).
 *
 * @public
 */
export function ApprovedMasterDiffPanel({
  loader,
  onSelect,
}: ApprovedMasterDiffPanelProps): ReactElement {
  return (
    <LoaderPanel
      testId="approved-master-diff-panel"
      title="Master diff"
      loader={loader}
      renderRow={(c) => (
        <span>
          [{c.kind}] {c.summary}
        </span>
      )}
      onSelect={onSelect}
    />
  );
}

// ── AI1 Copy generation ──────────────────────────────────────

/** @public */
export type CopyGenerationRequest = {
  /** Prompt or seed text the LLM should expand/refine. */
  prompt: string;
  /** Max character count the generated copy must fit in
   *  (drives length-to-fit warnings). */
  maxChars: number;
  /** Optional brand-voice hints. */
  voice?: string;
};

/** @public */
export type CopyGenerationResult = {
  text: string;
  /** Reasons the host should surface — typically risky-claim
   *  flags from the AI safety pass. */
  warnings: readonly string[];
};

/** @public */
export type CopyGenerationFn = (req: CopyGenerationRequest) => Promise<CopyGenerationResult>;

/** @public */
export type CopyGenerationPanelProps = {
  generator: CopyGenerationFn;
  initialPrompt?: string;
  maxChars?: number;
  onResult?: (result: CopyGenerationResult) => void;
};

/**
 * AI1 — Copy generation panel. Wraps a host-supplied LLM
 * adapter (typically codex `ai/claude` + `spell` + budget). The
 * panel owns the prompt input + max-chars constraint and the
 * generate-button lifecycle; the host wires the adapter.
 *
 * @public
 */
export function CopyGenerationPanel({
  generator,
  initialPrompt = "",
  maxChars = 200,
  onResult,
}: CopyGenerationPanelProps): ReactElement {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<CopyGenerationResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const generate = async () => {
    setStatus("loading");
    setErr(null);
    try {
      const r = await generator({ prompt, maxChars });
      setResult(r);
      setStatus("done");
      onResult?.(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Generation failed.");
      setStatus("error");
    }
  };
  return (
    <div data-testid="copy-generation-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.375rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Copy generator</h3>
      </header>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the copy…"
        aria-label="Copy generation prompt"
        style={{ width: "100%", minHeight: 60, fontSize: "0.8125rem", padding: "0.25rem" }}
      />
      <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.375rem" }}>
        <button
          type="button"
          onClick={generate}
          disabled={status === "loading" || !prompt.trim()}
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
        >
          {status === "loading" ? "Generating…" : `Generate (≤${maxChars} chars)`}
        </button>
      </div>
      {result && (
        <div style={{ marginTop: "0.5rem", fontSize: "0.8125rem" }}>
          <div style={{ padding: "0.375rem", background: "#f6f6f6", borderRadius: 4 }}>
            {result.text}
          </div>
          {result.warnings.length > 0 && (
            <ul style={{ marginTop: "0.25rem", paddingLeft: "1.25rem" }}>
              {result.warnings.map((w) => (
                <li key={w} style={{ fontSize: "0.75rem", color: "#a60" }}>
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {err && (
        <div role="alert" style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#a00" }}>
          {err}
        </div>
      )}
    </div>
  );
}

// ── AI2 Image generation ─────────────────────────────────────

/** @public */
export type ImageGenerationRequest = {
  prompt: string;
  /** Width in mm at the target print resolution. */
  widthMm: number;
  heightMm: number;
  /** Target DPI — typically 300 for press; codex `ai/dispatcher`
   *  enforces. */
  dpi: number;
  /** Convert from sRGB to a CMYK profile? Host implementation. */
  cmykProfile?: string;
};

/** @public */
export type ImageGenerationResult = {
  /** Image data URL or external URL the host can use as the
   *  fill source. */
  url: string;
  widthPx: number;
  heightPx: number;
  /** Provenance tag (e.g. `"ai-generated"`) for downstream
   *  labelling per AI provenance rules. */
  provenance: string;
};

/** @public */
export type ImageGenerationFn = (req: ImageGenerationRequest) => Promise<ImageGenerationResult>;

/** @public */
export type ImageGenerationPanelProps = {
  generator: ImageGenerationFn;
  defaultWidthMm?: number;
  defaultHeightMm?: number;
  onResult?: (result: ImageGenerationResult) => void;
};

/**
 * AI2 — Print-resolution image generation. Surface is minimal
 * (prompt + dims); host adapter handles the CMYK conversion +
 * provenance tagging.
 *
 * @public
 */
export function ImageGenerationPanel({
  generator,
  defaultWidthMm = 50,
  defaultHeightMm = 50,
  onResult,
}: ImageGenerationPanelProps): ReactElement {
  const [prompt, setPrompt] = useState("");
  const [w, setW] = useState(defaultWidthMm);
  const [h, setH] = useState(defaultHeightMm);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<ImageGenerationResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const generate = async () => {
    setStatus("loading");
    setErr(null);
    try {
      const r = await generator({ prompt, widthMm: w, heightMm: h, dpi: 300 });
      setResult(r);
      setStatus("done");
      onResult?.(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Image generation failed.");
      setStatus("error");
    }
  };
  return (
    <div data-testid="image-generation-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.375rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Image generator</h3>
      </header>
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the image…"
        aria-label="Image generation prompt"
        style={{ width: "100%", fontSize: "0.8125rem", padding: "0.25rem" }}
      />
      <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.375rem" }}>
        <label style={{ fontSize: "0.75rem" }}>
          W mm
          <input
            type="number"
            value={w}
            onChange={(e) => setW(Number(e.target.value) || 0)}
            style={{ width: 60, marginLeft: "0.25rem" }}
          />
        </label>
        <label style={{ fontSize: "0.75rem" }}>
          H mm
          <input
            type="number"
            value={h}
            onChange={(e) => setH(Number(e.target.value) || 0)}
            style={{ width: 60, marginLeft: "0.25rem" }}
          />
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={status === "loading" || !prompt.trim()}
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
        >
          {status === "loading" ? "…" : "Generate"}
        </button>
      </div>
      {result && (
        <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#595959" }}>
          {result.widthPx}×{result.heightPx}px · {result.provenance}
        </div>
      )}
      {err && (
        <div role="alert" style={{ marginTop: "0.375rem", fontSize: "0.75rem", color: "#a00" }}>
          {err}
        </div>
      )}
    </div>
  );
}

// ── AI3 Auto-layout ──────────────────────────────────────────

/** @public */
export type AutoLayoutRequest = {
  /** Object ids the solver may move / resize. */
  objectIds: readonly string[];
  /** Constraints — bleed safety, panel anchors (S3 ties in). */
  respectBleed: boolean;
  respectPanelAnchors: boolean;
};

/** @public */
export type AutoLayoutOperation = {
  objectId: string;
  /** Target translation in mm. */
  dx?: number;
  dy?: number;
  /** Target scale factor. */
  scale?: number;
};

/** @public */
export type AutoLayoutFn = (req: AutoLayoutRequest) => Promise<readonly AutoLayoutOperation[]>;

/** @public */
export type AutoLayoutPanelProps = {
  solver: AutoLayoutFn;
  objectIds: readonly string[];
  onSolved?: (ops: readonly AutoLayoutOperation[]) => void;
};

/**
 * AI3 — Auto-layout / auto-fit panel. Host wires the solver
 * (typically codex geom + the rich document-model); the panel
 * surfaces the run-and-preview affordance.
 *
 * @public
 */
export function AutoLayoutPanel({
  solver,
  objectIds,
  onSolved,
}: AutoLayoutPanelProps): ReactElement {
  const [respectBleed, setRespectBleed] = useState(true);
  const [respectAnchors, setRespectAnchors] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [ops, setOps] = useState<readonly AutoLayoutOperation[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setStatus("loading");
    setErr(null);
    try {
      const next = await solver({
        objectIds,
        respectBleed,
        respectPanelAnchors: respectAnchors,
      });
      setOps(next);
      setStatus("done");
      onSolved?.(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Auto-layout failed.");
      setStatus("error");
    }
  };
  return (
    <div data-testid="auto-layout-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.375rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Auto layout</h3>
      </header>
      <div style={{ fontSize: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <label>
          <input
            type="checkbox"
            checked={respectBleed}
            onChange={(e) => setRespectBleed(e.target.checked)}
          />{" "}
          Respect bleed / safety
        </label>
        <label>
          <input
            type="checkbox"
            checked={respectAnchors}
            onChange={(e) => setRespectAnchors(e.target.checked)}
          />{" "}
          Respect panel anchors
        </label>
      </div>
      <button
        type="button"
        onClick={run}
        disabled={status === "loading" || objectIds.length === 0}
        style={{ marginTop: "0.375rem", fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
      >
        {status === "loading" ? "Solving…" : `Auto-arrange ${objectIds.length} object(s)`}
      </button>
      {ops && (
        <div style={{ marginTop: "0.375rem", fontSize: "0.75rem", color: "#595959" }}>
          {ops.length} operation(s) emitted
        </div>
      )}
      {err && (
        <div role="alert" style={{ marginTop: "0.375rem", fontSize: "0.75rem", color: "#a00" }}>
          {err}
        </div>
      )}
    </div>
  );
}

/**
 * Encode an ArrayBuffer to base64 in 32 KB chunks so we don't blow
 * past `String.fromCharCode.apply` argument-length limits on large
 * files. `btoa` is Latin-1, which is fine here because each byte
 * of the buffer becomes one code unit ≤ 0xFF.
 *
 * @internal
 */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

// ── AI5 OCR rebuild ──────────────────────────────────────────

/** @public */
export type OcrRebuildRequest = {
  /** Source image — base64-encoded PNG/JPEG bytes. */
  imageB64: string;
  /** Optional language hint for the OCR engine. */
  language?: string;
};

/** @public */
export type OcrRebuildObject = {
  id: string;
  kind: "text" | "logo" | "barcode-placeholder" | "panel-rect";
  /** Bounding box in mm. */
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
  /** Recovered text / value, when applicable. */
  text?: string;
};

/** @public */
export type OcrRebuildFn = (req: OcrRebuildRequest) => Promise<readonly OcrRebuildObject[]>;

/** @public */
export type OcrRebuildPanelProps = {
  ocr: OcrRebuildFn;
  onObjects?: (objs: readonly OcrRebuildObject[]) => void;
};

/**
 * AI5 — Competitor-pack OCR rebuild. Host accepts an image
 * upload, runs codex `extract` + `ai/logos` + `ai/symbols` +
 * `ai/language`, and returns reconstructed editable objects.
 * Surface here is the file-input + reconstruct trigger.
 *
 * @public
 */
export function OcrRebuildPanel({ ocr, onObjects }: OcrRebuildPanelProps): ReactElement {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [count, setCount] = useState(0);
  const onFile = async (file: File) => {
    setStatus("loading");
    try {
      const buf = await file.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      const objs = await ocr({ imageB64: b64 });
      setCount(objs.length);
      setStatus("done");
      onObjects?.(objs);
    } catch {
      setStatus("error");
    }
  };
  return (
    <div data-testid="ocr-rebuild-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.375rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>OCR rebuild</h3>
      </header>
      <input
        type="file"
        accept="image/*"
        aria-label="Reference image for OCR rebuild"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
        style={{ fontSize: "0.75rem" }}
      />
      {status === "done" && (
        <div style={{ marginTop: "0.375rem", fontSize: "0.75rem", color: "#595959" }}>
          Reconstructed {count} object(s).
        </div>
      )}
      {status === "loading" && (
        <output style={{ display: "block", fontSize: "0.75rem", marginTop: "0.375rem" }}>
          Running OCR…
        </output>
      )}
    </div>
  );
}

// ── V3 Localization ──────────────────────────────────────────

/** @public */
export type LocalizationVariant = {
  /** BCP-47 tag — e.g. `"en"`, `"fr-CA"`, `"ja"`. */
  language: string;
  /** Per-text-object override map: objectId → translated text. */
  texts: Record<string, string>;
};

/** @public */
export type LocalizationExpansion = {
  language: string;
  objectId: string;
  /** Original chars vs translated chars; > 1 = expanded. */
  ratio: number;
};

/** @public */
export type LocalizationPanelProps = {
  variants: readonly LocalizationVariant[];
  /** Optional expansion warnings the host pre-computed (the
   *  ratio of translated chars vs the source's box area
   *  estimate). Rows with ratio > 1.2 render as warnings. */
  expansions?: readonly LocalizationExpansion[];
  onSelectVariant?: (language: string) => void;
};

/**
 * V3 — Localization + text-expansion warnings. Renders the
 * per-language variants list with click-to-preview + a
 * warnings table for any expansion ratio > 1.2 (the rule of
 * thumb for "translation needs more room").
 *
 * @public
 */
export function LocalizationPanel({
  variants,
  expansions = [],
  onSelectVariant,
}: LocalizationPanelProps): ReactElement {
  const tight = expansions.filter((e) => e.ratio > 1.2);
  return (
    <div data-testid="localization-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.375rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Localization ({variants.length})</h3>
      </header>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {variants.map((v) => (
          <li key={v.language} style={{ marginBottom: "0.25rem" }}>
            <button
              type="button"
              onClick={() => onSelectVariant?.(v.language)}
              style={{
                display: "block",
                width: "100%",
                padding: "0.375rem 0.5rem",
                background: "transparent",
                border: "1px solid #ddd",
                borderRadius: 4,
                textAlign: "left",
                fontSize: "0.8125rem",
                cursor: onSelectVariant ? "pointer" : "default",
              }}
            >
              {v.language}{" "}
              <span style={{ color: "#595959" }}>· {Object.keys(v.texts).length} string(s)</span>
            </button>
          </li>
        ))}
      </ul>
      {tight.length > 0 && (
        <div
          data-testid="localization-expansion-warnings"
          style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#a60" }}
        >
          {tight.length} translation(s) may overflow their box (ratio &gt; 1.2)
        </div>
      )}
    </div>
  );
}

// ── I1 Design handoff (Figma / Adobe) ────────────────────────

/** @public */
export type DesignHandoffSource = "figma" | "illustrator" | "indesign" | "other";

/** @public */
export type DesignHandoffImportFn = (opts: {
  source: DesignHandoffSource;
  fileRef: string;
}) => Promise<{ objectsImported: number }>;

/** @public */
export type DesignHandoffPanelProps = {
  importer: DesignHandoffImportFn;
  onImported?: (info: { objectsImported: number }) => void;
};

/**
 * I1 — Figma / Adobe handoff panel. Host wires the actual file /
 * frame / page resolver; this panel surfaces the source picker +
 * file-ref input and the import-now affordance.
 *
 * @public
 */
export function DesignHandoffPanel({
  importer,
  onImported,
}: DesignHandoffPanelProps): ReactElement {
  const [source, setSource] = useState<DesignHandoffSource>("figma");
  const [ref, setRef] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [count, setCount] = useState(0);
  const run = async () => {
    setStatus("loading");
    const r = await importer({ source, fileRef: ref });
    setCount(r.objectsImported);
    setStatus("done");
    onImported?.(r);
  };
  return (
    <div data-testid="design-handoff-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.375rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Design handoff</h3>
      </header>
      <select
        value={source}
        onChange={(e) => setSource(e.target.value as DesignHandoffSource)}
        aria-label="Design handoff source"
        style={{ fontSize: "0.8125rem", padding: "0.25rem", marginRight: "0.375rem" }}
      >
        <option value="figma">Figma</option>
        <option value="illustrator">Illustrator</option>
        <option value="indesign">InDesign</option>
        <option value="other">Other</option>
      </select>
      <input
        type="text"
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="File / frame URL"
        aria-label="File reference"
        style={{ fontSize: "0.8125rem", padding: "0.25rem" }}
      />
      <button
        type="button"
        onClick={run}
        disabled={status === "loading" || !ref.trim()}
        style={{ marginLeft: "0.375rem", fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
      >
        {status === "loading" ? "…" : "Import"}
      </button>
      {status === "done" && (
        <div style={{ marginTop: "0.375rem", fontSize: "0.75rem", color: "#595959" }}>
          Imported {count} object(s) from {source}.
        </div>
      )}
    </div>
  );
}

// ── I2 Ecommerce (Shopify) ───────────────────────────────────

/** @public */
export type EcommerceProduct = {
  id: string;
  title: string;
  gtin?: string;
  imageUrl?: string;
  /** Product attributes the editor can bind as merge fields. */
  attrs: Record<string, string>;
};

/** @public */
export type EcommerceLoaderFn = () => Promise<readonly EcommerceProduct[]>;

/** @public */
export type EcommerceConnectorPanelProps = {
  loader: EcommerceLoaderFn;
  onSelect?: (product: EcommerceProduct) => void;
};

/**
 * I2 — Ecommerce (Shopify) product picker. Pull a product list
 * from the host's store connector and let the user pick one to
 * prefill merge fields / generate SKU variants. Host adapter
 * handles store auth.
 *
 * @public
 */
export function EcommerceConnectorPanel({
  loader,
  onSelect,
}: EcommerceConnectorPanelProps): ReactElement {
  return (
    <LoaderPanel
      testId="ecommerce-connector-panel"
      title="Products"
      loader={loader}
      renderRow={(p) => (
        <span>
          {p.title}
          {p.gtin && (
            <span style={{ fontSize: "0.625rem", color: "#595959", marginLeft: "0.375rem" }}>
              GTIN {p.gtin}
            </span>
          )}
        </span>
      )}
      onSelect={onSelect}
    />
  );
}

// ── I3 PIM connector ─────────────────────────────────────────

/** @public */
export type PimField = {
  id: string;
  label: string;
  value: string;
};

/** @public */
export type PimLoaderFn = () => Promise<readonly PimField[]>;

/** @public */
export type PimConnectorPanelProps = {
  loader: PimLoaderFn;
  onBind?: (field: PimField) => void;
};

/**
 * I3 — PIM connector panel. List of pull-able fields from the
 * host's PIM connector; click a field to bind it as a merge
 * token on the active object.
 *
 * @public
 */
export function PimConnectorPanel({ loader, onBind }: PimConnectorPanelProps): ReactElement {
  return (
    <LoaderPanel
      testId="pim-connector-panel"
      title="PIM fields"
      loader={loader}
      renderRow={(f) => (
        <span>
          {f.label}
          <span style={{ fontSize: "0.625rem", color: "#595959", marginLeft: "0.375rem" }}>
            {f.value}
          </span>
        </span>
      )}
      onSelect={onBind}
    />
  );
}

// ── Internal: shared LoaderPanel ─────────────────────────────

type LoaderPanelProps<T> = {
  testId: string;
  title: string;
  loader: () => Promise<readonly T[]>;
  renderRow: (item: T) => ReactElement;
  onSelect?: ((item: T) => void) | undefined;
};

function LoaderPanel<T extends { id: string }>({
  testId,
  title,
  loader,
  renderRow,
  onSelect,
}: LoaderPanelProps<T>): ReactElement {
  const [items, setItems] = useState<readonly T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const next = await loader();
        if (!disposed) setItems(next);
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      disposed = true;
    };
  }, [loader]);
  return (
    <div data-testid={testId} style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.375rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>
          {title}
          {items && ` (${items.length})`}
        </h3>
      </header>
      {error && (
        <div role="alert" style={{ fontSize: "0.75rem", color: "#a00" }}>
          {error}
        </div>
      )}
      {!error && !items && (
        <output style={{ display: "block", fontSize: "0.75rem", opacity: 0.6 }}>
          Loading…
        </output>
      )}
      {items && items.length === 0 && (
        <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>None.</div>
      )}
      {items && items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((item) => (
            <li key={item.id} style={{ marginBottom: "0.25rem" }}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "0.375rem 0.5rem",
                    background: "transparent",
                    border: "1px solid #ddd",
                    borderRadius: 4,
                    textAlign: "left",
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                  }}
                >
                  {renderRow(item)}
                </button>
              ) : (
                <div style={{ padding: "0.375rem 0.5rem", fontSize: "0.8125rem" }}>
                  {renderRow(item)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
