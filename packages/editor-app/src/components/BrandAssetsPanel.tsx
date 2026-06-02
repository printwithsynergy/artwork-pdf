// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 B1 — Brand-assets registry panel.
 *
 * Surfaces the document's brand-asset registry
 * (`DocumentV3.brandAssets`) as a browsable list grouped by kind:
 * logo, swatch, typography, graphic-style, other. Hosts get a
 * controlled read-only view; mutation (add / remove / re-hash)
 * happens elsewhere — typically in a host-side asset-cache UI that
 * writes back into the document.
 *
 * Pairs with Wave 4 B2's brand-consistency rule (lint-pdf side): the
 * rule consults this same registry, so what the user sees in the
 * panel is what the rule will check against. The panel is the human
 * surface; B2 is the machine one.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useMemo } from "react";

/**
 * One brand asset. Structurally compatible with `BrandAssetRef` from
 * `@artworkpdf/document-model` — duplicated here so the editor stays
 * consumable without the document-model SDK (same pattern as
 * `ComplianceFinding`, `PreflightFinding`, etc.).
 *
 * `hash` is the content sha256 the host's asset cache uses as its
 * primary key. `sourceUrl` is optional and only set when the asset
 * originally came from an external CDN — local-only assets omit it.
 *
 * @public
 */
export type BrandAsset = {
  id: string;
  hash: string;
  name: string;
  kind: BrandAssetKind;
  mimeType?: string;
  sourceUrl?: string;
};

/**
 * The discriminator on which the panel groups assets and which the
 * B2 consistency rule pivots on. `"other"` is the escape hatch for
 * tenant-specific kinds that don't map to the four canonical buckets.
 *
 * @public
 */
export type BrandAssetKind = "logo" | "swatch" | "typography" | "graphic-style" | "other";

/**
 * Canonical order brand-asset kinds render in. The order matches the
 * mental hierarchy a brand lead expects: identity (logo), color, type,
 * generic-style, miscellaneous. Hosts that want a different order can
 * read the assets list straight from `DocumentV3.brandAssets` and
 * drive their own renderer over {@link filterBrandAssets}.
 *
 * @public
 */
export const BRAND_ASSET_KIND_ORDER: readonly BrandAssetKind[] = [
  "logo",
  "swatch",
  "typography",
  "graphic-style",
  "other",
];

/**
 * Result row from {@link groupBrandAssetsByKind}.
 *
 * @public
 */
export type BrandAssetGroup = {
  kind: BrandAssetKind;
  assets: readonly BrandAsset[];
};

/**
 * Filter spec accepted by {@link filterBrandAssets}.
 *
 * @public
 */
export type BrandAssetFilter = {
  /** Match assets whose `kind` field equals this value. Absent → no
   *  kind filter. */
  kind?: BrandAssetKind;
  /** Case-insensitive substring filter on `name`. Whitespace-only
   *  strings are treated as absent so a stray space in the search
   *  input doesn't blank the list. */
  query?: string;
};

/**
 * @public
 */
export type BrandAssetsPanelProps = {
  /** The full brand-asset registry. Typically
   *  `DocumentV3.brandAssets ?? []`. Empty array → "no assets
   *  registered" empty state. */
  assets: readonly BrandAsset[];
  /** Optional kind to pre-filter the panel to. Distinct from the
   *  in-panel filter chips — hosts wire this to a deep-link route
   *  ("?brand-kind=logo") so reloading the page lands in the same
   *  bucket. */
  filterKind?: BrandAssetKind;
  /** Optional callback fired when an asset row is clicked. Hosts
   *  typically wire this to a side panel that shows the asset's
   *  preview + hash + reference count. */
  onSelect?: (asset: BrandAsset) => void;
};

/**
 * Group assets by kind in {@link BRAND_ASSET_KIND_ORDER}. Returns a
 * stable five-bucket shape (one entry per canonical kind, even when
 * empty) so renderers can iterate without worrying about absent keys.
 *
 * Pure function — no React, no DOM.
 *
 * @public
 */
export function groupBrandAssetsByKind(assets: readonly BrandAsset[]): readonly BrandAssetGroup[] {
  const buckets = new Map<BrandAssetKind, BrandAsset[]>(BRAND_ASSET_KIND_ORDER.map((k) => [k, []]));
  for (const a of assets) {
    buckets.get(a.kind)?.push(a);
  }
  return BRAND_ASSET_KIND_ORDER.map((kind) => ({
    kind,
    assets: buckets.get(kind) ?? [],
  }));
}

/**
 * Filter assets by kind / name substring. Returns a new array;
 * preserves input order. Pure function.
 *
 * @public
 */
export function filterBrandAssets(
  assets: readonly BrandAsset[],
  filter: BrandAssetFilter,
): readonly BrandAsset[] {
  const trimmedQuery = filter.query?.trim().toLowerCase() ?? "";
  return assets.filter((a) => {
    if (filter.kind && a.kind !== filter.kind) return false;
    if (trimmedQuery && !a.name.toLowerCase().includes(trimmedQuery)) return false;
    return true;
  });
}

const KIND_LABELS: Record<BrandAssetKind, string> = {
  logo: "Logos",
  swatch: "Swatches",
  typography: "Typography",
  "graphic-style": "Graphic styles",
  other: "Other",
};

/**
 * @public
 */
export function BrandAssetsPanel({
  assets,
  filterKind,
  onSelect,
}: BrandAssetsPanelProps): ReactElement {
  const visibleAssets = useMemo(
    () => (filterKind ? filterBrandAssets(assets, { kind: filterKind }) : assets),
    [assets, filterKind],
  );
  const groups = useMemo(() => groupBrandAssetsByKind(visibleAssets), [visibleAssets]);

  if (assets.length === 0) {
    return (
      <div data-testid="brand-assets-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        No brand assets registered for this document.
      </div>
    );
  }

  return (
    <div data-testid="brand-assets-panel" style={{ padding: "0.5rem" }}>
      <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem" }}>
        Brand assets ({visibleAssets.length})
      </h3>
      {groups.map((group) => {
        if (group.assets.length === 0) return null;
        return (
          <section
            key={group.kind}
            data-testid={`brand-assets-group-${group.kind}`}
            style={{ marginBottom: "0.75rem" }}
          >
            <h4
              style={{
                margin: "0 0 0.25rem 0",
                fontSize: "0.75rem",
                color: "#666",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {KIND_LABELS[group.kind]} ({group.assets.length})
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {group.assets.map((asset) => (
                <BrandAssetRow key={asset.id} asset={asset} onSelect={onSelect} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function BrandAssetRow({
  asset,
  onSelect,
}: {
  asset: BrandAsset;
  onSelect: ((asset: BrandAsset) => void) | undefined;
}): ReactElement {
  const rowStyle = {
    display: "flex",
    alignItems: "baseline",
    gap: "0.5rem",
    width: "100%",
    padding: "0.25rem 0.5rem",
  } as const;
  const rowContents = (
    <>
      <span style={{ flex: 1 }}>{asset.name}</span>
      <small
        data-testid={`brand-asset-hash-${asset.id}`}
        style={{ opacity: 0.6, fontFamily: "monospace" }}
        title={asset.hash}
      >
        {/* Truncate the sha256 to the first 8 hex chars — enough to
         *  disambiguate at human glance, hover shows the full hash. */}
        {asset.hash.slice(0, 8)}
      </small>
    </>
  );
  return (
    <li>
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(asset)}
          aria-label={`Brand asset: ${asset.name} (${asset.kind})`}
          style={{
            ...rowStyle,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {rowContents}
        </button>
      ) : (
        <div style={rowStyle}>{rowContents}</div>
      )}
    </li>
  );
}
