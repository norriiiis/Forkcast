// The overlap engine — Forkcast's core IP.
//
// Given a user's preferences, pick N dinners whose ingredients overlap as much as
// possible, then derive the three weekly artifacts:
//   1. the meal plan (the chosen dinners)
//   2. ONE grocery list, aisle-sorted, with an estimated cost
//   3. a ~90-minute Sunday batch-prep schedule
//
// The cost model is pack-based: you buy a pack of chicken whether a recipe uses half
// of it, so the weekly total = the pack price of each DISTINCT non-staple ingredient.
// Reusing one ingredient across several dinners is therefore "free" the second time —
// that's where the savings come from, and what the selection maximizes.

import { prisma } from "@/lib/db";
import { aisleOrder, AISLES } from "@/lib/ingredient-catalog";
import { buildRecipeDetail, parseEnriched, type RecipeDetail } from "@/lib/recipe-detail";

export type Diet = "none" | "vegetarian" | "vegan" | "pescatarian";

export interface Preferences {
  servings: number; // household size (people eating each dinner)
  nights: number; // how many dinners to plan (3–6)
  diet: Diet;
  dislikes: string[]; // freeform ingredient terms to avoid
  budgetCents?: number; // optional weekly grocery budget
}

interface PoolIngredient {
  key: string;
  displayName: string;
  aisle: string;
  isStaple: boolean;
  packPriceCents: number;
  packLabel: string;
  rawMeasure: string;
}

interface PoolRecipe {
  id: number;
  sourceId: string;
  title: string;
  category: string | null;
  area: string | null;
  tags: string | null;
  instructions: string;
  imageUrl: string | null;
  servings: number;
  enriched: string | null; // LLM-normalized RecipeDetail JSON, when available
  ingredients: PoolIngredient[];
}

// ---- Result shapes (what the UI renders) ----

export interface PlannedMeal {
  id: number;
  title: string;
  category: string | null;
  area: string | null;
  imageUrl: string | null;
  protein: string; // e.g. "Chicken Breast" or "Vegetarian"
  sharedIngredients: string[]; // ingredients this meal shares with the rest of the plan
  detail: RecipeDetail; // full step-by-step recipe
}

export interface GroceryItem {
  key: string;
  displayName: string;
  aisle: string;
  packLabel: string;
  packPriceCents: number; // price of ONE pack
  packsNeeded: number; // how many packs the week actually needs
  lineCents: number; // packPriceCents × packsNeeded
  usedByCount: number; // how many dinners use it
  shared: boolean; // used by more than one dinner
}

export interface GroceryAisle {
  aisle: string;
  items: GroceryItem[];
  subtotalCents: number;
}

export interface PrepBlock {
  label: string;
  minutes: number;
  tasks: string[];
}

export interface PlanResult {
  preferences: Preferences;
  meals: PlannedMeal[];
  groceryAisles: GroceryAisle[];
  pantryStaples: string[]; // assumed on hand, not costed
  totalCents: number;
  perServingCents: number;
  servingsProduced: number;
  distinctIngredients: number;
  overlapSavingsCents: number; // vs. buying every recipe's ingredients separately
  budgetCents?: number;
  overBudget: boolean;
  prep: PrepBlock[];
  weeknightAssembly: { title: string; note: string }[];
}

// ---- Diet / dislike eligibility ----

// Robust meat/seafood detection on the ingredient text — catches exotic names the
// catalog may not have curated (jamón, oxtail, etc.). Used for diet filtering,
// protein labeling, and the prep schedule.
const SEAFOOD_RE = /\b(fish|salmon|tuna|cod|haddock|tilapia|pollock|bass|mackerel|sardine|anchov\w*|prawns?|shrimp|crab|lobster|squid|calamari|octopus|scallops?|mussels?|clams?|oysters?|seafood)\b/;
const MEAT_RE = /\b(beef|steak|sirloin|brisket|mince|meatballs?|veal|oxtail|shin|chuck|pork|bacon|hams?|jamon|jambon|gammon|prosciutto|pancetta|sausages?|salami|pepperoni|chorizo|lamb|mutton|goat|chicken|poultry|turkey|duck|ribs?)\b/;

// TheMealDB categories that are inherently a meat/seafood protein.
const MEAT_CATEGORIES = new Set(["Beef", "Chicken", "Pork", "Lamb", "Goat"]);
const SEAFOOD_CATEGORY = "Seafood";

function ingredientText(i: PoolIngredient): string {
  return `${i.key} ${i.displayName.toLowerCase()}`;
}
function isSeafoodIng(i: PoolIngredient): boolean {
  return i.aisle === "Meat & Seafood" ? SEAFOOD_RE.test(ingredientText(i)) : SEAFOOD_RE.test(ingredientText(i));
}
function isMeatIng(i: PoolIngredient): boolean {
  const t = ingredientText(i);
  return !SEAFOOD_RE.test(t) && MEAT_RE.test(t);
}
function isAnimalProduct(i: PoolIngredient): boolean {
  return i.aisle === "Dairy & Eggs" || i.key === "honey";
}

function recipeHasMeat(r: PoolRecipe): boolean {
  return (r.category != null && MEAT_CATEGORIES.has(r.category)) || r.ingredients.some(isMeatIng);
}
function recipeHasSeafood(r: PoolRecipe): boolean {
  return r.category === SEAFOOD_CATEGORY || r.ingredients.some(isSeafoodIng);
}

function eligible(recipe: PoolRecipe, prefs: Preferences): boolean {
  const ings = recipe.ingredients;

  if (prefs.diet === "vegetarian" || prefs.diet === "vegan") {
    if (recipeHasMeat(recipe) || recipeHasSeafood(recipe)) return false;
  }
  if (prefs.diet === "vegan") {
    if (ings.some(isAnimalProduct)) return false;
  }
  if (prefs.diet === "pescatarian") {
    if (recipeHasMeat(recipe)) return false; // meat out, seafood allowed
  }

  // Dislikes: substring match against ingredient key or display name.
  const dislikes = prefs.dislikes.map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (dislikes.length) {
    for (const i of ings) {
      if (dislikes.some((d) => ingredientText(i).includes(d))) return false;
    }
  }
  return true;
}

// Protein "family" for the variety cap — category-first so different cuts
// ("Beef Shin" vs "Beef Steak") count as the same protein.
function proteinFamily(recipe: PoolRecipe): string {
  if (recipe.category && MEAT_CATEGORIES.has(recipe.category)) return recipe.category.toLowerCase();
  if (recipe.category === SEAFOOD_CATEGORY) return "seafood";
  if (recipe.ingredients.some(isSeafoodIng)) return "seafood";
  const meat = recipe.ingredients.find(isMeatIng);
  if (meat) return meat.key;
  return "vegetarian";
}

// Rough dish "format" from the title/tags, so a week doesn't end up as 5 soups.
const DISH_TYPES: [string, RegExp][] = [
  ["soup", /\b(soup|broth|bortsch|borsch|shchi|chowder|bisque)\b/],
  ["stew", /\b(stew|caldereta|mechado|bourguignon|tagine|goulash|casserole|hotpot|braise|adobo|curry|masala|korma|vindaloo|bharta|d[h]?al)\b/],
  ["pasta", /\b(pasta|spaghetti|lasagne|lasagna|carbonara|bolognese|noodle|macaroni|ravioli|gnocchi)\b/],
  ["stirfry", /\b(stir.?fry|teriyaki|chow mein|fried rice)\b/],
  ["roast", /\b(roast|baked?|traybake|grill|grilled|griddled|tray bake)\b/],
  ["salad", /\b(salad|slaw|tabbouleh|hummus|ezme)\b/],
  ["wrap", /\b(taco|burrito|fajita|wrap|quesadilla|kebab|falafel)\b/],
  ["sandwich", /\b(burger|sandwich|panini|croquetas?)\b/],
  ["ricebowl", /\b(risotto|paella|biryani|pilaf|pilau|jambalaya|bowl)\b/],
];

function dishType(recipe: PoolRecipe): string {
  const hay = `${recipe.title} ${recipe.tags ?? ""}`.toLowerCase();
  for (const [type, re] of DISH_TYPES) if (re.test(hay)) return type;
  return "other"; // uncapped catch-all
}

// Human-readable protein label for display.
function primaryProtein(recipe: PoolRecipe): string {
  const flesh = recipe.ingredients
    .filter((i) => isMeatIng(i) || isSeafoodIng(i))
    .sort((a, b) => b.packPriceCents - a.packPriceCents);
  if (flesh.length) return flesh[0].displayName;
  if (recipe.category && (MEAT_CATEGORIES.has(recipe.category) || recipe.category === SEAFOOD_CATEGORY)) return recipe.category;
  return "Vegetarian";
}

function nonStaple(recipe: PoolRecipe): PoolIngredient[] {
  return recipe.ingredients.filter((i) => !i.isStaple);
}

// ---- Selection: greedy overlap maximization ----

function selectRecipes(pool: PoolRecipe[], prefs: Preferences, anchorIndex = 0): PoolRecipe[] {
  const eligiblePool = pool.filter((r) => eligible(r, prefs) && nonStaple(r).length >= 2);
  const target = Math.min(prefs.nights, eligiblePool.length);
  if (target === 0) return [];

  // Ingredient popularity across the eligible pool (drives the anchor choice).
  const popularity = new Map<string, number>();
  for (const r of eligiblePool) {
    for (const i of nonStaple(r)) popularity.set(i.key, (popularity.get(i.key) ?? 0) + 1);
  }
  const anchorScore = (r: PoolRecipe) => nonStaple(r).reduce((s, i) => s + (popularity.get(i.key) ?? 0), 0);

  // Anchor: a "central" recipe built from common ingredients. anchorIndex lets the
  // caller pick the 1st, 2nd, … best anchor to regenerate a different plan.
  // For meat-eaters, anchor on a real protein main (not the most generic soup) so the
  // week reads like actual dinners and the cost is realistic.
  const ranked = [...eligiblePool].sort((a, b) => anchorScore(b) - anchorScore(a));
  const wantsProtein = prefs.diet === "none" || prefs.diet === "pescatarian";
  let anchorPool = ranked;
  if (wantsProtein) {
    // Favor anchors whose protein recurs a lot in the pool (chicken/beef), so the
    // week can reuse that protein and reads like real dinners, not a pot of soup.
    const familyCounts = new Map<string, number>();
    for (const r of eligiblePool) {
      const f = proteinFamily(r);
      if (f !== "vegetarian") familyCounts.set(f, (familyCounts.get(f) ?? 0) + 1);
    }
    const proteins = eligiblePool
      .filter((r) => proteinFamily(r) !== "vegetarian")
      .sort(
        (a, b) =>
          (familyCounts.get(proteinFamily(b))! - familyCounts.get(proteinFamily(a))!) ||
          anchorScore(b) - anchorScore(a),
      );
    if (proteins.length) anchorPool = proteins;
  }
  const anchor = anchorPool[Math.min(anchorIndex, anchorPool.length - 1)];

  const basket: PoolRecipe[] = [anchor];
  const basketKeys = new Set(nonStaple(anchor).map((i) => i.key));
  const proteinCount = new Map<string, number>();
  const typeCount = new Map<string, number>();
  proteinCount.set(proteinFamily(anchor), 1);
  typeCount.set(dishType(anchor), 1);

  // Reuse a hero protein (that's the whole point) but cap repeats so the week still
  // feels varied — e.g. 3 chicken + 2 others rather than 5 identical braises. The
  // same cap on dish format keeps it from becoming 5 soups.
  const maxPerProtein = Math.max(2, Math.ceil(prefs.nights / 2));
  const maxPerType = Math.max(2, Math.ceil(prefs.nights / 2));

  while (basket.length < target) {
    let best: PoolRecipe | null = null;
    let bestScore = -Infinity;
    let bestAny: PoolRecipe | null = null; // fallback if the cap leaves nothing
    let bestAnyScore = -Infinity;

    for (const cand of eligiblePool) {
      if (basket.includes(cand)) continue;
      const ns = nonStaple(cand);
      let overlap = 0;
      let addedCostCents = 0;
      let newCount = 0;
      for (const i of ns) {
        if (basketKeys.has(i.key)) overlap++;
        else {
          newCount++;
          addedCostCents += i.packPriceCents;
        }
      }
      // Reward overlap, lightly penalize new distinct ingredients. Cost is only a
      // gentle tiebreaker — we don't want to dodge a good protein just because it's
      // pricey; reusing one pricey pack across meals IS the value. Hard budgets are
      // handled separately by refineForBudget().
      const score = overlap * 6 - newCount * 4 - (addedCostCents / 100) * 0.25;

      if (score > bestAnyScore) {
        bestAnyScore = score;
        bestAny = cand;
      }
      const family = proteinFamily(cand);
      const type = dishType(cand);
      const proteinOk = family === "vegetarian" || (proteinCount.get(family) ?? 0) < maxPerProtein;
      const typeOk = type === "other" || (typeCount.get(type) ?? 0) < maxPerType;
      if (proteinOk && typeOk && score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    const chosen = best ?? bestAny;
    if (!chosen) break;
    basket.push(chosen);
    for (const i of nonStaple(chosen)) basketKeys.add(i.key);
    proteinCount.set(proteinFamily(chosen), (proteinCount.get(proteinFamily(chosen)) ?? 0) + 1);
    typeCount.set(dishType(chosen), (typeCount.get(dishType(chosen)) ?? 0) + 1);
  }

  return basket;
}

// Budget-aware refinement: while over budget, try swapping the costliest recipe
// (by the unique ingredients only it contributes) for a cheaper eligible one.
function refineForBudget(selected: PoolRecipe[], pool: PoolRecipe[], prefs: Preferences): PoolRecipe[] {
  if (!prefs.budgetCents) return selected;
  let current = selected;

  for (let pass = 0; pass < 6; pass++) {
    const cost = subtotalOf(current);
    if (cost <= prefs.budgetCents) break;

    // Unique-cost of each selected recipe = pack price of ingredients only it uses.
    const counts = ingredientCounts(current);
    let worstIdx = -1;
    let worstUniqueCost = -1;
    current.forEach((r, idx) => {
      const uniqueCost = nonStaple(r)
        .filter((i) => counts.get(i.key) === 1)
        .reduce((s, i) => s + i.packPriceCents, 0);
      if (uniqueCost > worstUniqueCost) {
        worstUniqueCost = uniqueCost;
        worstIdx = idx;
      }
    });
    if (worstIdx === -1) break;

    const without = current.filter((_, i) => i !== worstIdx);
    const withoutKeys = new Set(without.flatMap((r) => nonStaple(r).map((i) => i.key)));

    // Find the eligible replacement that adds the least new cost.
    let bestRepl: PoolRecipe | null = null;
    let bestAdded = Infinity;
    for (const cand of pool) {
      if (current.includes(cand)) continue;
      if (!eligible(cand, prefs) || nonStaple(cand).length < 2) continue;
      const added = nonStaple(cand)
        .filter((i) => !withoutKeys.has(i.key))
        .reduce((s, i) => s + i.packPriceCents, 0);
      if (added < bestAdded) {
        bestAdded = added;
        bestRepl = cand;
      }
    }
    if (!bestRepl) break;
    const candidate = [...without, bestRepl];
    if (subtotalOf(candidate) >= cost) break; // no improvement; stop
    current = candidate;
  }
  return current;
}

function ingredientCounts(recipes: PoolRecipe[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of recipes) {
    for (const i of nonStaple(r)) counts.set(i.key, (counts.get(i.key) ?? 0) + 1);
  }
  return counts;
}

// Roughly how many recipe-servings one grocery pack covers, by aisle. A protein pack
// (~1.5–2 lb) ≈ one meal's worth (4 servings) — so a protein used in 3 dinners needs
// ~3 packs. Bottles, bags, and cans stretch across the week, which is the real saving.
const PACK_SERVINGS: Record<string, number> = {
  "Meat & Seafood": 4,
  "Dairy & Eggs": 8,
  Bakery: 6,
  Produce: 12,
  Pantry: 12,
  "Spices & Baking": 48,
  Frozen: 12,
  Other: 10,
};
const SERVINGS_PER_RECIPE = 4;

function packsNeeded(aisle: string, recipesUsing: number): number {
  const cover = PACK_SERVINGS[aisle] ?? 10;
  return Math.max(1, Math.ceil((recipesUsing * SERVINGS_PER_RECIPE) / cover));
}

function subtotalOf(recipes: PoolRecipe[]): number {
  const counts = ingredientCounts(recipes);
  const meta = new Map<string, PoolIngredient>();
  for (const r of recipes) for (const i of nonStaple(r)) if (!meta.has(i.key)) meta.set(i.key, i);
  let sum = 0;
  for (const [key, i] of meta) sum += i.packPriceCents * packsNeeded(i.aisle, counts.get(key) ?? 1);
  return sum;
}

// ---- Artifact assembly ----

function buildResult(selected: PoolRecipe[], prefs: Preferences): PlanResult {
  const counts = ingredientCounts(selected);

  // Grocery items (distinct non-staples), grouped by aisle.
  const itemByKey = new Map<string, GroceryItem>();
  const stapleNames = new Set<string>();
  let naiveTotal = 0; // sum if every recipe bought its ingredients separately

  for (const r of selected) {
    for (const i of r.ingredients) {
      if (i.isStaple) {
        stapleNames.add(i.displayName);
        continue;
      }
      naiveTotal += i.packPriceCents; // separate shopping = 1 pack per recipe occurrence
      if (!itemByKey.has(i.key)) {
        const used = counts.get(i.key) ?? 1;
        const packs = packsNeeded(i.aisle, used);
        itemByKey.set(i.key, {
          key: i.key,
          displayName: i.displayName,
          aisle: i.aisle,
          packLabel: i.packLabel,
          packPriceCents: i.packPriceCents,
          packsNeeded: packs,
          lineCents: i.packPriceCents * packs,
          usedByCount: used,
          shared: used > 1,
        });
      }
    }
  }

  const aisleMap = new Map<string, GroceryItem[]>();
  for (const item of itemByKey.values()) {
    if (!aisleMap.has(item.aisle)) aisleMap.set(item.aisle, []);
    aisleMap.get(item.aisle)!.push(item);
  }
  const groceryAisles: GroceryAisle[] = [...aisleMap.entries()]
    .map(([aisle, items]) => ({
      aisle,
      items: items.sort((a, b) => b.usedByCount - a.usedByCount || a.displayName.localeCompare(b.displayName)),
      subtotalCents: items.reduce((s, i) => s + i.lineCents, 0),
    }))
    .sort((a, b) => aisleOrder(a.aisle) - aisleOrder(b.aisle));

  const totalCents = subtotalOf(selected);
  const servingsProduced = selected.reduce((s, r) => s + r.servings, 0);
  const perServingCents = servingsProduced ? Math.round(totalCents / servingsProduced) : 0;

  // Meals, annotated with the ingredients they share with the rest of the plan.
  const meals: PlannedMeal[] = selected.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    area: r.area,
    imageUrl: r.imageUrl,
    protein: primaryProtein(r),
    sharedIngredients: nonStaple(r)
      .filter((i) => (counts.get(i.key) ?? 1) > 1)
      .map((i) => i.displayName),
    // Prefer the LLM-normalized recipe; fall back to the deterministic build.
    detail:
      parseEnriched(r.enriched) ??
      buildRecipeDetail({
        servings: r.servings,
        instructions: r.instructions,
        ingredients: r.ingredients.map((i) => ({
          key: i.key,
          displayName: i.displayName,
          rawMeasure: i.rawMeasure,
          isStaple: i.isStaple,
        })),
      }),
  }));

  return {
    preferences: prefs,
    meals,
    groceryAisles,
    pantryStaples: [...stapleNames].sort(),
    totalCents,
    perServingCents,
    servingsProduced,
    distinctIngredients: itemByKey.size,
    overlapSavingsCents: Math.max(0, naiveTotal - totalCents),
    budgetCents: prefs.budgetCents,
    overBudget: prefs.budgetCents ? totalCents > prefs.budgetCents : false,
    prep: buildPrepSchedule(selected),
    weeknightAssembly: meals.map((m) => ({
      title: m.title,
      note: assemblyNote(selected.find((r) => r.id === m.id)!),
    })),
  };
}

// ---- ~90-minute Sunday batch-prep schedule (heuristic) ----

const BASE_KEYS = new Set(["rice", "pasta", "noodles", "potato", "baby potatoes", "sweet potato", "couscous", "quinoa", "gnocchi"]);
const SAUCE_KEYS = new Set(["canned tomatoes", "passata", "tomato paste", "coconut milk", "curry paste", "stock", "cream", "salsa"]);

function uniqueDisplay(ings: PoolIngredient[]): string[] {
  return [...new Map(ings.map((i) => [i.key, i.displayName])).values()];
}

function buildPrepSchedule(selected: PoolRecipe[]): PrepBlock[] {
  const all = selected.flatMap((r) => r.ingredients);
  const produce = uniqueDisplay(all.filter((i) => i.aisle === "Produce"));
  const proteins = uniqueDisplay(all.filter((i) => isMeatIng(i) || isSeafoodIng(i)));
  const bases = uniqueDisplay(all.filter((i) => BASE_KEYS.has(i.key)));
  const sauces = uniqueDisplay(all.filter((i) => SAUCE_KEYS.has(i.key)));

  const blocks: PrepBlock[] = [];

  blocks.push({
    label: "Mise en place",
    minutes: 15,
    tasks: produce.length
      ? [`Wash and chop your shared produce: ${list(produce)}.`, "Store prepped veg in containers so weeknights are grab-and-go."]
      : ["Set out your ingredients and containers for the week."],
  });

  if (proteins.length) {
    blocks.push({
      label: "Batch-cook proteins",
      minutes: 30,
      tasks: [
        `Cook your proteins in batches: ${list(proteins)}.`,
        "Season simply, cook through, then cool and store separately — you'll flavor them per-recipe at assembly.",
      ],
    });
  } else {
    blocks.push({
      label: "Batch-cook the mains",
      minutes: 30,
      tasks: ["Roast or sauté your main vegetables and legumes in batches; cool and store."],
    });
  }

  blocks.push({
    label: "Cook bases & sauces",
    minutes: 30,
    tasks: [
      bases.length ? `Cook your bases: ${list(bases)}.` : "Prep any grains or starches you're using.",
      sauces.length ? `Build sauce bases: ${list(sauces)}.` : "Mix any dressings or sauces and refrigerate.",
    ],
  });

  blocks.push({
    label: "Portion & store",
    minutes: 15,
    tasks: ["Portion components into containers and label them by night.", "Now each weeknight dinner is ~10 minutes of assembly."],
  });

  return blocks;
}

function assemblyNote(recipe: PoolRecipe): string {
  const protein = recipe.ingredients.find((i) => isMeatIng(i) || isSeafoodIng(i));
  const finishers = uniqueDisplay(
    recipe.ingredients.filter((i) => i.aisle === "Produce" || i.aisle === "Dairy & Eggs" || SAUCE_KEYS.has(i.key)),
  ).slice(0, 3);
  const proteinPart = protein ? `Reheat the ${protein.displayName.toLowerCase()}` : "Reheat your prepped components";
  const finishPart = finishers.length ? `, finish with ${list(finishers.map((f) => f.toLowerCase()))}` : "";
  return `${proteinPart}${finishPart}, and serve. ~10 min.`;
}

function list(items: string[]): string {
  const x = items.slice(0, 6);
  if (x.length <= 1) return x[0] ?? "";
  return `${x.slice(0, -1).join(", ")} and ${x[x.length - 1]}`;
}

// ---- Public entry points ----

export async function loadPool(): Promise<PoolRecipe[]> {
  const recipes = await prisma.recipe.findMany({
    include: { ingredients: { include: { ingredient: true } } },
  });
  return recipes.map((r) => ({
    id: r.id,
    sourceId: r.sourceId,
    title: r.title,
    category: r.category,
    area: r.area,
    tags: r.tags,
    instructions: r.instructions,
    imageUrl: r.imageUrl,
    servings: r.servings,
    enriched: r.enriched,
    ingredients: r.ingredients.map((ri) => ({
      key: ri.ingredient.name,
      displayName: ri.ingredient.displayName,
      aisle: ri.ingredient.aisle,
      isStaple: ri.ingredient.isStaple,
      packPriceCents: ri.ingredient.packPriceCents,
      packLabel: ri.ingredient.packLabel,
      rawMeasure: ri.rawMeasure,
    })),
  }));
}

export function buildPlan(pool: PoolRecipe[], prefs: Preferences, anchorIndex = 0): PlanResult {
  const selected = selectRecipes(pool, prefs, anchorIndex);
  const refined = refineForBudget(selected, pool, prefs);
  return buildResult(refined, prefs);
}

// Replace ONE meal in an existing plan with the best eligible alternative that
// isn't already in the plan — maximizing overlap with the meals you're keeping
// so the single grocery list stays coherent. Because the swapped-out recipe is
// excluded, swapping the same slot again naturally cycles to the next-best
// alternative. Returns a full rebuilt PlanResult.
export function swapMeal(pool: PoolRecipe[], prefs: Preferences, currentIds: number[], swapId: number): PlanResult {
  const byId = new Map(pool.map((r) => [r.id, r]));
  const current = currentIds.map((id) => byId.get(id)).filter((r): r is PoolRecipe => Boolean(r));
  const swapIdx = current.findIndex((r) => r.id === swapId);
  // Stale id, or nothing to swap against — rebuild what we have.
  if (swapIdx === -1 || current.length === 0) return buildResult(current, prefs);

  const retained = current.filter((_, i) => i !== swapIdx);
  const basketKeys = new Set(retained.flatMap((r) => nonStaple(r).map((i) => i.key)));

  // Protein / dish-type caps measured over the meals we're keeping, so a swap
  // can't push the week to 5 of the same protein or 5 soups.
  const proteinCount = new Map<string, number>();
  const typeCount = new Map<string, number>();
  for (const r of retained) {
    proteinCount.set(proteinFamily(r), (proteinCount.get(proteinFamily(r)) ?? 0) + 1);
    typeCount.set(dishType(r), (typeCount.get(dishType(r)) ?? 0) + 1);
  }
  const maxPerProtein = Math.max(2, Math.ceil(prefs.nights / 2));
  const maxPerType = Math.max(2, Math.ceil(prefs.nights / 2));

  const candidates = pool.filter(
    (r) => !currentIds.includes(r.id) && eligible(r, prefs) && nonStaple(r).length >= 2,
  );

  let best: PoolRecipe | null = null;
  let bestScore = -Infinity;
  let bestAny: PoolRecipe | null = null; // fallback if the cap leaves nothing
  let bestAnyScore = -Infinity;

  for (const cand of candidates) {
    let overlap = 0;
    let newCount = 0;
    let addedCostCents = 0;
    for (const i of nonStaple(cand)) {
      if (basketKeys.has(i.key)) overlap++;
      else {
        newCount++;
        addedCostCents += i.packPriceCents;
      }
    }
    const score = overlap * 6 - newCount * 4 - (addedCostCents / 100) * 0.25;
    if (score > bestAnyScore) {
      bestAnyScore = score;
      bestAny = cand;
    }
    const family = proteinFamily(cand);
    const type = dishType(cand);
    const proteinOk = family === "vegetarian" || (proteinCount.get(family) ?? 0) < maxPerProtein;
    const typeOk = type === "other" || (typeCount.get(type) ?? 0) < maxPerType;
    if (proteinOk && typeOk && score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }

  const replacement = best ?? bestAny;
  if (!replacement) return buildResult(current, prefs); // no alternative — unchanged

  const next = [...current];
  next[swapIdx] = replacement;
  return buildResult(next, prefs);
}

export async function generatePlan(prefs: Preferences, anchorIndex = 0): Promise<PlanResult> {
  const pool = await loadPool();
  return buildPlan(pool, prefs, anchorIndex);
}

export { AISLES };
