// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { BrandAsset, BrandAssetKind, BrandAssetsPanelProps } from "./BrandAssetsPanel";
import { filterBrandAssets, groupBrandAssetsByKind } from "./BrandAssetsPanel";

/**
 * Contract tests for BrandAssetsPanel (Wave 4 B1).
 *
 * DOM behaviour (filter input, kind chips, asset rows) lands when
 * the editor adopts RTL. These tests pin the wire shape so hosts
 * wiring `DocumentV3.brandAssets` into the panel have a stable
 * contract.
 */

const LOGO: BrandAsset = {
  id: "logo-primary",
  hash: "a".repeat(64),
  name: "Acme Primary Logo",
  kind: "logo",
  mimeType: "image/svg+xml",
  sourceUrl: "https://cdn.acme.com/logo.svg",
};

const SWATCH: BrandAsset = {
  id: "swatch-brand-blue",
  hash: "b".repeat(64),
  name: "Brand Blue",
  kind: "swatch",
};

const TYPOGRAPHY: BrandAsset = {
  id: "type-headline",
  hash: "c".repeat(64),
  name: "Acme Headline",
  kind: "typography",
};

const ALL_ASSETS: readonly BrandAsset[] = [LOGO, SWATCH, TYPOGRAPHY];

describe("BrandAsset type", () => {
  it("requires id, hash, name, kind; mimeType + sourceUrl optional", () => {
    expect(LOGO.mimeType).toBe("image/svg+xml");
    expect(LOGO.sourceUrl).toBeDefined();
    expect(SWATCH.mimeType).toBeUndefined();
    expect(SWATCH.sourceUrl).toBeUndefined();
  });

  it("enumerates the brand-consistency buckets", () => {
    const logo: BrandAssetKind = "logo";
    const swatch: BrandAssetKind = "swatch";
    const typography: BrandAssetKind = "typography";
    const graphicStyle: BrandAssetKind = "graphic-style";
    const other: BrandAssetKind = "other";
    expect([logo, swatch, typography, graphicStyle, other]).toHaveLength(5);
  });
});

describe("BrandAssetsPanelProps type", () => {
  it("requires assets array; onSelect + filterKind optional", () => {
    const props: BrandAssetsPanelProps = {
      assets: ALL_ASSETS,
    };
    expect(props.assets).toHaveLength(3);
    expect(props.onSelect).toBeUndefined();
    expect(props.filterKind).toBeUndefined();
  });

  it("accepts onSelect callback + filterKind", () => {
    let lastSelected: BrandAsset | undefined;
    const props: BrandAssetsPanelProps = {
      assets: ALL_ASSETS,
      onSelect: (asset) => {
        lastSelected = asset;
      },
      filterKind: "logo",
    };
    props.onSelect?.(LOGO);
    expect(lastSelected?.id).toBe("logo-primary");
    expect(props.filterKind).toBe("logo");
  });
});

describe("groupBrandAssetsByKind", () => {
  it("groups assets by kind in registry-canonical order", () => {
    const groups = groupBrandAssetsByKind(ALL_ASSETS);
    expect(groups.map((g) => g.kind)).toEqual([
      "logo",
      "swatch",
      "typography",
      "graphic-style",
      "other",
    ]);
    expect(groups[0]?.assets).toHaveLength(1);
    expect(groups[1]?.assets).toHaveLength(1);
    expect(groups[2]?.assets).toHaveLength(1);
    expect(groups[3]?.assets).toHaveLength(0);
    expect(groups[4]?.assets).toHaveLength(0);
  });

  it("returns five buckets even for an empty input (stable shape)", () => {
    const groups = groupBrandAssetsByKind([]);
    expect(groups).toHaveLength(5);
    expect(groups.every((g) => g.assets.length === 0)).toBe(true);
  });

  it("falls back unknown runtime kinds into the 'other' bucket", () => {
    // JSON loads from external sources could carry kinds the TS union
    // doesn't know about — those land in "other" rather than vanishing.
    const rogue = {
      id: "rogue",
      hash: "z".repeat(64),
      name: "Unknown-kind asset",
      kind: "videos" as BrandAssetKind, // forced — simulates wire drift
    };
    const groups = groupBrandAssetsByKind([LOGO, rogue]);
    const other = groups.find((g) => g.kind === "other");
    expect(other?.assets.map((a) => a.id)).toContain("rogue");
  });
});

describe("filterBrandAssets", () => {
  it("filters by kind exactly", () => {
    const filtered = filterBrandAssets(ALL_ASSETS, { kind: "logo" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("logo-primary");
  });

  it("filters by case-insensitive substring on name", () => {
    const filtered = filterBrandAssets(ALL_ASSETS, { query: "acme" });
    expect(filtered.map((a) => a.id).sort()).toEqual(["logo-primary", "type-headline"]);
  });

  it("combines kind + query (AND)", () => {
    const filtered = filterBrandAssets(ALL_ASSETS, { kind: "logo", query: "primary" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("logo-primary");
  });

  it("returns the whole list when no filters are set", () => {
    expect(filterBrandAssets(ALL_ASSETS, {})).toHaveLength(3);
  });

  it("returns empty when no asset matches", () => {
    expect(filterBrandAssets(ALL_ASSETS, { query: "nope" })).toEqual([]);
  });

  it("ignores empty / whitespace-only query strings", () => {
    expect(filterBrandAssets(ALL_ASSETS, { query: "" })).toHaveLength(3);
    expect(filterBrandAssets(ALL_ASSETS, { query: "   " })).toHaveLength(3);
  });
});
