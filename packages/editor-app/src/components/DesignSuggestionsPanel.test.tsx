// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type {
  DesignSuggestion,
  DesignSuggestionCategory,
  DesignSuggestionLoaderFn,
  DesignSuggestionsPanelProps,
} from "./DesignSuggestionsPanel";
import {
  DESIGN_SUGGESTION_CATEGORY_ORDER,
  filterDesignSuggestions,
  groupDesignSuggestionsByCategory,
} from "./DesignSuggestionsPanel";

/**
 * Contract tests for DesignSuggestionsPanel (Wave 4 AI1).
 *
 * DOM behaviour (loading state, error rendering, apply / dismiss
 * button clicks) lands when the editor adopts RTL. These tests pin
 * the wire shape so hosts wiring an AI / heuristics suggestion
 * adapter (or the synergy `design.suggest` node) have a stable
 * contract, plus the two pure helpers downstream renderers reuse.
 */

const HEADLINE_WEIGHT: DesignSuggestion = {
  id: "type-1",
  category: "typography",
  summary: "Lower the headline weight by one step for cleaner hierarchy.",
  confidence: 0.78,
};
const LOW_CONTRAST: DesignSuggestion = {
  id: "contrast-1",
  category: "contrast",
  summary: "Raise the logo / photo contrast to ≥4.5:1 (WCAG AA).",
  description: "Currently 2.9:1 over the photo backdrop.",
  confidence: 0.92,
};
const COLOR_HARMONY: DesignSuggestion = {
  id: "color-1",
  category: "color",
  summary: "Anchor accent color to PANTONE 185 C to match brand kit.",
  confidence: 0.55,
};
const NO_CONFIDENCE: DesignSuggestion = {
  id: "layout-1",
  category: "layout",
  summary: "Tighten the right margin by 4mm so the optical center aligns.",
};

const ALL = [HEADLINE_WEIGHT, LOW_CONTRAST, COLOR_HARMONY, NO_CONFIDENCE] as const;

describe("DESIGN_SUGGESTION_CATEGORY_ORDER", () => {
  it("enumerates the six canonical buckets in the canonical order", () => {
    expect(DESIGN_SUGGESTION_CATEGORY_ORDER).toEqual([
      "typography",
      "color",
      "contrast",
      "layout",
      "imagery",
      "other",
    ]);
  });
});

describe("DesignSuggestion type", () => {
  it("requires id + category + summary; description/applyHint/confidence optional", () => {
    expect(NO_CONFIDENCE.confidence).toBeUndefined();
    expect(HEADLINE_WEIGHT.description).toBeUndefined();
    expect(LOW_CONTRAST.description).toBeDefined();
  });

  it("category enumerates the six canonical buckets", () => {
    const t: DesignSuggestionCategory = "typography";
    const c: DesignSuggestionCategory = "color";
    const cr: DesignSuggestionCategory = "contrast";
    const l: DesignSuggestionCategory = "layout";
    const i: DesignSuggestionCategory = "imagery";
    const o: DesignSuggestionCategory = "other";
    expect([t, c, cr, l, i, o]).toHaveLength(6);
  });
});

describe("DesignSuggestionLoaderFn type", () => {
  it("is an async function returning a readonly suggestions array", async () => {
    const loader: DesignSuggestionLoaderFn = async () => ALL;
    const out = await loader();
    expect(out).toHaveLength(4);
    expect(out[0]?.id).toBe("type-1");
  });
});

describe("filterDesignSuggestions", () => {
  it("returns all suggestions for an empty filter", () => {
    expect(filterDesignSuggestions(ALL, {})).toHaveLength(4);
  });

  it("filters by category exactly", () => {
    expect(filterDesignSuggestions(ALL, { category: "contrast" })).toHaveLength(1);
  });

  it("filters by minConfidence and keeps confidence-less rows when min is 0", () => {
    const r = filterDesignSuggestions(ALL, { minConfidence: 0 });
    expect(r).toHaveLength(4);
  });

  it("filters by minConfidence > 0, dropping confidence-less rows", () => {
    const r = filterDesignSuggestions(ALL, { minConfidence: 0.7 });
    expect(r.map((s) => s.id)).toEqual(["type-1", "contrast-1"]);
  });

  it("combines category + minConfidence (AND)", () => {
    const r = filterDesignSuggestions(ALL, { category: "color", minConfidence: 0.7 });
    expect(r).toEqual([]);
  });
});

describe("groupDesignSuggestionsByCategory", () => {
  it("groups suggestions in canonical category order with stable six-bucket shape", () => {
    const groups = groupDesignSuggestionsByCategory(ALL);
    expect(groups.map((g) => g.category)).toEqual([
      "typography",
      "color",
      "contrast",
      "layout",
      "imagery",
      "other",
    ]);
    expect(groups[0]?.suggestions).toHaveLength(1);
    expect(groups[1]?.suggestions).toHaveLength(1);
    expect(groups[2]?.suggestions).toHaveLength(1);
    expect(groups[3]?.suggestions).toHaveLength(1);
    expect(groups[4]?.suggestions).toHaveLength(0);
    expect(groups[5]?.suggestions).toHaveLength(0);
  });

  it("returns six buckets even for empty input", () => {
    const groups = groupDesignSuggestionsByCategory([]);
    expect(groups).toHaveLength(6);
    expect(groups.every((g) => g.suggestions.length === 0)).toBe(true);
  });

  it("preserves entry order within a category bucket", () => {
    const a: DesignSuggestion = { id: "a", category: "typography", summary: "A" };
    const b: DesignSuggestion = { id: "b", category: "typography", summary: "B" };
    const groups = groupDesignSuggestionsByCategory([a, b]);
    expect(groups[0]?.suggestions.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("DesignSuggestionsPanelProps type", () => {
  it("requires loader; defaults / callbacks optional", () => {
    const props: DesignSuggestionsPanelProps = {
      loader: async () => [],
    };
    expect(props.onApply).toBeUndefined();
    expect(props.onDismiss).toBeUndefined();
    expect(props.defaultMinConfidence).toBeUndefined();
  });

  it("accepts the full optional surface", () => {
    let applied: string | undefined;
    let dismissed: string | undefined;
    const props: DesignSuggestionsPanelProps = {
      loader: async () => ALL,
      defaultMinConfidence: 0.5,
      onApply: (s) => {
        applied = s.id;
      },
      onDismiss: (s) => {
        dismissed = s.id;
      },
    };
    props.onApply?.(HEADLINE_WEIGHT);
    props.onDismiss?.(COLOR_HARMONY);
    expect(applied).toBe("type-1");
    expect(dismissed).toBe("color-1");
  });
});
