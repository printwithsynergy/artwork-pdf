// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 M1 — Mark library picker panel.
 *
 * Surfaces a host-provided library of printer marks (crop, registration,
 * color bar, slug, other) as a browsable, filterable picker. When the
 * user clicks an entry, the panel emits the full {@link MarkLibraryEntry}
 * via `onSelect` — the host then wires that into the active page's
 * marks template (typically the `marksTemplate` field on the v3 job
 * submit request, ready for compile-pdf's marks producer).
 *
 * Loader adapter pattern: hosts wire an async function that resolves
 * to the catalogue (typically compile-pdf's `/v1/marks/catalogue`
 * endpoint when it ships, or a local JSON bundle in the meantime).
 * The editor stays free of any compile-pdf runtime dep — same approach
 * as `SwatchesPicker`, `ComplianceFindingsPanel`, `InksPanel`, etc.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";

/**
 * Discriminator on which the picker groups its entries and which
 * the compile-pdf marks producer pivots on. `"other"` is the escape
 * hatch for tenant-specific marks that don't map to the four
 * canonical print-shop buckets.
 *
 * @public
 */
export type MarkCategory = "crop" | "registration" | "color-bar" | "slug" | "other";

/**
 * One entry in the mark library. Structurally compatible with
 * compile-pdf's mark catalogue shape (subset: only the fields the
 * picker actually needs). Duplicated here so the editor stays
 * consumable without the compile-pdf SDK.
 *
 * `thumbnailDataUrl` is optional — when present, the picker renders
 * a small preview image; when absent it falls back to a text-only
 * row. `description` is the optional hover tooltip / a11y body.
 *
 * @public
 */
export type MarkLibraryEntry = {
  id: string;
  name: string;
  category: MarkCategory;
  thumbnailDataUrl?: string;
  description?: string;
};

/**
 * Host-supplied adapter. Returns the full mark catalogue. Rejects on
 * transport errors; the panel surfaces the message inline. Hosts
 * should memoize the function with `useCallback` so an unrelated
 * parent re-render doesn't trigger a spurious refetch.
 *
 * @public
 */
export type MarkLibraryLoaderFn = () => Promise<readonly MarkLibraryEntry[]>;

/**
 * Filter spec accepted by {@link filterMarks}.
 *
 * @public
 */
export type MarkLibraryFilter = {
  category?: MarkCategory;
  /** Case-insensitive substring filter on `name`. Whitespace-only
   *  values are treated as absent so a stray space doesn't blank
   *  the catalogue. */
  query?: string;
};

/**
 * Result row from {@link groupMarksByCategory}.
 *
 * @public
 */
export type MarkLibraryGroup = {
  category: MarkCategory;
  marks: readonly MarkLibraryEntry[];
};

/**
 * @public
 */
export type MarkLibraryPanelProps = {
  /** Adapter that resolves to the catalogue. The panel calls it on
   *  mount and whenever the function reference changes. */
  loader: MarkLibraryLoaderFn;
  /** Pre-filter to a single category (host-controlled, distinct from
   *  the in-panel UI search). Absent → all categories. */
  filterCategory?: MarkCategory;
  /** Id of the currently active mark — host-controlled selection
   *  affordance. The matching row renders in the "active" style. */
  activeMarkId?: string;
  /** Click callback. Hosts wire the selected entry into the active
   *  page's marks template / job submit request. */
  onSelect?: (entry: MarkLibraryEntry) => void;
};

/**
 * Canonical order mark categories render in. Crop is the
 * highest-priority press concern; "other" is the escape hatch at
 * the end.
 *
 * @public
 */
export const MARK_CATEGORY_ORDER: readonly MarkCategory[] = [
  "crop",
  "registration",
  "color-bar",
  "slug",
  "other",
];

const CATEGORY_LABELS: Record<MarkCategory, string> = {
  crop: "Crop marks",
  registration: "Registration",
  "color-bar": "Color bars",
  slug: "Slug info",
  other: "Other",
};

/**
 * Group marks by category in {@link MARK_CATEGORY_ORDER}. Returns a
 * stable five-bucket shape so renderers iterate without absent-key
 * checks. Unknown runtime categories fall into "other" rather than
 * being dropped (defensive against forward-compat catalogue
 * extensions).
 *
 * Pure function.
 *
 * @public
 */
export function groupMarksByCategory(
  marks: readonly MarkLibraryEntry[],
): readonly MarkLibraryGroup[] {
  const buckets = new Map<MarkCategory, MarkLibraryEntry[]>(
    MARK_CATEGORY_ORDER.map((c) => [c, []]),
  );
  for (const m of marks) {
    const bucket = buckets.get(m.category) ?? buckets.get("other");
    bucket?.push(m);
  }
  return MARK_CATEGORY_ORDER.map((category) => ({
    category,
    marks: buckets.get(category) ?? [],
  }));
}

/**
 * Filter marks by category / name substring. Returns a new array;
 * preserves input order. Pure function.
 *
 * @public
 */
export function filterMarks(
  marks: readonly MarkLibraryEntry[],
  filter: MarkLibraryFilter,
): readonly MarkLibraryEntry[] {
  const trimmedQuery = filter.query?.trim().toLowerCase() ?? "";
  return marks.filter((m) => {
    if (filter.category && m.category !== filter.category) return false;
    if (trimmedQuery && !m.name.toLowerCase().includes(trimmedQuery)) return false;
    return true;
  });
}

/**
 * Stateful picker that loads the host-supplied catalogue, exposes a
 * live name search, and emits the selected entry. Handles loading /
 * error / empty states inline (matches `ComplianceFindingsPanel`'s
 * adapter pattern).
 *
 * @public
 */
export function MarkLibraryPanel({
  loader,
  filterCategory,
  activeMarkId,
  onSelect,
}: MarkLibraryPanelProps): ReactElement {
  const [marks, setMarks] = useState<readonly MarkLibraryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError(null);
    setMarks(null);
    void (async () => {
      try {
        const next = await loader();
        if (disposed) return;
        setMarks(next);
      } catch (err: unknown) {
        if (disposed) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [loader]);

  const visibleGroups = useMemo(() => {
    if (!marks) return null;
    const filtered = filterMarks(marks, {
      ...(filterCategory && { category: filterCategory }),
      query,
    });
    return groupMarksByCategory(filtered);
  }, [marks, filterCategory, query]);

  if (loading) {
    return (
      <div data-testid="mark-library-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        Loading mark library…
      </div>
    );
  }
  if (error) {
    return (
      <div
        data-testid="mark-library-panel"
        role="alert"
        style={{ padding: "0.5rem", color: "#a00" }}
      >
        Couldn't load mark library: {error}
      </div>
    );
  }
  if (!visibleGroups) return <div data-testid="mark-library-panel" />;

  const totalVisible = visibleGroups.reduce((s, g) => s + g.marks.length, 0);
  return (
    <div data-testid="mark-library-panel" style={{ padding: "0.5rem" }}>
      <header style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem", flex: 1 }}>Marks ({totalVisible})</h3>
        <input
          type="search"
          placeholder="Search marks"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search marks"
          style={{ fontSize: "0.75rem", padding: "0.125rem 0.25rem" }}
        />
      </header>
      {totalVisible === 0 && (
        <div data-testid="mark-library-panel-empty" style={{ opacity: 0.6, fontSize: "0.875rem" }}>
          No marks match the current filter.
        </div>
      )}
      {visibleGroups.map((group) => {
        if (group.marks.length === 0) return null;
        return (
          <section
            key={group.category}
            data-testid={`mark-library-group-${group.category}`}
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
              {CATEGORY_LABELS[group.category]} ({group.marks.length})
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {group.marks.map((mark) => (
                <MarkLibraryRow
                  key={mark.id}
                  mark={mark}
                  isActive={mark.id === activeMarkId}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Renders one mark row. Switches between a `<button>` (when
 * `onSelect` is wired) and a static `<div>` so screen readers don't
 * announce a non-functional control. The thumbnail, when present, is
 * `aria-hidden` because the row's `aria-label` already names the
 * mark.
 *
 * Intra-package helper.
 */
function MarkLibraryRow({
  mark,
  isActive,
  onSelect,
}: {
  mark: MarkLibraryEntry;
  isActive: boolean;
  onSelect: ((m: MarkLibraryEntry) => void) | undefined;
}): ReactElement {
  const rowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    width: "100%",
    padding: "0.25rem 0.5rem",
    background: isActive ? "#e0ecff" : "transparent",
    border: isActive ? "1px solid #2563eb" : "1px solid transparent",
    borderRadius: 4,
  } as const;
  const contents = (
    <>
      {mark.thumbnailDataUrl && (
        <img
          src={mark.thumbnailDataUrl}
          alt=""
          aria-hidden="true"
          style={{
            width: 24,
            height: 24,
            objectFit: "contain",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 2,
            flexShrink: 0,
          }}
        />
      )}
      <span style={{ flex: 1, fontSize: "0.8125rem" }}>{mark.name}</span>
    </>
  );
  return (
    <li>
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(mark)}
          aria-label={mark.description ? `${mark.name} — ${mark.description}` : mark.name}
          title={mark.description}
          style={{
            ...rowStyle,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {contents}
        </button>
      ) : (
        <div style={rowStyle} title={mark.description}>
          {contents}
        </div>
      )}
    </li>
  );
}
