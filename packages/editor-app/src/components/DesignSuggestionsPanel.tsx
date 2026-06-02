// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 4 AI1 — AI design-suggestions panel.
 *
 * Surfaces a host-loader-supplied stream of AI-generated design
 * suggestions for the active document — typography hierarchy hints,
 * contrast warnings, layout balance critiques, color-harmony nudges,
 * etc. Typical suggestion sources: a synergy `design.suggest`
 * workflow node, a tenant-trained model behind the host's auth, or a
 * heuristics engine that walks the document for canned advice.
 *
 * Each suggestion carries an opaque `applyHint` bag the host knows
 * how to interpret + apply — the editor stays runtime-free of the
 * suggestion logic and only handles UI plumbing (loading, filtering
 * by category, click-to-focus, apply / dismiss).
 *
 * Sibling of {@link PreflightAutoFixPanel} (Wave 4 AI3): that one
 * remediates rule violations, this one offers proactive aesthetic
 * advice. Both follow the same loader-adapter pattern.
 *
 * @public
 */

import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";

/**
 * Discriminator on which the panel groups its suggestions and which
 * downstream renderers (mini-dashboard, "Top 3 fixes" badge, …) can
 * pivot. `"other"` is the escape hatch for tenant-specific
 * categories that don't map to the five canonical buckets.
 *
 * @public
 */
export type DesignSuggestionCategory =
  | "typography"
  | "color"
  | "layout"
  | "contrast"
  | "imagery"
  | "other";

/**
 * One AI-supplied design suggestion. The shape is intentionally
 * minimal: a stable id, a category for grouping, a one-line summary,
 * an optional long-form rationale, an opaque `applyHint` the host
 * applies, and an optional `confidence` ([0,1]) for sorting / chip
 * decoration.
 *
 * `applyHint` is forwarded to `onApply` verbatim — its shape is a
 * contract between the host's loader and its `onApply` handler. The
 * panel never inspects it.
 *
 * @public
 */
export type DesignSuggestion = {
  id: string;
  category: DesignSuggestionCategory;
  summary: string;
  description?: string;
  applyHint?: Record<string, unknown>;
  /** Loader-supplied confidence in `[0, 1]`. Optional — when absent
   *  the panel doesn't surface a confidence chip. Suggestions are
   *  grouped by category in {@link DESIGN_SUGGESTION_CATEGORY_ORDER}
   *  and keep loader-supplied order within each bucket; the panel
   *  does not re-sort by confidence or id. */
  confidence?: number;
};

/**
 * Host adapter — resolves a stream of suggestions for the active
 * document context. Resolves with a fresh list each call; rejects on
 * transport / validation errors and the panel surfaces the message
 * inline. Hosts should memoize the function with `useCallback` so an
 * unrelated parent re-render doesn't trigger a spurious refetch.
 *
 * @public
 */
export type DesignSuggestionLoaderFn = () => Promise<readonly DesignSuggestion[]>;

/**
 * Filter spec accepted by {@link filterDesignSuggestions}.
 *
 * @public
 */
export type DesignSuggestionFilter = {
  category?: DesignSuggestionCategory;
  /** Minimum confidence in `[0, 1]`. Suggestions without a
   *  `confidence` field are kept when `minConfidence` is absent or
   *  zero, and excluded when `minConfidence > 0` (no signal = drop). */
  minConfidence?: number;
};

/**
 * Result row from {@link groupDesignSuggestionsByCategory}.
 *
 * @public
 */
export type DesignSuggestionGroup = {
  category: DesignSuggestionCategory;
  suggestions: readonly DesignSuggestion[];
};

/**
 * Canonical category order — typography is the first thing a human
 * eye lands on; "other" is the escape hatch at the tail.
 *
 * @public
 */
export const DESIGN_SUGGESTION_CATEGORY_ORDER: readonly DesignSuggestionCategory[] = [
  "typography",
  "color",
  "contrast",
  "layout",
  "imagery",
  "other",
];

const CATEGORY_LABELS: Record<DesignSuggestionCategory, string> = {
  typography: "Typography",
  color: "Color",
  contrast: "Contrast",
  layout: "Layout",
  imagery: "Imagery",
  other: "Other",
};

/**
 * Pure helper — filters suggestions by category / minConfidence.
 * Returns a new array; preserves input order. Pure function.
 *
 * @public
 */
export function filterDesignSuggestions(
  suggestions: readonly DesignSuggestion[],
  filter: DesignSuggestionFilter,
): readonly DesignSuggestion[] {
  const min = filter.minConfidence ?? 0;
  return suggestions.filter((s) => {
    if (filter.category && s.category !== filter.category) return false;
    if (min > 0) {
      if (typeof s.confidence !== "number" || s.confidence < min) return false;
    }
    return true;
  });
}

/**
 * Pure helper — groups suggestions by category in
 * {@link DESIGN_SUGGESTION_CATEGORY_ORDER}. Returns a stable
 * six-bucket shape so renderers iterate without absent-key checks.
 * Unknown runtime categories fall into "other" rather than being
 * dropped (defensive against forward-compat catalogue extensions).
 *
 * Pure function.
 *
 * @public
 */
export function groupDesignSuggestionsByCategory(
  suggestions: readonly DesignSuggestion[],
): readonly DesignSuggestionGroup[] {
  const buckets = new Map<DesignSuggestionCategory, DesignSuggestion[]>(
    DESIGN_SUGGESTION_CATEGORY_ORDER.map((c) => [c, []]),
  );
  for (const s of suggestions) {
    const bucket = buckets.get(s.category) ?? buckets.get("other");
    bucket?.push(s);
  }
  return DESIGN_SUGGESTION_CATEGORY_ORDER.map((category) => ({
    category,
    suggestions: buckets.get(category) ?? [],
  }));
}

/**
 * Configuration for the {@link DesignSuggestionsPanel}. The host
 * always supplies the {@link DesignSuggestionLoaderFn}; the other
 * three props are optional and shape the panel's initial filter
 * floor and apply / dismiss wiring. Hosts that ship a high-recall
 * model can tighten the surface up-front via `defaultMinConfidence`.
 *
 * @public
 */
export type DesignSuggestionsPanelProps = {
  /** Host adapter, see {@link DesignSuggestionLoaderFn}. The panel
   *  calls it on mount and whenever the function reference changes. */
  loader: DesignSuggestionLoaderFn;
  /** Optional minimum-confidence floor for the in-panel filter
   *  (`[0, 1]`). Hosts that ship a high-recall model can default the
   *  panel to `0.5` or higher to keep the surface focused. */
  defaultMinConfidence?: number;
  /** Fired when the user clicks "Apply" on a suggestion. The host
   *  inspects `suggestion.applyHint` and mutates the document. */
  onApply?: (suggestion: DesignSuggestion) => void;
  /** Fired when the user clicks "Dismiss" on a suggestion. The host
   *  typically writes the id into a per-document dismissed set so
   *  the suggestion doesn't reappear on the next load. */
  onDismiss?: (suggestion: DesignSuggestion) => void;
};

/**
 * Stateful panel — loads the suggestion stream on mount, exposes a
 * category filter + min-confidence slider, and emits `onApply` /
 * `onDismiss`. Handles loading / error / empty states inline.
 *
 * @public
 */
export function DesignSuggestionsPanel({
  loader,
  defaultMinConfidence,
  onApply,
  onDismiss,
}: DesignSuggestionsPanelProps): ReactElement {
  const [suggestions, setSuggestions] = useState<readonly DesignSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<DesignSuggestionCategory | "all">("all");
  const [minConfidence, setMinConfidence] = useState(defaultMinConfidence ?? 0);

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError(null);
    setSuggestions(null);
    void (async () => {
      try {
        const next = await loader();
        if (disposed) return;
        setSuggestions(next);
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
    if (!suggestions) return null;
    const filtered = filterDesignSuggestions(suggestions, {
      ...(category !== "all" && { category }),
      minConfidence,
    });
    return groupDesignSuggestionsByCategory(filtered);
  }, [suggestions, category, minConfidence]);

  if (loading) {
    return (
      <div data-testid="design-suggestions-panel" style={{ padding: "0.5rem", opacity: 0.6 }}>
        Loading suggestions…
      </div>
    );
  }
  if (error) {
    return (
      <div
        data-testid="design-suggestions-panel"
        role="alert"
        style={{ padding: "0.5rem", color: "#a00" }}
      >
        Couldn't load design suggestions: {error}
      </div>
    );
  }
  if (!visibleGroups) return <div data-testid="design-suggestions-panel" />;

  const totalVisible = visibleGroups.reduce((s, g) => s + g.suggestions.length, 0);
  return (
    <div data-testid="design-suggestions-panel" style={{ padding: "0.5rem" }}>
      <header style={{ marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Design suggestions ({totalVisible})</h3>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", alignItems: "center" }}>
          <label style={{ fontSize: "0.75rem" }}>
            Category
            <select
              aria-label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as DesignSuggestionCategory | "all")}
              style={{ marginLeft: "0.25rem", fontSize: "0.75rem" }}
            >
              <option value="all">All</option>
              {DESIGN_SUGGESTION_CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: "0.75rem", flex: 1 }}>
            Min confidence: {minConfidence.toFixed(2)}
            <input
              type="range"
              aria-label="Min confidence"
              min={0}
              max={1}
              step={0.05}
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              style={{ display: "block", width: "100%" }}
            />
          </label>
        </div>
      </header>
      {totalVisible === 0 && (
        <div
          data-testid="design-suggestions-panel-empty"
          style={{ opacity: 0.6, fontSize: "0.875rem" }}
        >
          No suggestions match the current filter.
        </div>
      )}
      {visibleGroups.map((group) => {
        if (group.suggestions.length === 0) return null;
        return (
          <section
            key={group.category}
            data-testid={`design-suggestions-group-${group.category}`}
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
              {CATEGORY_LABELS[group.category]} ({group.suggestions.length})
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {group.suggestions.map((s) => (
                <DesignSuggestionRow
                  key={s.id}
                  suggestion={s}
                  onApply={onApply}
                  onDismiss={onDismiss}
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
 * Renders one suggestion row inside a category group. Intra-package
 * helper — the row's surface is intentionally minimal (summary +
 * optional description + optional confidence chip + apply / dismiss
 * buttons) so {@link DesignSuggestionsPanel} can swap it without
 * downstream consumers depending on the shape.
 */
function DesignSuggestionRow({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: DesignSuggestion;
  onApply: ((s: DesignSuggestion) => void) | undefined;
  onDismiss: ((s: DesignSuggestion) => void) | undefined;
}): ReactElement {
  return (
    <li
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "flex-start",
        padding: "0.375rem 0.5rem",
        border: "1px solid #ddd",
        borderRadius: 4,
        marginBottom: "0.25rem",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{suggestion.summary}</div>
        {suggestion.description && (
          <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.125rem" }}>
            {suggestion.description}
          </div>
        )}
        {typeof suggestion.confidence === "number" && (
          <div style={{ fontSize: "0.6875rem", color: "#595959", marginTop: "0.125rem" }}>
            confidence {suggestion.confidence.toFixed(2)}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
        {onApply && (
          <button
            type="button"
            onClick={() => onApply(suggestion)}
            style={{ fontSize: "0.75rem", padding: "0.125rem 0.5rem" }}
          >
            Apply
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(suggestion)}
            style={{ fontSize: "0.75rem", padding: "0.125rem 0.5rem" }}
          >
            Dismiss
          </button>
        )}
      </div>
    </li>
  );
}
