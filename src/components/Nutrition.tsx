import { type NutritionPanel, NUTRIENT_META, formatAmount, percentDV } from "@/lib/nutrition";

// Presentational nutrition UI shared by the planner, saved plans, and the weekly
// report. Pure render — safe in both server and client components.

const round = (n: number) => Math.round(n);

// Compact one-liner for meal cards: "520 cal · 38g protein · 12g fat".
export function MealNutritionLine({ n, partial }: { n: NutritionPanel | null; partial?: boolean }) {
  if (!n) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500">
      <span>
        <span className="font-semibold text-stone-700 tabular-nums">{round(n.kcal)}</span> cal
      </span>
      <Dot />
      <span>
        <span className="font-semibold text-stone-700 tabular-nums">{round(n.protein)}g</span> protein
      </span>
      <Dot />
      <span className="tabular-nums">{round(n.carb)}g carbs</span>
      <Dot />
      <span className="tabular-nums">{round(n.fat)}g fat</span>
      {partial && <span className="text-stone-400">· rough</span>}
    </p>
  );
}

const BIG: { key: keyof NutritionPanel; label: string }[] = [
  { key: "kcal", label: "Calories" },
  { key: "protein", label: "Protein" },
  { key: "carb", label: "Carbs" },
  { key: "fat", label: "Fat" },
];
const ROWS: (keyof NutritionPanel)[] = [
  "fiber", "sugar", "satFat", "sodium", "cholesterol", "potassium",
  "calcium", "iron", "vitaminC", "vitaminA", "vitaminD",
];

// Full nutrition panel with % Daily Value, for the recipe modal and the report.
export function NutritionFacts({
  panel,
  caption = "per serving",
  note,
}: {
  panel: NutritionPanel;
  caption?: string;
  note?: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {BIG.map(({ key, label }) => (
          <div key={key} className="rounded-xl border border-stone-200 bg-white p-3 text-center">
            <div className="font-display text-2xl font-black tabular-nums text-stone-800">
              {key === "kcal" ? round(panel.kcal) : formatAmount(key, panel[key])}
            </div>
            <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-stone-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {ROWS.map((key) => (
          <NutrientRow key={key} nutrientKey={key} value={panel[key]} />
        ))}
      </div>

      <p className="mt-3 text-xs text-stone-400">
        {caption === "per serving" ? "Per serving. " : ""}% Daily Value based on a 2,000-calorie diet.
        {note ? ` ${note}` : ""}
      </p>
    </div>
  );
}

function NutrientRow({ nutrientKey, value }: { nutrientKey: keyof NutritionPanel; value: number }) {
  const { label } = NUTRIENT_META[nutrientKey];
  const dv = percentDV(nutrientKey, value);
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-sm text-stone-600">{label}</span>
      <span className="w-14 shrink-0 text-right text-sm font-medium tabular-nums text-stone-800">
        {formatAmount(nutrientKey, value)}
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
        <span
          className="block h-full rounded-full bg-brand/60"
          style={{ width: `${Math.min(100, dv)}%` }}
        />
      </span>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-stone-400">{dv}%</span>
    </div>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-stone-300">
      ·
    </span>
  );
}
