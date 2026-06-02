// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 X1 — Annotations sidebar.
 *
 * Companion list view to the X3 {@link AnnotationOverlay} (Wave 4
 * PR-7). The overlay renders annotation anchors on top of the canvas;
 * this sidebar surfaces the same {@link AnnotationOverlayAnnotation}
 * stream as a scrollable, filterable list so reviewers can read the
 * thread without hunting for pins.
 *
 * Controlled component: hosts pass `annotations` + the active id (the
 * same one wired into the overlay's `activeAnnotationId`), the sidebar
 * emits selection / resolve / delete callbacks. The host is the source
 * of truth — the sidebar never mutates the array.
 *
 * Two pure helpers ship alongside:
 * - {@link filterAnnotationsForSidebar} — status / author predicates.
 * - {@link sortAnnotationsByDate} — chronological / reverse-chronological.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import type { AnnotationOverlayAnnotation } from "./AnnotationOverlay";
import { describeAnnotation } from "./AnnotationOverlay";

/**
 * Status filter the sidebar pivots on. `"all"` shows both open and
 * resolved annotations; the other two narrow to a single set.
 *
 * @public
 */
export type AnnotationStatusFilter = "open" | "resolved" | "all";

/**
 * Filter spec accepted by {@link filterAnnotationsForSidebar}.
 *
 * @public
 */
export type AnnotationsSidebarFilter = {
  /** Status to keep — see {@link AnnotationStatusFilter}. Absent →
   *  treated as `"all"`. */
  status?: AnnotationStatusFilter;
  /** Case-insensitive substring filter on `author`. Whitespace-only
   *  values are treated as absent so a stray space doesn't blank the
   *  list. */
  author?: string;
};

/**
 * Configuration for the {@link AnnotationsSidebar}. The host owns
 * the annotation store and the active-id state; the sidebar only
 * renders and emits user intents (select / resolve-toggle / delete)
 * through the optional callbacks. The `annotations` array is treated
 * as immutable — the sidebar never writes back to it.
 *
 * @public
 */
export type AnnotationsSidebarProps = {
  /** Annotations to render. Typically `PageV3.annotations ?? []`. The
   *  sidebar never mutates this array. */
  annotations: readonly AnnotationOverlayAnnotation[];
  /** Id of the active annotation — the matching row renders in the
   *  "active" style. Hosts typically wire this from the overlay's
   *  `activeAnnotationId` so the two surfaces stay in lockstep. */
  activeAnnotationId?: string;
  /** Optional initial status filter. Defaults to `"open"` so the
   *  sidebar opens on actionable comments. */
  defaultStatus?: AnnotationStatusFilter;
  /** Fired when the user clicks a row. */
  onSelect?: (annotation: AnnotationOverlayAnnotation) => void;
  /** Fired when the user clicks the "Resolve" / "Reopen" toggle on
   *  a row. The host writes the flipped `resolved` flag back to its
   *  annotation store. */
  onToggleResolved?: (annotation: AnnotationOverlayAnnotation) => void;
  /** Fired when the user clicks the "Delete" affordance. The host
   *  decides whether to remove the annotation or move it to a trash
   *  bucket. */
  onDelete?: (annotation: AnnotationOverlayAnnotation) => void;
};

/**
 * Pure helper — filters annotations by status / author. Returns a
 * new array; preserves input order. Pure function.
 *
 * @public
 */
export function filterAnnotationsForSidebar(
  annotations: readonly AnnotationOverlayAnnotation[],
  filter: AnnotationsSidebarFilter,
): readonly AnnotationOverlayAnnotation[] {
  const status = filter.status ?? "all";
  const trimmedAuthor = filter.author?.trim().toLowerCase() ?? "";
  return annotations.filter((a) => {
    if (status === "open" && a.resolved === true) return false;
    if (status === "resolved" && a.resolved !== true) return false;
    if (trimmedAuthor) {
      const author = (a.author ?? "").toLowerCase();
      if (!author.includes(trimmedAuthor)) return false;
    }
    return true;
  });
}

/**
 * Pure helper — sorts annotations by `createdAt` (ISO 8601 strings
 * compare lexicographically). Returns a new array; non-mutating.
 * `"desc"` (newest first) is the convention for review surfaces.
 *
 * @public
 */
export function sortAnnotationsByDate(
  annotations: readonly AnnotationOverlayAnnotation[],
  direction: "asc" | "desc" = "desc",
): readonly AnnotationOverlayAnnotation[] {
  // Empty / missing createdAt is treated as sorting *after* anything
  // valid in descending mode (and *before* anything valid in ascending
  // mode) so a malformed entry surfaces at the tail of the review
  // pile rather than silently breaking the sort.
  const out = [...annotations];
  out.sort((a, b) => {
    const aHas = typeof a.createdAt === "string" && a.createdAt.length > 0;
    const bHas = typeof b.createdAt === "string" && b.createdAt.length > 0;
    if (!aHas && !bHas) return 0;
    if (!aHas) return direction === "desc" ? 1 : -1;
    if (!bHas) return direction === "desc" ? -1 : 1;
    if (a.createdAt === b.createdAt) return 0;
    return direction === "desc"
      ? a.createdAt < b.createdAt
        ? 1
        : -1
      : a.createdAt < b.createdAt
        ? -1
        : 1;
  });
  return out;
}

/**
 * Stateful panel — surfaces a status dropdown + an author search and
 * renders the filtered, date-sorted annotation list. Emits the host
 * callbacks on row select / resolve-toggle / delete.
 *
 * @public
 */
export function AnnotationsSidebar({
  annotations,
  activeAnnotationId,
  defaultStatus,
  onSelect,
  onToggleResolved,
  onDelete,
}: AnnotationsSidebarProps): ReactElement {
  const [status, setStatus] = useState<AnnotationStatusFilter>(defaultStatus ?? "open");
  const [authorQuery, setAuthorQuery] = useState("");

  const visible = useMemo(() => {
    const filtered = filterAnnotationsForSidebar(annotations, {
      status,
      author: authorQuery,
    });
    return sortAnnotationsByDate(filtered, "desc");
  }, [annotations, status, authorQuery]);

  return (
    <div data-testid="annotations-sidebar" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Annotations ({visible.length})</h3>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", alignItems: "center" }}>
          <label style={{ fontSize: "0.75rem" }}>
            Status
            <select
              aria-label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AnnotationStatusFilter)}
              style={{ marginLeft: "0.25rem", fontSize: "0.75rem" }}
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
          </label>
          <input
            type="search"
            aria-label="Author"
            placeholder="Filter by author"
            value={authorQuery}
            onChange={(e) => setAuthorQuery(e.target.value)}
            style={{ flex: 1, fontSize: "0.75rem", padding: "0.125rem 0.25rem" }}
          />
        </div>
      </header>
      {visible.length === 0 ? (
        <div data-testid="annotations-sidebar-empty" style={{ opacity: 0.6, fontSize: "0.875rem" }}>
          No annotations match the current filter.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {visible.map((annotation) => (
            <AnnotationRow
              key={annotation.id}
              annotation={annotation}
              isActive={annotation.id === activeAnnotationId}
              onSelect={onSelect}
              onToggleResolved={onToggleResolved}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Renders one annotation row. Intra-package helper — the row's
 * surface (kind badge + author + body + resolve / delete buttons) is
 * intentionally minimal so {@link AnnotationsSidebar} can swap it
 * without downstream consumers depending on the shape.
 */
function AnnotationRow({
  annotation,
  isActive,
  onSelect,
  onToggleResolved,
  onDelete,
}: {
  annotation: AnnotationOverlayAnnotation;
  isActive: boolean;
  onSelect: ((a: AnnotationOverlayAnnotation) => void) | undefined;
  onToggleResolved: ((a: AnnotationOverlayAnnotation) => void) | undefined;
  onDelete: ((a: AnnotationOverlayAnnotation) => void) | undefined;
}): ReactElement {
  const resolved = annotation.resolved === true;
  return (
    <li
      data-testid={`annotations-sidebar-row-${annotation.id}`}
      style={{
        padding: "0.375rem 0.5rem",
        border: `1px solid ${isActive ? "#2563eb" : "#ddd"}`,
        borderRadius: 4,
        background: isActive ? "#e0ecff" : "transparent",
        marginBottom: "0.25rem",
        opacity: resolved ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
            {describeAnnotation(annotation)}
          </div>
          <div style={{ fontSize: "0.6875rem", color: "#595959", marginTop: "0.125rem" }}>
            {annotation.author
              ? `${annotation.author} · ${annotation.createdAt}`
              : annotation.createdAt}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
          {onSelect && (
            <button
              type="button"
              onClick={() => onSelect(annotation)}
              style={{ fontSize: "0.6875rem", padding: "0.0625rem 0.375rem" }}
            >
              Focus
            </button>
          )}
          {onToggleResolved && (
            <button
              type="button"
              onClick={() => onToggleResolved(annotation)}
              style={{ fontSize: "0.6875rem", padding: "0.0625rem 0.375rem" }}
            >
              {resolved ? "Reopen" : "Resolve"}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(annotation)}
              style={{ fontSize: "0.6875rem", padding: "0.0625rem 0.375rem", color: "#a00" }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
