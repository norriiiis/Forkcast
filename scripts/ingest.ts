// Ingest public recipe data (TheMealDB) into our own DB.
//
// For each dinner-appropriate category we fetch the meal list, look up each meal's
// full detail, resolve its ingredients through our canonical catalog, and upsert
// Recipe + Ingredient + RecipeIngredient rows. Idempotent: re-running refreshes.
//
// Run with:  npx tsx scripts/ingest.ts

import { prisma } from "../src/lib/db";
import { resolveIngredient } from "../src/lib/ingredient-catalog";
import { parseMeasure } from "../src/lib/measure-parser";

const BASE = "https://www.themealdb.com/api/json/v1/1";

// Dinner-appropriate categories (skip Dessert/Breakfast/Starter).
// Ordered so under-represented variety categories are queued first.
const CATEGORIES = [
  "Vegetarian",
  "Vegan",
  "Seafood",
  "Pasta",
  "Side",
  "Miscellaneous",
  "Chicken",
  "Beef",
  "Pork",
  "Lamb",
];

const PER_CATEGORY = 35; // cap meals pulled per category
const CONCURRENCY = 2; // gentle — TheMealDB rate-limits aggressive parallelism
const REQUEST_DELAY_MS = 220; // pause between meal lookups

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface MealDetail {
  idMeal: string;
  strMeal: string;
  strCategory?: string;
  strArea?: string;
  strTags?: string;
  strInstructions?: string;
  strMealThumb?: string;
  [k: string]: string | undefined;
}

async function getJson<T>(url: string, attempt = 0): Promise<T> {
  const res = await fetch(url);
  if (res.status === 429 && attempt < 5) {
    await sleep(800 * Math.pow(2, attempt)); // back off on rate limit
    return getJson<T>(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return (await res.json()) as T;
}

// Run async work over items with limited concurrency.
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function extractIngredients(meal: MealDetail): { raw: string; measure: string }[] {
  const out: { raw: string; measure: string }[] = [];
  for (let n = 1; n <= 20; n++) {
    const raw = (meal[`strIngredient${n}`] || "").trim();
    const measure = (meal[`strMeasure${n}`] || "").trim();
    if (raw) out.push({ raw, measure });
  }
  return out;
}

async function ingestMeal(id: string): Promise<boolean> {
  const data = await getJson<{ meals: MealDetail[] | null }>(`${BASE}/lookup.php?i=${id}`);
  const meal = data.meals?.[0];
  if (!meal) return false;

  const rawIngredients = extractIngredients(meal);

  // Resolve + dedupe by canonical key within this recipe.
  const byKey = new Map<string, { rawMeasure: string; quantity: number | null; unit: string | null; ingredientId: number }>();

  for (const { raw, measure } of rawIngredients) {
    const resolved = resolveIngredient(raw);
    if (!resolved.key) continue;

    const ingredient = await prisma.ingredient.upsert({
      where: { name: resolved.key },
      create: {
        name: resolved.key,
        displayName: resolved.displayName,
        aisle: resolved.aisle,
        isStaple: resolved.isStaple,
        packPriceCents: resolved.packPriceCents,
        packLabel: resolved.packLabel,
      },
      // Refresh catalog-derived fields on re-run, but only from curated matches
      // so a heuristic fallback never overwrites good data.
      update: resolved.matched
        ? {
            displayName: resolved.displayName,
            aisle: resolved.aisle,
            isStaple: resolved.isStaple,
            packPriceCents: resolved.packPriceCents,
            packLabel: resolved.packLabel,
          }
        : {},
    });

    if (!byKey.has(resolved.key)) {
      const parsed = parseMeasure(measure);
      byKey.set(resolved.key, {
        rawMeasure: measure,
        quantity: parsed.quantity,
        unit: parsed.unit,
        ingredientId: ingredient.id,
      });
    }
  }

  if (byKey.size === 0) return false;

  const recipe = await prisma.recipe.upsert({
    where: { sourceId: meal.idMeal },
    create: {
      sourceId: meal.idMeal,
      source: "themealdb",
      title: meal.strMeal,
      category: meal.strCategory ?? null,
      area: meal.strArea ?? null,
      tags: meal.strTags ?? null,
      instructions: meal.strInstructions ?? "",
      imageUrl: meal.strMealThumb ?? null,
      servings: 4,
    },
    update: {
      title: meal.strMeal,
      category: meal.strCategory ?? null,
      area: meal.strArea ?? null,
      tags: meal.strTags ?? null,
      instructions: meal.strInstructions ?? "",
      imageUrl: meal.strMealThumb ?? null,
    },
  });

  // Recreate links for a clean idempotent state.
  await prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
  await prisma.recipeIngredient.createMany({
    data: Array.from(byKey.values()).map((v) => ({
      recipeId: recipe.id,
      ingredientId: v.ingredientId,
      rawMeasure: v.rawMeasure,
      quantity: v.quantity,
      unit: v.unit,
    })),
  });

  return true;
}

async function main() {
  console.log("Forkcast ingest starting…");
  const ids = new Set<string>();

  // Skip meals we've already ingested so re-runs only fetch what's missing.
  const existing = new Set((await prisma.recipe.findMany({ select: { sourceId: true } })).map((r) => r.sourceId));
  console.log(`  ${existing.size} recipes already in DB — will skip those.`);

  for (const cat of CATEGORIES) {
    try {
      const data = await getJson<{ meals: { idMeal: string }[] | null }>(`${BASE}/filter.php?c=${encodeURIComponent(cat)}`);
      const meals = data.meals ?? [];
      let added = 0;
      for (const m of meals) {
        if (added >= PER_CATEGORY) break;
        if (!ids.has(m.idMeal) && !existing.has(m.idMeal)) {
          ids.add(m.idMeal);
          added++;
        }
      }
      console.log(`  ${cat}: queued ${added} new (total ${ids.size})`);
    } catch (e) {
      console.warn(`  ${cat}: failed to list — ${(e as Error).message}`);
    }
  }

  const idList = Array.from(ids);
  let ok = 0;
  let done = 0;
  await pool(idList, CONCURRENCY, async (id) => {
    try {
      const success = await ingestMeal(id);
      if (success) ok++;
    } catch (e) {
      console.warn(`  meal ${id} failed: ${(e as Error).message}`);
    }
    await sleep(REQUEST_DELAY_MS);
    done++;
    if (done % 25 === 0) console.log(`  …processed ${done}/${idList.length}`);
  });

  const [recipeCount, ingredientCount, linkCount] = await Promise.all([
    prisma.recipe.count(),
    prisma.ingredient.count(),
    prisma.recipeIngredient.count(),
  ]);

  console.log(`\nDone. Ingested ${ok} recipes.`);
  console.log(`DB now holds: ${recipeCount} recipes, ${ingredientCount} ingredients, ${linkCount} recipe-ingredient links.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
