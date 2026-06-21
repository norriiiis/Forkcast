// Meal-suggestion tuning — the user's standing preferences collected from the
// weekly report's feedback ("more protein", "fewer noodles", …). Stored on
// User.tuningJson and merged into engine Preferences on every plan generation, so
// the selection deterministically shifts toward what they asked for. The engine
// applies these (see applyTuningScore in engine.ts); this module is just the
// portable type, (de)serialization, and the labels the report UI renders.

export type Emphasis = "more" | "less" | "off";

export interface MealTuning {
  protein: Emphasis; // "more" sorts toward high-protein dinners
  carbs: Emphasis; // "less" steers away from pasta/rice/noodle-heavy dishes
  veggies: "more" | "off"; // "more" favors vegetable-forward dinners
  variety: "more" | "off"; // "more" loosens the protein/format repeat caps
  cheaper: boolean; // weight cost more heavily
  preferCuisines: string[]; // cuisine names to favor (TheMealDB `area`)
  avoidCuisines: string[]; // cuisine names to steer away from
}

export const DEFAULT_TUNING: MealTuning = {
  protein: "off",
  carbs: "off",
  veggies: "off",
  variety: "off",
  cheaper: false,
  preferCuisines: [],
  avoidCuisines: [],
};

// Cuisines offered in the feedback UI — the well-represented TheMealDB areas.
export const CUISINE_OPTIONS = [
  "American", "British", "Chinese", "French", "Greek", "Indian", "Italian",
  "Japanese", "Mexican", "Moroccan", "Spanish", "Thai", "Turkish",
] as const;

function asEmphasis(v: unknown, allowLess = true): Emphasis {
  if (v === "more") return "more";
  if (allowLess && v === "less") return "less";
  return "off";
}

function cleanCuisines(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const valid = new Set<string>(CUISINE_OPTIONS as readonly string[]);
  return [...new Set(v.map(String).filter((s) => valid.has(s)))];
}

export function parseTuning(json: string | null | undefined): MealTuning {
  if (!json) return { ...DEFAULT_TUNING };
  try {
    const d = JSON.parse(json) as Record<string, unknown>;
    return {
      protein: asEmphasis(d.protein),
      carbs: asEmphasis(d.carbs),
      veggies: d.veggies === "more" ? "more" : "off",
      variety: d.variety === "more" ? "more" : "off",
      cheaper: Boolean(d.cheaper),
      preferCuisines: cleanCuisines(d.preferCuisines),
      avoidCuisines: cleanCuisines(d.avoidCuisines),
    };
  } catch {
    return { ...DEFAULT_TUNING };
  }
}

export function serializeTuning(t: MealTuning): string {
  return JSON.stringify(t);
}

export function tuningIsActive(t: MealTuning): boolean {
  return (
    t.protein !== "off" ||
    t.carbs !== "off" ||
    t.veggies !== "off" ||
    t.variety !== "off" ||
    t.cheaper ||
    t.preferCuisines.length > 0 ||
    t.avoidCuisines.length > 0
  );
}

// Human-readable chips summarizing active tuning, for the report + planner banner.
export function describeTuning(t: MealTuning): string[] {
  const out: string[] = [];
  if (t.protein === "more") out.push("More protein");
  if (t.protein === "less") out.push("Less protein");
  if (t.carbs === "more") out.push("More carbs");
  if (t.carbs === "less") out.push("Fewer noodles & carbs");
  if (t.veggies === "more") out.push("More veggies");
  if (t.variety === "more") out.push("More variety");
  if (t.cheaper) out.push("Budget-friendly");
  if (t.preferCuisines.length) out.push(`More ${t.preferCuisines.join(", ")}`);
  if (t.avoidCuisines.length) out.push(`Less ${t.avoidCuisines.join(", ")}`);
  return out;
}
