// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/**
 * Wave 3 G1 — Nutrition Facts label generator.
 *
 * The FDA Nutrition Facts label (21 CFR §101.9, 2016 revision) has a
 * highly-regulated layout: serving size + servings per container at
 * the top, Calories in 22-pt bold, then a fixed-order list of
 * nutrients with their amounts + % Daily Value. The panel handles
 * data entry; the {@link composeNutritionFacts} helper turns the
 * typed data into an ordered list of rows the host renders into the
 * canvas (text + bold flags + indentation level) — keeping the
 * editor free of any specific PDF text-layout backend and letting
 * server renderers (compile-pdf, codex-pdf) own the canonical typesetting.
 *
 * Daily Value % is computed from the 2016 FDA Reference Daily Intake
 * (RDI) / Daily Reference Value (DRV) tables; values are widely
 * published and trademark-free.
 *
 * @public
 */
import { useState } from "react";

/**
 * Typed Nutrition Facts data. All fields are per serving except
 * `servingSize` (human-readable, e.g. `"2/3 cup (55g)"`) and
 * `servingsPerContainer`. Numeric fields are in the units the FDA
 * panel declares (grams for macronutrients, milligrams for sodium /
 * cholesterol, micrograms for vitamin D).
 *
 * Optional fields are omitted from the rendered output entirely
 * (different from `0`, which renders as "0g" / "0%").
 *
 * @public
 */
export type NutritionFacts = {
  servingSize: string;
  servingsPerContainer: number;
  calories: number;
  totalFatG: number;
  saturatedFatG: number;
  transFatG: number;
  cholesterolMg: number;
  sodiumMg: number;
  totalCarbohydrateG: number;
  dietaryFiberG: number;
  totalSugarsG: number;
  addedSugarsG?: number;
  proteinG: number;
  vitaminDMcg?: number;
  calciumMg?: number;
  ironMg?: number;
  potassiumMg?: number;
};

/**
 * 2016 FDA Daily Reference Values (DRV) and Reference Daily Intakes
 * (RDI) used to compute the % Daily Value column. Public-domain
 * regulatory data — re-exported so server renderers can use the
 * same constants and stay in sync.
 *
 * @public
 */
export const FDA_DAILY_VALUES = {
  totalFatG: 78,
  saturatedFatG: 20,
  cholesterolMg: 300,
  sodiumMg: 2300,
  totalCarbohydrateG: 275,
  dietaryFiberG: 28,
  addedSugarsG: 50,
  vitaminDMcg: 20,
  calciumMg: 1300,
  ironMg: 18,
  potassiumMg: 4700,
} as const;

/**
 * One row in the composed nutrition panel spec. `indent` ≥ 1 means
 * the row is a sub-nutrient (e.g. saturated fat under total fat) —
 * hosts typically render indented and not bold. `bold` matches the
 * FDA layout: panel header, "Calories", and section-leading nutrient
 * names are bold.
 *
 * @public
 */
export type NutritionRow = {
  label: string;
  amount: string;
  dvPct?: number;
  indent: 0 | 1;
  bold: boolean;
};

/**
 * Output of {@link composeNutritionFacts}. `rows` is the ordered
 * list the host renders top-to-bottom; `caloriesLine` is surfaced
 * separately because the FDA layout sets calories at ~22 pt while
 * everything else is at body-text size.
 *
 * @public
 */
export type NutritionPanelSpec = {
  servingSize: string;
  servingsLine: string;
  caloriesLine: string;
  rows: NutritionRow[];
};

function dvPct(amount: number, dv: number | undefined): number | undefined {
  if (dv === undefined || dv <= 0) return undefined;
  return Math.round((amount / dv) * 100);
}

/**
 * Build a {@link NutritionRow}, omitting the `dvPct` key entirely
 * when no DV is defined. Required because `dvPct` is declared as an
 * optional property under `exactOptionalPropertyTypes`; assigning
 * `dvPct: undefined` does not satisfy the type, so the helper
 * branches the object shape.
 */
function row(
  label: string,
  amount: string,
  pct: number | undefined,
  indent: 0 | 1,
  bold: boolean,
): NutritionRow {
  return pct !== undefined
    ? { label, amount, dvPct: pct, indent, bold }
    : { label, amount, indent, bold };
}

/**
 * Compose the ordered row list for an FDA-style Nutrition Facts
 * panel from a {@link NutritionFacts} record. Pure function —
 * exported so RSC / Astro-frontmatter callers can pre-compute the
 * spec without bundling the panel.
 *
 * Row order matches §101.9(c) exactly: Total Fat, Saturated Fat,
 * Trans Fat, Cholesterol, Sodium, Total Carbohydrate, Dietary
 * Fiber, Total Sugars, Added Sugars, Protein, then the
 * micronutrient block (Vitamin D, Calcium, Iron, Potassium).
 *
 * @public
 */
export function composeNutritionFacts(facts: NutritionFacts): NutritionPanelSpec {
  const rows: NutritionRow[] = [
    row(
      "Total Fat",
      `${facts.totalFatG}g`,
      dvPct(facts.totalFatG, FDA_DAILY_VALUES.totalFatG),
      0,
      true,
    ),
    row(
      "Saturated Fat",
      `${facts.saturatedFatG}g`,
      dvPct(facts.saturatedFatG, FDA_DAILY_VALUES.saturatedFatG),
      1,
      false,
    ),
    row("Trans Fat", `${facts.transFatG}g`, undefined, 1, false),
    row(
      "Cholesterol",
      `${facts.cholesterolMg}mg`,
      dvPct(facts.cholesterolMg, FDA_DAILY_VALUES.cholesterolMg),
      0,
      true,
    ),
    row("Sodium", `${facts.sodiumMg}mg`, dvPct(facts.sodiumMg, FDA_DAILY_VALUES.sodiumMg), 0, true),
    row(
      "Total Carbohydrate",
      `${facts.totalCarbohydrateG}g`,
      dvPct(facts.totalCarbohydrateG, FDA_DAILY_VALUES.totalCarbohydrateG),
      0,
      true,
    ),
    row(
      "Dietary Fiber",
      `${facts.dietaryFiberG}g`,
      dvPct(facts.dietaryFiberG, FDA_DAILY_VALUES.dietaryFiberG),
      1,
      false,
    ),
    row("Total Sugars", `${facts.totalSugarsG}g`, undefined, 1, false),
  ];
  if (facts.addedSugarsG !== undefined) {
    rows.push(
      row(
        "Includes Added Sugars",
        `${facts.addedSugarsG}g`,
        dvPct(facts.addedSugarsG, FDA_DAILY_VALUES.addedSugarsG),
        1,
        false,
      ),
    );
  }
  rows.push(row("Protein", `${facts.proteinG}g`, undefined, 0, true));
  if (facts.vitaminDMcg !== undefined) {
    rows.push(
      row(
        "Vitamin D",
        `${facts.vitaminDMcg}mcg`,
        dvPct(facts.vitaminDMcg, FDA_DAILY_VALUES.vitaminDMcg),
        0,
        false,
      ),
    );
  }
  if (facts.calciumMg !== undefined) {
    rows.push(
      row(
        "Calcium",
        `${facts.calciumMg}mg`,
        dvPct(facts.calciumMg, FDA_DAILY_VALUES.calciumMg),
        0,
        false,
      ),
    );
  }
  if (facts.ironMg !== undefined) {
    rows.push(
      row("Iron", `${facts.ironMg}mg`, dvPct(facts.ironMg, FDA_DAILY_VALUES.ironMg), 0, false),
    );
  }
  if (facts.potassiumMg !== undefined) {
    rows.push(
      row(
        "Potassium",
        `${facts.potassiumMg}mg`,
        dvPct(facts.potassiumMg, FDA_DAILY_VALUES.potassiumMg),
        0,
        false,
      ),
    );
  }
  return {
    servingSize: facts.servingSize,
    servingsLine: `${facts.servingsPerContainer} servings per container`,
    caloriesLine: `Calories ${facts.calories}`,
    rows,
  };
}

// Required-field defaults only. Optional nutrients (Added Sugars,
// Vitamin D, Calcium, Iron, Potassium) are intentionally left absent
// so hosts that don't want those rows aren't forced to pass
// `undefined` overrides — `composeNutritionFacts` already omits any
// optional field that's not set.
const DEFAULT_FACTS: NutritionFacts = {
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

const OPTIONAL_NUTRITION_KEYS = new Set<keyof NutritionFacts>([
  "addedSugarsG",
  "vitaminDMcg",
  "calciumMg",
  "ironMg",
  "potassiumMg",
]);

/**
 * @public
 */
export type NutritionPanelProps = {
  /** Initial values seeded into the form. Defaults to the
   *  illustrative FDA-example values. */
  initialFacts?: Partial<NutritionFacts>;
  /** Fired when the user clicks "Compose" with the spec built from
   *  the current form state. The host places it on the canvas as a
   *  text block. */
  onCompose: (spec: NutritionPanelSpec) => void;
};

/**
 * Nutrition Facts data-entry panel. Surfaces the FDA panel's
 * mandatory fields (serving size, servings, calories, macros) plus
 * the optional micronutrient block. Click **Compose** and the host
 * receives the resolved {@link NutritionPanelSpec} via `onCompose`.
 *
 * @public
 */
export function NutritionPanel({ initialFacts, onCompose }: NutritionPanelProps) {
  const [facts, setFacts] = useState<NutritionFacts>({ ...DEFAULT_FACTS, ...initialFacts });

  function setNum<K extends keyof NutritionFacts>(key: K, value: NutritionFacts[K]) {
    setFacts((f) => ({ ...f, [key]: value }));
  }

  function clearOptional<K extends keyof NutritionFacts>(key: K) {
    setFacts((f) => {
      const { [key]: _dropped, ...rest } = f;
      return rest as NutritionFacts;
    });
  }

  function numInput<K extends keyof NutritionFacts>(label: string, key: K, unit: string) {
    const isOptional = OPTIONAL_NUTRITION_KEYS.has(key);
    const current = facts[key] as number | undefined;
    return (
      <label style={{ display: "block", marginBottom: "0.25rem" }}>
        {label}
        <input
          type="number"
          value={current ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (isOptional && raw === "") {
              clearOptional(key);
              return;
            }
            const v = Number(raw);
            setNum(key, (Number.isNaN(v) ? 0 : v) as NutritionFacts[K]);
          }}
          aria-label={label}
          style={{ marginLeft: "0.5rem", width: "5em" }}
        />{" "}
        {unit}
      </label>
    );
  }

  return (
    <div data-testid="nutrition-panel" style={{ padding: "0.5rem", maxWidth: "24em" }}>
      <h3 style={{ margin: "0 0 0.5rem 0" }}>Nutrition Facts</h3>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Serving size
        <input
          type="text"
          value={facts.servingSize}
          onChange={(e) => setFacts((f) => ({ ...f, servingSize: e.target.value }))}
          aria-label="Serving size"
          style={{ marginLeft: "0.5rem", width: "14em" }}
        />
      </label>
      {numInput("Servings per container", "servingsPerContainer", "")}
      {numInput("Calories", "calories", "kcal")}
      {numInput("Total Fat", "totalFatG", "g")}
      {numInput("Saturated Fat", "saturatedFatG", "g")}
      {numInput("Trans Fat", "transFatG", "g")}
      {numInput("Cholesterol", "cholesterolMg", "mg")}
      {numInput("Sodium", "sodiumMg", "mg")}
      {numInput("Total Carbohydrate", "totalCarbohydrateG", "g")}
      {numInput("Dietary Fiber", "dietaryFiberG", "g")}
      {numInput("Total Sugars", "totalSugarsG", "g")}
      {numInput("Added Sugars (optional, leave blank to omit)", "addedSugarsG", "g")}
      {numInput("Protein", "proteinG", "g")}
      {numInput("Vitamin D (optional)", "vitaminDMcg", "mcg")}
      {numInput("Calcium (optional)", "calciumMg", "mg")}
      {numInput("Iron (optional)", "ironMg", "mg")}
      {numInput("Potassium (optional)", "potassiumMg", "mg")}
      <button
        type="button"
        onClick={() => onCompose(composeNutritionFacts(facts))}
        style={{ padding: "0.4rem 0.8rem", marginTop: "0.5rem" }}
      >
        Compose
      </button>
    </div>
  );
}
