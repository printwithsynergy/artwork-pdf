// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  FDA_DAILY_VALUES,
  type NutritionFacts,
  type NutritionPanelProps,
  type NutritionPanelSpec,
  composeNutritionFacts,
} from "./NutritionPanel";

// Tests for the FDA Nutrition Facts composer. The DV math is the
// risky bit (rounding direction, omission rules for nutrients
// without a DV); the row-ordering invariant matches §101.9(c).

const minimal: NutritionFacts = {
  servingSize: "1 cup (240g)",
  servingsPerContainer: 4,
  calories: 230,
  totalFatG: 8,
  saturatedFatG: 1,
  transFatG: 0,
  cholesterolMg: 0,
  sodiumMg: 160,
  totalCarbohydrateG: 37,
  dietaryFiberG: 4,
  totalSugarsG: 12,
  proteinG: 3,
};

describe("FDA_DAILY_VALUES", () => {
  it("matches the 2016 FDA reference values", () => {
    expect(FDA_DAILY_VALUES.totalFatG).toBe(78);
    expect(FDA_DAILY_VALUES.sodiumMg).toBe(2300);
    expect(FDA_DAILY_VALUES.addedSugarsG).toBe(50);
    expect(FDA_DAILY_VALUES.potassiumMg).toBe(4700);
  });
});

describe("composeNutritionFacts", () => {
  it("emits the canonical §101.9(c) row order", () => {
    const spec = composeNutritionFacts(minimal);
    const labels = spec.rows.map((r) => r.label);
    expect(labels).toEqual([
      "Total Fat",
      "Saturated Fat",
      "Trans Fat",
      "Cholesterol",
      "Sodium",
      "Total Carbohydrate",
      "Dietary Fiber",
      "Total Sugars",
      "Protein",
    ]);
  });

  it("rounds DV% to the nearest integer", () => {
    const spec = composeNutritionFacts(minimal);
    const totalFat = spec.rows.find((r) => r.label === "Total Fat");
    expect(totalFat?.dvPct).toBe(Math.round((8 / 78) * 100));
  });

  it("omits dvPct on rows without a DV (Trans Fat, Total Sugars, Protein)", () => {
    const spec = composeNutritionFacts(minimal);
    const transFat = spec.rows.find((r) => r.label === "Trans Fat");
    const totalSugars = spec.rows.find((r) => r.label === "Total Sugars");
    const protein = spec.rows.find((r) => r.label === "Protein");
    expect(transFat?.dvPct).toBeUndefined();
    expect(totalSugars?.dvPct).toBeUndefined();
    expect(protein?.dvPct).toBeUndefined();
  });

  it("appends Added Sugars only when present and includes its DV%", () => {
    expect(
      composeNutritionFacts(minimal).rows.find((r) => r.label === "Includes Added Sugars"),
    ).toBeUndefined();
    const withAdded = composeNutritionFacts({ ...minimal, addedSugarsG: 10 });
    const added = withAdded.rows.find((r) => r.label === "Includes Added Sugars");
    expect(added?.dvPct).toBe(20);
  });

  it("appends the micronutrient block only for fields that are supplied", () => {
    const withMicros = composeNutritionFacts({
      ...minimal,
      vitaminDMcg: 2,
      calciumMg: 260,
      ironMg: 8,
      potassiumMg: 240,
    });
    const labels = withMicros.rows.map((r) => r.label);
    expect(labels).toContain("Vitamin D");
    expect(labels).toContain("Calcium");
    expect(labels).toContain("Iron");
    expect(labels).toContain("Potassium");
  });

  it("formats the calories + servings header strings", () => {
    const spec = composeNutritionFacts(minimal);
    expect(spec.caloriesLine).toBe("Calories 230");
    expect(spec.servingsLine).toBe("4 servings per container");
    expect(spec.servingSize).toBe("1 cup (240g)");
  });

  it("flags primary nutrient rows as bold and sub-nutrients as indented", () => {
    const spec = composeNutritionFacts(minimal);
    const totalFat = spec.rows.find((r) => r.label === "Total Fat");
    const satFat = spec.rows.find((r) => r.label === "Saturated Fat");
    expect(totalFat?.bold).toBe(true);
    expect(totalFat?.indent).toBe(0);
    expect(satFat?.bold).toBe(false);
    expect(satFat?.indent).toBe(1);
  });
});

describe("NutritionPanelProps contract", () => {
  it("accepts uncontrolled-mode onCompose; initialFacts is optional", () => {
    const props: NutritionPanelProps = {
      onCompose: (_spec: NutritionPanelSpec) => {},
    };
    expect(props.initialFacts).toBeUndefined();
  });

  it("accepts controlled-mode value + onChange", () => {
    let last: NutritionFacts | null = null;
    const props: NutritionPanelProps = {
      value: minimal,
      onChange: (next) => {
        last = next;
      },
    };
    expect(props.value).toEqual(minimal);
    props.onChange?.({ ...minimal, calories: 999 });
    expect(last!.calories).toBe(999);
  });
});
