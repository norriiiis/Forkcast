// USDA FoodData Central backfill — populates Ingredient.nutritionJson with real
// measured per-100g nutrients and portion gram-weights, the source of truth behind
// per-meal nutrition. Overrides the curated USDA seed in src/lib/nutrition-data.ts.
//
// Get a free key (instant) at https://fdc.nal.usda.gov/api-key-signup.html and add
// FDC_API_KEY=... to .env. Without one it uses DEMO_KEY (heavily rate-limited:
// ~30 req/hour), fine for a small --limit smoke test but not the full catalog.
//
//   npm run nutrition -- --limit 5      # smoke test on 5 ingredients
//   npm run nutrition                   # backfill everything not yet done
//   npm run nutrition -- --only "chicken breast,rice,onion"
//   npm run nutrition -- --force        # re-fetch everything

import "dotenv/config";
import { prisma } from "../src/lib/db";
import type { IngredientNutrition, NutritionPanel } from "../src/lib/nutrition";

const API_KEY = process.env.FDC_API_KEY || "DEMO_KEY";
const BASE = "https://api.nal.usda.gov/fdc/v1";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// USDA nutrient number → our panel key.
const NUTRIENT_MAP: Record<string, keyof NutritionPanel> = {
  "208": "kcal", "203": "protein", "204": "fat", "205": "carb", "291": "fiber",
  "269": "sugar", "606": "satFat", "307": "sodium", "301": "calcium", "303": "iron",
  "306": "potassium", "401": "vitaminC", "320": "vitaminA", "328": "vitaminD", "601": "cholesterol",
};

interface FdcNutrient {
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
  amount?: number;
  nutrient?: { number?: string; unitName?: string };
}
interface FdcPortion {
  amount?: number;
  gramWeight?: number;
  modifier?: string;
  measureUnit?: { name?: string };
}
interface FdcFood {
  fdcId: number;
  description: string;
  dataType?: string;
  score?: number;
  foodNutrients?: FdcNutrient[];
  foodPortions?: FdcPortion[];
}

async function getJson<T>(url: string, attempt = 0): Promise<T> {
  const res = await fetch(url);
  if ((res.status === 429 || res.status === 503) && attempt < 5) {
    await sleep(2000 * Math.pow(2, attempt));
    return getJson<T>(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} for ${url.replace(API_KEY, "***")}`);
  return (await res.json()) as T;
}

// A few staples are ambiguous enough that a bare name mis-matches ("rice" →
// rice crackers); steer those with a more specific query, keyed by catalog name.
const QUERY_OVERRIDE: Record<string, string> = {
  rice: "rice white long-grain raw",
  pasta: "pasta dry enriched",
  noodles: "noodles egg dry",
  chickpeas: "chickpeas garbanzo canned",
  "kidney beans": "kidney beans canned",
  "black beans": "black beans canned",
  "white beans": "cannellini beans canned",
  lentils: "lentils raw",
  flour: "wheat flour white all-purpose",
  sugar: "sugars granulated",
  "ground beef": "ground beef raw",
  stock: "chicken broth",
};

// The search query for an ingredient: the part of the display name before any
// "/" or parenthetical, lowercased ("Cilantro / Coriander" → "cilantro").
function queryFor(displayName: string): string {
  return displayName.split("/")[0].replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

// Words that usually signal a wrong/over-processed match for a plain ingredient.
const BAD_TOKENS = ["baby food", "infant", "lunchmeat", "luncheon", "candy", "dressing", "gravy", "babyfood"];
const PROCESSED_TOKENS = ["flour", "cracker", "chip", "snack", "juice", "powder", "paste", "dried", "puff", "cereal", "instant", "fried", "mix"];

function scoreFood(food: FdcFood, query: string): number {
  const desc = (food.description || "").toLowerCase();
  const first = query.split(" ")[0];
  let s = food.score ?? 0;
  if (food.dataType === "Foundation" || food.dataType === "SR Legacy") s += 50;
  for (const t of BAD_TOKENS) if (desc.includes(t)) s -= 400;
  // Penalize processed forms unless the ingredient itself asked for them.
  for (const t of PROCESSED_TOKENS) if (desc.includes(t) && !query.includes(t)) s -= 120;
  // Reward the query word appearing early and the "Noun, …" whole-food pattern.
  const idx = desc.indexOf(first);
  if (idx === 0) s += 60;
  else if (idx > 0) s += 20;
  if (desc.startsWith(first + ",") || desc.startsWith(first + " ")) s += 30;
  s -= (desc.match(/,/g)?.length ?? 0) * 5;
  if (/\braw\b/.test(desc)) s += 40; // closest to "as purchased"
  if (/\bcanned\b/.test(desc) && !query.includes("canned")) s -= 30;
  return s;
}

function nutrientNumber(n: FdcNutrient): string | undefined {
  return n.nutrientNumber ?? n.nutrient?.number;
}
function nutrientValue(n: FdcNutrient): number | undefined {
  return n.value ?? n.amount;
}

function extractPer100g(food: FdcFood): Partial<NutritionPanel> {
  const out: Partial<NutritionPanel> = {};
  for (const n of food.foodNutrients ?? []) {
    const num = nutrientNumber(n);
    const key = num ? NUTRIENT_MAP[num] : undefined;
    const val = nutrientValue(n);
    if (key && typeof val === "number") out[key] = Math.round(val * 100) / 100;
  }
  // Energy fallback: some Foundation foods omit #208 but carry Atwater energy in
  // kcal under another id. Take the first kcal-unit energy value we find.
  if (out.kcal == null) {
    for (const n of food.foodNutrients ?? []) {
      const unit = (n.unitName ?? n.nutrient?.unitName ?? "").toUpperCase();
      const val = nutrientValue(n);
      if (unit === "KCAL" && typeof val === "number") {
        out.kcal = Math.round(val * 100) / 100;
        break;
      }
    }
  }
  return out;
}

const ML_HINT: Record<string, number> = { cup: 240, tablespoon: 15, tbsp: 15, teaspoon: 5, tsp: 5 };

function extractPortions(food: FdcFood): { portions: IngredientNutrition["portions"]; gramsEach?: number; density?: number } {
  const portions: NonNullable<IngredientNutrition["portions"]> = [];
  let gramsEach: number | undefined;
  let density: number | undefined;

  for (const p of food.foodPortions ?? []) {
    if (!p.gramWeight || !p.amount) continue;
    const unit = p.measureUnit?.name && p.measureUnit.name !== "undetermined" ? p.measureUnit.name : undefined;
    const modifier = p.modifier;
    portions.push({ amount: p.amount, unit, modifier, grams: p.gramWeight });

    const label = `${unit ?? ""} ${modifier ?? ""}`.toLowerCase();
    // A single whole item → gramsEach.
    if (p.amount === 1 && /\b(each|whole|medium|unit|fruit|small|large)\b/.test(label) && gramsEach == null) {
      gramsEach = p.gramWeight;
    }
    // A volume portion → density (g/ml).
    for (const [word, ml] of Object.entries(ML_HINT)) {
      if (density == null && label.includes(word)) {
        const d = p.gramWeight / p.amount / ml;
        if (d > 0.3 && d < 1.7) density = Math.round(d * 100) / 100;
      }
    }
  }
  return { portions: portions.length ? portions : undefined, gramsEach, density };
}

interface Args { limit?: number; force: boolean; only?: string[]; dry: boolean }
function parseArgs(): Args {
  const a = process.argv.slice(2);
  const out: Args = { force: a.includes("--force"), dry: a.includes("--dry") };
  const li = a.indexOf("--limit");
  if (li !== -1 && a[li + 1]) out.limit = Number(a[li + 1]);
  const oi = a.indexOf("--only");
  if (oi !== -1 && a[oi + 1]) out.only = a[oi + 1].split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return out;
}

async function main() {
  const args = parseArgs();
  if (API_KEY === "DEMO_KEY") {
    console.warn("⚠ Using DEMO_KEY (≈30 requests/hour). Set FDC_API_KEY in .env for the full catalog.\n");
  }

  const where: Record<string, unknown> = {};
  if (args.only) where.name = { in: args.only };
  else if (!args.force) where.nutritionJson = null;

  const ingredients = await prisma.ingredient.findMany({
    where,
    orderBy: { recipeLinks: { _count: "desc" } }, // most-used ingredients first
    ...(args.limit ? { take: args.limit } : {}),
  });

  console.log(`Backfilling nutrition for ${ingredients.length} ingredient(s) from USDA FDC…\n`);
  let ok = 0;
  let miss = 0;

  // Serial with a small pause — friendly to the rate limit and keeps logs readable.
  for (const ing of ingredients) {
    const query = QUERY_OVERRIDE[ing.name] || queryFor(ing.displayName) || ing.name;
    try {
      const search = await getJson<{ foods?: FdcFood[] }>(
        `${BASE}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(query)}&dataType=${encodeURIComponent("Foundation,SR Legacy")}&pageSize=10`,
      );
      const foods = search.foods ?? [];
      if (!foods.length) {
        miss++;
        console.warn(`  · ${ing.displayName} — no FDC match for "${query}"`);
        continue;
      }
      const best = foods.slice().sort((a, b) => scoreFood(b, query) - scoreFood(a, query))[0];

      // Detail call for portion gram-weights (search omits them).
      let detail: FdcFood = best;
      try {
        detail = await getJson<FdcFood>(`${BASE}/food/${best.fdcId}?api_key=${API_KEY}`);
      } catch {
        /* fall back to the search record's nutrients */
      }

      const per100g = extractPer100g(detail);
      if (per100g.kcal == null || per100g.protein == null) {
        miss++;
        console.warn(`  · ${ing.displayName} — match "${detail.description}" missing energy/protein`);
        continue;
      }
      const { portions, gramsEach, density } = extractPortions(detail);
      const nutrition: IngredientNutrition = {
        source: "fdc",
        per100g,
        fdcId: best.fdcId,
        desc: detail.description,
        ...(gramsEach ? { gramsEach } : {}),
        ...(density ? { density } : {}),
        ...(portions ? { portions } : {}),
      };

      if (!args.dry) {
        await prisma.ingredient.update({ where: { id: ing.id }, data: { nutritionJson: JSON.stringify(nutrition) } });
      }
      ok++;
      console.log(`  ✓ ${ing.displayName} → ${detail.description} (${per100g.kcal ?? "?"} kcal, ${per100g.protein ?? "?"}g protein)`);
    } catch (e) {
      miss++;
      console.warn(`  ✗ ${ing.displayName} — ${(e as Error).message}`);
    }
    await sleep(API_KEY === "DEMO_KEY" ? 400 : 120);
  }

  console.log(`\nDone. ${ok} backfilled, ${miss} unmatched${args.dry ? " (dry run — nothing written)" : ""}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
