// Nutrition model — turns USDA per-100g ingredient data + a recipe's measures into
// a per-serving nutrition panel, and rolls panels up for the weekly report.
//
// Data source is the USDA FoodData Central database (real measured values), stored
// per ingredient as `Ingredient.nutritionJson` by scripts/nutrition.ts, with a
// curated USDA-derived fallback in nutrition-data.ts for anything not yet backfilled.
// The numbers are still an estimate at the plan level because converting free-text
// measures ("2 cups", "1 onion") to grams is approximate — we label them as such.

import { parseMeasure } from "@/lib/measure-parser";

// A nutrient panel. Energy in kcal; macros in grams; minerals/vitamins in their
// conventional units (mg, except vitamin A/D in µg). All optional except the macros
// so a partial ingredient record still contributes what it has.
export interface NutritionPanel {
  kcal: number;
  protein: number; // g
  fat: number; // g
  carb: number; // g
  fiber: number; // g
  sugar: number; // g
  satFat: number; // g
  sodium: number; // mg
  calcium: number; // mg
  iron: number; // mg
  potassium: number; // mg
  vitaminC: number; // mg
  vitaminA: number; // µg RAE
  vitaminD: number; // µg
  cholesterol: number; // mg
}

export const NUTRIENT_KEYS: (keyof NutritionPanel)[] = [
  "kcal", "protein", "fat", "carb", "fiber", "sugar", "satFat",
  "sodium", "calcium", "iron", "potassium", "vitaminC", "vitaminA", "vitaminD", "cholesterol",
];

// Per-100g nutrient values for one ingredient, plus the hints needed to turn a
// free-text measure into grams. `portions` mirrors USDA foodPortions.
export interface IngredientNutrition {
  source: "fdc" | "curated";
  per100g: Partial<NutritionPanel>;
  gramsEach?: number; // grams for one countable unit ("1 onion", "1 clove")
  density?: number; // g/ml for volume measures (water ≈ 1, oil ≈ 0.92)
  fdcId?: number;
  desc?: string;
  portions?: { amount: number; unit?: string; modifier?: string; grams: number }[];
}

export function emptyPanel(): NutritionPanel {
  return {
    kcal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sugar: 0, satFat: 0,
    sodium: 0, calcium: 0, iron: 0, potassium: 0, vitaminC: 0, vitaminA: 0, vitaminD: 0, cholesterol: 0,
  };
}

export function addPanels(a: NutritionPanel, b: NutritionPanel): NutritionPanel {
  const out = emptyPanel();
  for (const k of NUTRIENT_KEYS) out[k] = a[k] + b[k];
  return out;
}

export function scalePanel(p: NutritionPanel, factor: number): NutritionPanel {
  const out = emptyPanel();
  for (const k of NUTRIENT_KEYS) out[k] = p[k] * factor;
  return out;
}

export function roundPanel(p: NutritionPanel): NutritionPanel {
  const out = emptyPanel();
  for (const k of NUTRIENT_KEYS) {
    // Keep one decimal for the small-magnitude micros, whole numbers elsewhere.
    out[k] = k === "iron" || k === "vitaminD" ? Math.round(p[k] * 10) / 10 : Math.round(p[k]);
  }
  return out;
}

export function parseIngredientNutrition(json: string | null | undefined): IngredientNutrition | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as IngredientNutrition;
    if (!d || typeof d !== "object" || !d.per100g) return null;
    return d;
  } catch {
    return null;
  }
}

// ---- Measure → grams -------------------------------------------------------

// parseMeasure lightly singularizes (strips a trailing "s"), so the abbreviation
// "tbs" arrives here as "tb" — both are mapped.
const ML_PER_UNIT: Record<string, number> = {
  ml: 1, l: 1000, litre: 1000, liter: 1000,
  tsp: 5, teaspoon: 5,
  tbsp: 15, tbs: 15, tb: 15, tablespoon: 15,
  cup: 240,
};
const GRAMS_PER_WEIGHT: Record<string, number> = {
  g: 1, gram: 1, kg: 1000, kilogram: 1000,
  oz: 28.35, ounce: 28.35, lb: 453.6, pound: 453.6,
};
// Words that denote a count of items rather than a weight or volume.
const COUNT_UNITS = new Set([
  "clove", "slice", "stick", "can", "tin", "jar", "pack", "packet",
  "sprig", "bunch", "handful", "whole", "large", "medium", "small", "head", "fillet",
]);
// Typical grams for one of a count unit when the ingredient gives no better hint.
const COUNT_UNIT_GRAMS: Record<string, number> = {
  can: 400, tin: 400, jar: 300, pack: 200, packet: 200,
  slice: 25, clove: 3, sprig: 3, handful: 30, bunch: 60, head: 400, fillet: 150,
};
const TINY_UNITS: Record<string, number> = { pinch: 0.4, dash: 0.6 };

// Backstop grams for one "piece" of an ingredient by aisle, used only when the
// ingredient has no portion/gramsEach hint and the measure is a bare count.
const AISLE_PIECE_GRAMS: Record<string, number> = {
  Produce: 100,
  "Meat & Seafood": 170,
  "Dairy & Eggs": 50,
  Bakery: 45,
  Pantry: 100,
  "Spices & Baking": 2,
  Frozen: 100,
  Other: 80,
};

function portionGrams(nut: IngredientNutrition, unit: string | null): number | null {
  if (!nut.portions?.length) return null;
  if (unit) {
    const u = unit.toLowerCase();
    const hit = nut.portions.find(
      (p) => (p.unit && p.unit.toLowerCase().includes(u)) || (p.modifier && p.modifier.toLowerCase().includes(u)),
    );
    if (hit && hit.amount) return hit.grams / hit.amount;
  }
  // No unit match — fall back to the first "1 unit" style portion (a whole item).
  const each = nut.portions.find((p) => p.amount === 1);
  return each ? each.grams : null;
}

// Convert one recipe line's measure into grams of the ingredient. Returns null when
// there's nothing usable to scale by (e.g. "to taste", or an unrecognized unit), so
// the caller skips it rather than guessing — a wrong guess can wreck a dish's totals.
export function measureToGrams(rawMeasure: string, nut: IngredientNutrition, aisle: string): number | null {
  const { quantity, unit } = parseMeasure(rawMeasure);
  const u = unit?.toLowerCase() ?? null;

  // Tiny units contribute a fixed sprinkle regardless of an explicit count.
  if (u && u in TINY_UNITS) return clamp((quantity ?? 1) * TINY_UNITS[u]);

  if (u && u in GRAMS_PER_WEIGHT) return clamp((quantity ?? 1) * GRAMS_PER_WEIGHT[u]);
  if (u && u in ML_PER_UNIT) return clamp((quantity ?? 1) * ML_PER_UNIT[u] * (nut.density ?? 1));

  // Count only when there's no unit (a bare "2 onions") or an actual count word —
  // never for an unrecognized unit, which is more likely a parse miss than a count.
  if (quantity != null && (u === null || COUNT_UNITS.has(u))) {
    const per = portionGrams(nut, u) ?? nut.gramsEach ?? (u ? COUNT_UNIT_GRAMS[u] : undefined) ?? AISLE_PIECE_GRAMS[aisle] ?? 80;
    // Cap the count: >12 of a countable item in one recipe is almost always a bad
    // source measure (e.g. TheMealDB's "24 Skinned" eggs), not a real quantity.
    return clamp(Math.min(quantity, 12) * per);
  }
  return null;
}

// Guard against a wildly mis-parsed measure dominating a dish.
function clamp(grams: number): number | null {
  if (!Number.isFinite(grams) || grams <= 0) return null;
  return Math.min(grams, 1500);
}

// ---- Recipe-level aggregation ---------------------------------------------

export interface NutritionLine {
  rawMeasure: string;
  aisle: string;
  isStaple: boolean;
  nutrition: IngredientNutrition | null;
}

export interface RecipeNutrition {
  perServing: NutritionPanel;
  /** Fraction of contributing (non-staple) ingredients we had data + a measure for. */
  coverage: number;
  partial: boolean;
}

// Sum every ingredient's contribution, then divide by servings. Staples count only
// when they carry data and a real measure (e.g. "2 tbsp oil" → fat), since "salt to
// taste" yields no grams and is skipped.
export function recipeNutritionPerServing(lines: NutritionLine[], servings: number): RecipeNutrition | null {
  let total = emptyPanel();
  let contributing = 0;
  let covered = 0;

  for (const line of lines) {
    if (!line.isStaple) contributing++;
    if (!line.nutrition) continue;
    const grams = measureToGrams(line.rawMeasure, line.nutrition, line.aisle);
    if (grams == null) continue;
    if (!line.isStaple) covered++;
    const factor = grams / 100;
    for (const k of NUTRIENT_KEYS) {
      const v = line.nutrition.per100g[k];
      if (typeof v === "number") total[k] += v * factor;
    }
  }

  const div = Math.max(1, servings);
  total = scalePanel(total, 1 / div);
  if (total.kcal <= 0) return null; // nothing usable
  total = clampPanel(total); // keep one bad source measure from yielding absurd totals

  const coverage = contributing > 0 ? covered / contributing : 0;
  return { perServing: roundPanel(total), coverage, partial: coverage < 0.6 };
}

// Believable upper bounds for a single dinner serving. Normal dishes sit well under
// these; only outliers from malformed source measures get clamped to a sane ceiling.
const SERVING_MAX: NutritionPanel = {
  kcal: 1300, protein: 70, fat: 110, carb: 180, fiber: 35, sugar: 100, satFat: 45,
  sodium: 5000, calcium: 1500, iron: 25, potassium: 2500, vitaminC: 300, vitaminA: 2500, vitaminD: 30, cholesterol: 700,
};

function clampPanel(p: NutritionPanel): NutritionPanel {
  const out = emptyPanel();
  for (const k of NUTRIENT_KEYS) out[k] = Math.min(p[k], SERVING_MAX[k]);
  return out;
}

// ---- % Daily Value reference (FDA, 2,000 kcal adult) -----------------------

export const DAILY_VALUE: NutritionPanel = {
  kcal: 2000, protein: 50, fat: 78, carb: 275, fiber: 28, sugar: 50, satFat: 20,
  sodium: 2300, calcium: 1300, iron: 18, potassium: 4700, vitaminC: 90, vitaminA: 900, vitaminD: 20, cholesterol: 300,
};

export function percentDV(key: keyof NutritionPanel, value: number): number {
  const dv = DAILY_VALUE[key];
  return dv ? Math.round((value / dv) * 100) : 0;
}

// ---- Display metadata ------------------------------------------------------

export const NUTRIENT_META: Record<keyof NutritionPanel, { label: string; unit: string }> = {
  kcal: { label: "Calories", unit: "" },
  protein: { label: "Protein", unit: "g" },
  fat: { label: "Total fat", unit: "g" },
  satFat: { label: "Saturated fat", unit: "g" },
  carb: { label: "Carbohydrate", unit: "g" },
  fiber: { label: "Fiber", unit: "g" },
  sugar: { label: "Sugars", unit: "g" },
  sodium: { label: "Sodium", unit: "mg" },
  cholesterol: { label: "Cholesterol", unit: "mg" },
  potassium: { label: "Potassium", unit: "mg" },
  calcium: { label: "Calcium", unit: "mg" },
  iron: { label: "Iron", unit: "mg" },
  vitaminC: { label: "Vitamin C", unit: "mg" },
  vitaminA: { label: "Vitamin A", unit: "µg" },
  vitaminD: { label: "Vitamin D", unit: "µg" },
};

export function formatAmount(key: keyof NutritionPanel, value: number): string {
  const { unit } = NUTRIENT_META[key];
  const v = key === "iron" || key === "vitaminD" ? Math.round(value * 10) / 10 : Math.round(value);
  return unit ? `${v}${unit}` : `${v}`;
}
